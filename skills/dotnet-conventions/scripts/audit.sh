#!/usr/bin/env bash
# Audits the lines you added (modified tracked files and new untracked .cs files).
# Usage, from anywhere inside the repository: bash audit.sh [project-or-solution]
# Without an argument, each changed file is mapped to its nearest .csproj and that project is built.
set -u

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "AUDIT: not inside a git repository"; exit 2; }
cd "$root" || exit 2

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
added="$tmp/added.txt"

git diff HEAD -U0 --no-color -- '*.cs' | awk '
  /^\+\+\+ b\// { file = substr($0, 7); next }
  /^\+\+\+ / { file = ""; next }
  /^@@/ {
    match($0, /\+[0-9]+(,[0-9]+)?/)
    spec = substr($0, RSTART + 1, RLENGTH - 1)
    split(spec, a, ",")
    line = a[1] + 0
    next
  }
  /^\+/ && file != "" { sub(/\r$/, ""); print file ":" line ":" substr($0, 2); line++ }
' > "$added"

while IFS= read -r f; do
  awk -v f="$f" '{ sub(/\r$/, ""); print f ":" NR ":" $0 }' "$f" >> "$added"
done < <(git ls-files -o --exclude-standard -- '*.cs')

if [ ! -s "$added" ]; then
  echo "AUDIT: no added C# lines found"
  exit 0
fi

hits=0
report() {
  local label="$1" pattern="$2"
  local out
  out=$(grep -E "$pattern" "$added" || true)
  if [ -n "$out" ]; then
    echo "--- $label"
    echo "$out" | cut -c1-200
    hits=$((hits + $(echo "$out" | wc -l)))
  fi
}

report "catch blocks (each must log or rethrow, never swallow)" ':[0-9]+:.*\bcatch\b'
report "blocking calls or async void" ':[0-9]+:.*(Thread\.Sleep|\.Result\b|\.Wait\(\)|\.GetAwaiter\(\)\.GetResult\(\)|async void)'
notoken=$(grep -E ':[0-9]+:.*async (Task|ValueTask)' "$added" | grep -v 'CancellationToken' | grep -vE '^[^:]*([Tt]est|[Ss]pec)' || true)
if [ -n "$notoken" ]; then
  echo "--- async methods with no CancellationToken (a problem on modern .NET, expected on .NET Framework; test code is ignored)"
  echo "$notoken" | cut -c1-200
  hits=$((hits + $(echo "$notoken" | wc -l)))
fi

projects="$tmp/projects.txt"
: > "$projects"
if [ -n "${1:-}" ]; then
  echo "$1" > "$projects"
else
  cut -d: -f1 "$added" | sort -u | while IFS= read -r f; do
    d=$(dirname "$f")
    while :; do
      p=$(ls "$d"/*.csproj 2>/dev/null | head -1)
      if [ -n "$p" ]; then echo "$p" >> "$projects"; break; fi
      [ "$d" = "." ] && break
      d=$(dirname "$d")
    done
  done
  sort -u "$projects" -o "$projects"
fi

if [ ! -s "$projects" ]; then
  echo "--- analyzers skipped: no .csproj found above the changed files; pass a project path as the argument"
fi

while IFS= read -r p; do
  [ -z "$p" ] && continue
  ok=0
  case "$p" in
    *.sln|*.slnx) ok=1 ;;
    *)
      if grep -q 'Sdk=' "$p" 2>/dev/null && grep -oE '<TargetFrameworks?>[^<]*' "$p" | grep -qE 'net([5-9]|[1-9][0-9])\.[0-9]'; then ok=1; fi
      ;;
  esac
  if [ "$ok" = "0" ]; then
    tfm=$(grep -oE '<TargetFrameworks?>[^<]*' "$p" 2>/dev/null | sed 's/<[^>]*>//' | tr '\n' ' ')
    echo "--- analyzers skipped for $p: needs an SDK-style project targeting net5.0 or later (found: ${tfm:-no target framework})"
    continue
  fi
  build="$tmp/build.txt"
  dotnet build "$p" -nologo -v q -p:AnalysisMode=All --no-incremental > "$build" 2>&1
  if grep -qE ': error ' "$build"; then
    echo "--- build failed for $p:"
    grep -E ': error ' "$build" | sort -u | head -5 | cut -c1-200
    hits=$((hits + 1))
    continue
  fi
  found=$(awk -v addedfile="$added" '
    BEGIN {
      while ((getline l < addedfile) > 0) {
        split(l, q, ":")
        set[q[1] ":" q[2]] = 1
      }
    }
    /warning CA(1849|2016|1031|2200|2000)/ {
      if (match($0, /\([0-9]+,[0-9]+\): warning CA[0-9]+/) == 0) next
      path = substr($0, 1, RSTART - 1)
      rest = substr($0, RSTART)
      match(rest, /\([0-9]+/); ln = substr(rest, RSTART + 1, RLENGTH - 1)
      gsub(/\\/, "/", path)
      m = split(path, parts, "/")
      suffix = ""
      for (i = m; i >= 1; i--) {
        suffix = (suffix == "" ? parts[i] : parts[i] "/" suffix)
        if ((suffix ":" ln) in set) { print suffix ":" ln " " substr(rest, index(rest, "warning ") + 8, 110); break }
      }
    }
  ' "$build" | sort -u)
  if [ -n "$found" ]; then
    echo "--- analyzer warnings on lines you added ($p)"
    echo "$found"
    hits=$((hits + $(echo "$found" | wc -l)))
  fi
done < "$projects"

if [ "$hits" -eq 0 ]; then
  echo "AUDIT: clean"
  exit 0
fi
echo "AUDIT: $hits item(s) to check; fix the real ones and rerun"
exit 1
