# Changelog

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