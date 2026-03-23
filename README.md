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

## Development

```bash
npm install
npm run build
node dist/index.js --help
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
dotghost mount --profile core
dotghost mount "AGENTS.md" "workflows/**"
dotghost mount --exclude "skills/**"
dotghost mount --include-ignored "candidate/**"
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

The registry can also define named mount surfaces in `dotghost.profiles.json`.

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
dotghost mount --profile core
dotghost mount "commands/**" --exclude "commands/release.md"
dotghost mount --include-ignored "candidate/**"
```

## Profiles

If your registry contains a `dotghost.profiles.json` file, you can mount named selections instead
of spelling out globs every time.

Example:

```json
{
   "base": {
      "include": ["AGENTS.md", "CLAUDE.md", "commands/**"]
   },
   "release-manager": {
      "extends": "base",
      "description": "Release-oriented workflows and skills",
      "include": ["workflows/**", "skills/release-management/**"],
      "exclude": ["commands/debug.md"]
   }
}
```

Commands:

```bash
dotghost profiles
dotghost mount --profile core
dotghost mount --profile release-manager --exclude "workflows/**"
```

If profiles are available in the active registry, `dotghost mount --help` will list them directly.

If you run plain `dotghost mount` with no profile or glob selection, dotghost still mounts the full visible registry surface, but it now suggests a narrower profile when one is available.

Rules:

- `extends` can be a profile name or an array of profile names
- parent profiles are resolved before child profile includes and excludes are applied
- cycles and unknown parent profile names are treated as configuration errors
- `--profile <name>` seeds the mount selection with the profile's include globs
- profile excludes are applied before CLI excludes are added
- CLI include patterns are added on top of the selected profile
- `--include-ignored` overrides `.dotghostignore`, and a profile can also opt into hidden content with `includeIgnored: true`
- `dotghost.profiles.json` itself is never mounted into target repositories

## Selective mounting

You can mount only part of the registry by passing one or more registry-relative globs to
`dotghost mount`.

Examples:

```bash
dotghost mount "AGENTS.md"
dotghost mount "workflows/**" "skills/testing/**"
dotghost mount "skills/debugging"
dotghost mount --exclude "skills/**"
dotghost mount "**" --exclude "workflows/**"
dotghost mount --include-ignored "candidate/**"
```

Rules:

- patterns are matched against registry-relative paths
- plain file paths match that file
- plain directory paths match everything under that directory
- `*` matches within one path segment
- `**` matches across path segments
- quote globs so your shell does not expand them before dotghost sees them

## Registry defaults with .dotghostignore

If your registry contains a `.dotghostignore` file, dotghost treats it as the default hidden surface.

Example:

```text
# keep non-default material out of normal mounts
candidate/**
experimental/**
```

Rules:

- patterns use the same registry-relative matching rules as `dotghost mount`
- blank lines and lines starting with `#` are ignored
- `.dotghostignore` itself is never mounted into target repositories
- `dotghost.profiles.json` is also never mounted into target repositories
- use `--include-ignored` when you intentionally want to mount hidden material

This keeps the default mounted surface compact without forcing a separate registry for early-stage content.

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

Release notes live in [docs/releases/v1.2.0.md](docs/releases/v1.2.0.md), and the rolling summary lives in [CHANGELOG.md](CHANGELOG.md).

## Roadmap

Planned features are in [ROADMAP.md](ROADMAP.md).

## License

MIT
