# Changelog

## Unreleased

## v1.4.0

Released: 2026-03-24

Highlights:

- full cross-platform support for Windows, macOS, and Linux

Fixes:

- replaced Unicode emoji output (`✔ ⚠ ✖ ℹ 🟢 ⚪️ 📦`) with ASCII-safe fallbacks on Windows terminals that lack Unicode support (Windows Terminal and VS Code terminals still get full Unicode)
- `diff` comparison during mount conflict resolution now uses `git diff --no-index` on Windows where the system `diff` command is not available
- fixed all symlink path comparisons (mount, unmount, check, update) to handle Windows junction `\\?\` prefix and case-insensitive filesystems
- `.git/info/exclude` is now read with CRLF-aware line splitting
- all file reads now strip UTF-8 BOM when present, preventing JSON parse failures on Windows-edited config files
- `desktop.ini` added to the noise-file skip list alongside `.DS_Store` and `Thumbs.db`
- all `writeFileSync` calls now specify explicit `"utf-8"` encoding
- `fs.readFileSync` for `package.json` now uses a file path instead of a URL object for broader Node.js compatibility
- added `dotghost check` to inspect mounted links for drift and missing registry sources
- added `dotghost update` to repair relinkable mounted files locally

## v1.3.0

Released: 2026-03-23

Highlights:

- added profile composition through `extends` in `dotghost.profiles.json`
- profile resolution now detects cycles and unknown parent profile names early

Behavior changes:

- profiles can now inherit from one or more parent profiles
- composed includes and excludes are deduplicated while preserving parent-first order
- invalid profile graphs fail fast with clear configuration errors

## v1.2.0

Released: 2026-03-23

Highlights:

- rewrote the CLI in TypeScript with a modular command/runtime layout
- added selective mounting with include globs and `--exclude`
- added registry-level defaults with `.dotghostignore` and `--include-ignored`
- added named profiles via `dotghost.profiles.json`, `dotghost profiles`, and `dotghost mount --profile <name>`
- improved profile UX with dynamic help output, typo suggestions, and default-profile guidance when mounting the full visible registry surface
- hardened registry traversal so control-plane files and common OS noise files are not mounted into target repositories

Behavior changes:

- the published npm package now ships compiled output from `dist/`
- `dotghost.profiles.json` and `.dotghostignore` are consumed by dotghost but never mounted into target repositories
- common OS metadata files such as `.DS_Store` and `Thumbs.db` are ignored during registry traversal

Upgrade notes:

- Node 18 or newer is required
- if you publish or install from git, the package now builds through TypeScript during `prepare`
- registries that want named mount surfaces should add `dotghost.profiles.json`

## v1.0.1

Released before this changelog was introduced.

- maintenance release on top of the original JavaScript CLI foundation