---
name: humanizer
description: Rewrite text so it does not read like an LLM wrote it. Strips AI-writing patterns (significance inflation, "delve"/"tapestry" vocabulary, rule-of-three lists, em-dash sales rhythm, sycophancy, hedge filler, tidy cadence) without inventing facts or putting a narrator into engineering prose. Use this skill whenever the user says "humanize", "de-AI", "de-slop", "un-ChatGPT", "review this for AI tells", or asks to make a draft sound less like ChatGPT — even if they never say "humanizer". Do not use it to derive a voice profile (that is creator-voice-profile) and do not apply it to your own output unless the user asked for a humanize pass.
---

# Humanizer

Strip AI-writing tells so the text sounds like a person wrote it. Preserve every fact. Match the genre: engineering prose stays plain; essays may have a voice.

Wikipedia's "Signs of AI writing" is a detection field guide, not a style manual. Isolated tells are not evidence. Clusters are.

## When to use this skill

- "humanize", "de-AI", "de-slop", "un-ChatGPT"
- rewrite something so it does not sound like an LLM
- edit a named draft (blog, essay, PR description, docs, memo, email, resume) to sound more natural
- "review this for AI tells" / review prose before it ships

Do **not** auto-trigger when:

- you are writing your own PR descriptions, reviews, commit messages, docs, or summaries — unless the user asked for a humanize pass
- the user says "match my voice" / "calibrate to my voice" / "voice profile" with no writing sample in this turn — that is `creator-voice-profile`
- the user is discussing AI writing in general, not asking for a rewrite

## Invocation modes

Pick one. The loop is the same; the delivery is not.

| Mode | When | Deliver |
|---|---|---|
| **Review-only** | "review for AI tells", "is this slop" | List hits (`pattern N: quote`). Do not rewrite until asked. Zero findings is valid. |
| **Embedded** | "just fix it", a short paragraph, or another skill asked for prose | Final text only. No draft, no audit, no ceremony. |
| **File** | user points at a file | Read it. Rewrite in place (prose only: leave code, frontmatter, data, link targets). Report a short summary of what changed. |
| **Longform pasted** | user pastes a long essay/post | Draft → audit bullets → final rewrite. |

Repo-wide sweep ("de-slop the docs"): find candidate files, grep tell words from [references/word-tiers.md](references/word-tiers.md), then File mode one file at a time.

## Genre gate

Name the genre in one line before touching the text.

- **Engineering / reference** — PR descriptions, docs, commit messages, release notes, resumes, operational memos, legal. Strip slop. Stay plain. No first person, no opinions, no humor, no "soul." Neutral *is* the human voice here.
- **Essay / opinion** — blogs, personal writing, spoken-voice essays. After slop is gone, Personality below may apply.
- A writing sample in this turn outranks both.

## Hard rules

**Never invent facts.** The rewrite must not contain any fact, name, number, date, quote, or citation that is not in the source text or the user's message. Opinions and reactions are voice, not facts — and only in essay register. If a sentence needs a specific to work and the source does not have one, write the plain version or leave a `[placeholder]`. A fabricated specific is a worse tell than a flat one.

**Do not sprinkle "human markers."** Do not insert contractions, `$43`, named people, And/But openers, "honestly," complaints, or questions in order to seem human. That is a formula. Formulas are the problem.

**Clusters, not isolated words.** A tell is reportable only when it clusters with others, or it is a high-confidence wrapper (chatbot leftover, cutoff disclaimer, emoji-header list). See [references/patterns.md](references/patterns.md) § What not to flag.

**Rhythm is conditional.** If the draft is uniformly mid-length, vary it. Do not force a ≤6-word sentence or a 25-word sentence into a short artifact. Do not drop Oxford commas on purpose. End on the last concrete point; cut uplift closers.

## Workflow

Before each step, restate in one line: genre, mode, "no new facts."

1. Read the input (the file if there is one).
2. Read [references/patterns.md](references/patterns.md) and [references/word-tiers.md](references/word-tiers.md).
3. Identify clusters of tells. In review-only mode, stop here and list them.
4. Rewrite the flagged stretches. Keep the claims. Keep the register the genre gate named. If a writing sample was provided, match it (next section).
5. Audit the rewrite: (a) what still reads as AI? (b) does any fact, name, number, date, or citation appear that was not in the source? A yes on (b) is a defect — delete it.
6. Deliver what the mode table says. For File mode, apply the final text to the file and show what changed.

## Voice calibration

Only when the user provides a sample of *their* writing in this turn (inline or a file path). Read the sample first. Note sentence length, word-choice level, paragraph openings, punctuation (including em-dash frequency), recurring phrases, and transitions. Match those habits. Do not upgrade "stuff" to "elements." The sample outranks the em-dash rule and Personality.

No sample → do not invent a persona. Use the genre gate default.

Do not derive a voice profile from videos or transcripts. Hand that to `creator-voice-profile`.

## Personality (essay register only)

Skip this section for engineering / reference.

Sterile, voiceless essay prose is its own tell. When the content and the author's voice call for it: have opinions, allow mixed feelings, vary rhythm, use "I" if the author already would. Do not add factual claims to create personality. Do not add fragments for showmanship (pattern 31).

Source: `The experiment produced 3 million lines of code. Some developers were impressed while others were skeptical.`

❌ Invented scene to add soul:
> 3 million lines of code, generated while the humans presumably slept.

✅ Essay — stance on facts that are already there:
> I don't know how to feel about 3 million lines of code. Some developers were impressed; others were skeptical.

✅ Engineering — slop stripped, no narrator:
> The experiment produced 3 million lines of code. Some developers were impressed; others were skeptical.

## References

- [references/patterns.md](references/patterns.md) — patterns 1–36, false positives, preserve-these
- [references/word-tiers.md](references/word-tiers.md) — Tier 1 / Tier 2 / clichés, scoped by register

## Worked example

**Source (AI-sounding):** chatbot wrapper + significance inflation + "serves as" / "testament" / em dashes + "it's not just about" + vague "industry observers" + NYT/Wired/The Verge named in the source + emoji list (speed / quality / adoption) + cutoff hedge + "the future looks bright."

❌ Illegal draft — slop is gone, but facts were invented:
> In a 2024 Google study, Codex users finished simple functions 55% faster. Mira, an engineer I interviewed, reviews every Copilot line.

✅ Legal rewrite — only claims that were in the source:
> AI coding assistants are used for documentation, tests, and refactors, and for autocomplete. Coverage in The New York Times, Wired, and The Verge is often cited. Adoption is described as moving from hobby experiments to company-wide rollouts.
>
> The usual pitch is speed, quality, and wider use. The recurring problems named alongside that pitch are hallucinations, bias, and accountability. Suggestion-acceptance is not the same as a correct or useful change.

## Examples

### Example 1: Review-only

**User:** "Review this README for AI tells. Don't rewrite yet."

**Claude:** reads the file → lists `pattern 1: "marking a pivotal moment…"` and `pattern 18: emoji headers` → stops. Zero extra commentary, no rewrite.

### Example 2: PR description (engineering)

**User:** "Humanize this PR description."

**Claude:** names genre `engineering` → embedded mode → strips "serves as a testament" / rule-of-three / uplift closer → returns plain prose, no first person, no invented ticket numbers.

### Example 3: File + sample

**User:** "Humanize `draft.md`. Match the voice in `notes/voice-sample.md`."

**Claude:** reads the sample first → File mode on `draft.md` → matches the sample's sentence length and dash habit → writes the file → reports what changed. Does not invent names to add texture.

## Anti-patterns

- ❌ Inventing a study, quote, or person so the rewrite "has texture." ✅ Flat and sourced, or a `[placeholder]`.
- ❌ Putting "I keep coming back to…" in a PR description or resume. ✅ Genre gate: engineering stays plain.
- ❌ Stripping hyphens from `a high-quality report`. ✅ Keep attributive hyphens; drop them only after the noun (`the report is high quality`). See pattern 26.
- ❌ Applying this skill to your own code-review or commit message unasked. ✅ Opt-in only.
- ❌ Forcing a 25-word sentence into a two-line email to hit a rhythm quota. ✅ Vary rhythm only when the draft is metronomic.
- ❌ Reporting a single em dash or the word `framework` in a design doc as a finding. ✅ Clusters, or high-confidence wrappers. Zero findings is valid.
- ❌ Showing draft + audit + final for "just de-slop this sentence." ✅ Embedded mode: final text only.
- ❌ Treating "match my voice" as a reason to load this skill with no sample. ✅ `creator-voice-profile`, or ask for a sample.

## Notes

- Third-party notices and the MIT copyright text are in [LICENSE](LICENSE).
- Catalog after-examples are fact-safe: they do not add names, dates, or sources that were not in the Before.
