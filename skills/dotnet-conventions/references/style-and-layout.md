# Style and layout

Sources: C# identifier names and coding conventions (Microsoft Learn); Framework Design Guidelines, names of namespaces. Member order, one type per file and folder placement are common convention, not a Microsoft rule.

Order of authority: `.editorconfig`, then the file you are editing, then the files beside it, then this file. Use this file only for a point where those are silent.

## Names

- `PascalCase`: types, namespaces, methods, properties, events, constants (including private ones), enum members, record parameters.
- `camelCase`: parameters, locals, primary-constructor parameters of a class or struct.
- Private and internal fields: `_camelCase`. Static fields: `s_camelCase` only if the project already uses it.
- Interfaces start with `I`. Attribute types end in `Attribute`. Type parameters start with `T` (`TSession`, or plain `T` for one).
- Async methods that return a task end in `Async` where the neighbours do; a controller action keeps the neighbours' action naming.
- Enum types: singular noun, plural for `[Flags]`. Avoid abbreviations except well-known ones. No two consecutive underscores. Acronyms follow the project; with none, `Id` and `Url`, not `ID` and `URL`.
- A name says what the thing is, not its type: `iterations`, not `inputInt`.

## Members and files

- One top-level type per file, and the file name is the type name.
- Order inside a type follows the file. With none to follow: fields, constructors, properties, methods, nested types; within each group, public before private.
- Make a member `private` or `internal` until something needs more. No public field; use a property. Mark a field `readonly` when it is only set in the constructor.
- Put `using` directives above the namespace, never inside it.
- Namespace and file layout: a new file declares the namespace its folder implies (the project's root namespace plus the folder path), in the same form its neighbours use: file-scoped (`namespace X;`, C# 10) or block.
- Namespace shape: `<Company>.<Product>[.<Feature>]`. Do not name a namespace after an org chart. Do not give a type the same name as its namespace, and do not use a generic type name (`Node`, `Message`, `Log`) that clashes with a framework type.

## Folders

- A new type goes in the folder that holds its siblings of the same role (controllers with controllers, repositories with repositories). The layering already in the project decides this, never this file.
- Create a folder only when no folder fits and the task asks for the new role. Say so under `Changed`.
- A type used by one class stays in that class's file only if it is private and small; otherwise it gets its own file.

## Syntax

- Use only syntax the project's `LangVersion` supports (see `dotnet-framework.md` for the .NET Framework limit).
- Where the file already uses the newer form, match it. Otherwise prefer: `var` when the type is obvious from the right side (a `new`, a cast, a literal), the explicit type otherwise, and always in a `foreach`; string interpolation; `Func<>` and `Action<>` over a new delegate type; `&&` and `||` over `&` and `|` in conditions; the `using` statement over `try`/`finally` that only disposes.
- Newer forms: file-scoped namespaces, target-typed `new()`, collection expressions (`[a, b]`), raw string literals, primary constructors, `required` members. Use them when the language version allows and the neighbours do not use the older form; with no neighbours, use them.
- Layout: four spaces, Allman braces, one statement and one declaration per line, a blank line between members.

## Comments

- If the code needs no comment, add none. A clear name and a small method carry the meaning.
- Allowed only when the reason behind the code is not visible from the code, and then one short line that states the reason. Never a multi-line block.
- Never: a comment that restates the next line or the method name, an XML doc comment that repeats the signature, a section header, or a ticket or task number. This overrides the Microsoft advice to put XML comments on public members.
- Do not edit or delete comments other people wrote.

- ❌ `// Get the open orders for the customer` above `GetOpenByCustomerAsync`.
- ✅ `// The API returns UTC; the store keeps local time.` above the one line that converts between them.
