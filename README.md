# dotghost

**Ghost your AI agent config into any repo. Leave no trace.**

AI coding agents (Cursor, Claude Code, Copilot, Codex) need context files -- `AGENTS.md`, `.cursorrules`, `.github/copilot-instructions.md`. But copy-pasting these across repos means fragmented context, and committing them pollutes shared codebases.

dotghost fixes both. It symlinks your global agent config into any project root, hides everything from Git using local-only exclusion, and restores originals when you unmount.

## How it works

1. **Symlinks, not copies.** Edits flow back to your global registry instantly.
2. **Invisible to Git.** Uses `.git/info/exclude` -- never touches `.gitignore`, never commits anything.
3. **Stash/restore.** If a file already exists, dotghost backs it up and restores it on unmount.

## Install

```bash
npm install -g dotghost
```

## Usage

```bash
# Set up your global registry (or clone an existing one)
dotghost init
dotghost init https://github.com/yourname/dotagent.git

# Mount into any git repo
cd my-project
dotghost mount

# Check what's mounted
dotghost status

# Unmount and restore originals
dotghost unmount

# Sync registry with git
dotghost pull
dotghost push
dotghost diff
```

## Your registry

Populate `~/.dotghost` with the files you want available everywhere:

```
~/.dotghost/
├── AGENTS.md
├── CLAUDE.md
├── .cursorrules
├── .github/
│   └── copilot-instructions.md
└── skills/
    ├── debugging.md
    └── code-review.md
```

## Collision handling

When a file already exists in the project, dotghost prompts you:

```
⚠ AGENTS.md already exists in this project.
   Local:    1284 bytes
   Registry: 3502 bytes
   [o]verwrite (stash original)  [s]kip  [d]iff  >
```

Or use flags for CI/automation:

```bash
dotghost mount --force           # Overwrite all, stash originals
dotghost mount --skip-conflicts  # Skip all conflicts
```

## Status

```
🟢 3 files mounted:
   AGENTS.md -> ~/.dotghost/AGENTS.md
   CLAUDE.md -> ~/.dotghost/CLAUDE.md
   .cursorrules -> ~/.dotghost/.cursorrules
📦 1 original stashed:
   AGENTS.md (2026-03-17)
ℹ Registry git: main (clean)
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features: selective mounting, profiles, project context generation, drift detection, multi-source registries.

## License

MIT
