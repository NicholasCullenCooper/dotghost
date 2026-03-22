# dotghost

**Keep your agent workflow files in sync across repos.**

dotghost mounts files from a global registry into the current Git repo as symlinks, hides them with local-only Git exclusions, and restores originals on unmount.

Use it for the workflow layer that tends to drift when copied by hand: `AGENTS.md`, agents, commands, workflows, and skills.

## Why

- avoid copy-paste drift across repos
- keep local workflow files out of shared repo clutter
- keep one canonical version in one place

## Install

```bash
npm install -g dotghost
```

## Quick start

```bash
# create a local registry
dotghost init

# or clone a registry you already keep in git
dotghost init https://github.com/NicholasCullenCooper/dotagent.git

# in any Git repo
cd my-project
dotghost mount
dotghost status
dotghost unmount
```

## Demo

```bash
$ dotghost mount
✔ Linked AGENTS.md
✔ Linked commands/review.md
✔ Linked workflows/ship-a-bug-fix.md
✔ Mounted 3 files from registry.

$ dotghost status
🟢 3 files mounted:
   AGENTS.md -> ~/.dotghost/AGENTS.md
   commands/review.md -> ~/.dotghost/commands/review.md
   workflows/ship-a-bug-fix.md -> ~/.dotghost/workflows/ship-a-bug-fix.md
ℹ Registry git: main (clean)

$ dotghost unmount
✔ Unlinked AGENTS.md
✔ Unlinked commands/review.md
✔ Unlinked workflows/ship-a-bug-fix.md
✔ Unmounted: 3 symlinks removed.
```

## How it works

1. dotghost stores your canonical files in `~/.dotghost`.
2. `dotghost mount` symlinks them into the current Git repo.
3. dotghost adds entries to `.git/info/exclude` so the files stay local.
4. If a target already exists, dotghost can stash it and restore it on `dotghost unmount`.

## Registry layout

The current center of gravity is `AGENTS.md` plus structured workflow files such as agents, commands, workflows, and skills.

```text
~/.dotghost/
├── AGENTS.md
├── agents/
│   └── reviewer.md
├── commands/
│   └── release.md
├── workflows/
│   └── ship-a-feature.md
└── skills/
   ├── debugging/
   │   └── SKILL.md
   └── code-review/
      └── SKILL.md
```

Anything in the registry can be mounted into a repo, including directory-based skills with support files.

As registries grow, keeping the default surface compact matters. dotghost already supports mounting the
whole registry cleanly; selective mounting and profiles become more valuable once a registry starts
carrying candidate or experimental material.

## Conflict handling

If a file already exists in the project, dotghost prompts you:

```text
⚠ AGENTS.md already exists in this project.
   Local:    1284 bytes
   Registry: 3502 bytes
   [o]verwrite (stash original)  [s]kip  [d]iff  >
```

For automation:

```bash
dotghost mount --force
dotghost mount --skip-conflicts
```

## Registry sync

If your registry is a Git repo:

```bash
dotghost pull
dotghost diff
dotghost push
```

## Release

This package publishes to npm from a GitHub Release. If you use `just`, run:

```bash
just release
```

That script checks prerequisites, bumps the version, pushes `main` and tags, and creates the GitHub Release.

## Roadmap

Planned features are in [ROADMAP.md](ROADMAP.md).

## License

MIT
