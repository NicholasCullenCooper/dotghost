# dotghost Roadmap

## v1.0 — Foundation (current)

The core mount/unmount/sync cycle with stash-based conflict resolution.

| Feature | Status |
| --- | --- |
| `dotghost init` / `dotghost init <url>` | Done |
| `dotghost mount` with root-level symlinks | Done |
| `dotghost unmount` with symlink cleanup | Done |
| `dotghost status` | Done |
| `dotghost pull` / `dotghost push` / `dotghost diff` | Done |
| Stash/restore for file collisions | Done |
| Interactive conflict resolution (overwrite/skip/diff) | Done |
| `--force` and `--skip-conflicts` flags | Done |
| Nested file support (e.g. `.github/copilot-instructions.md`) | Done |
| Cross-platform symlinks (Windows junction support) | Done |

---

## v1.1 — Selective mounting

Mount subsets of the registry instead of everything.

| Feature | Description |
| --- | --- |
| `dotghost mount <glob>` | Mount only matching files: `dotghost mount "AGENTS.md"` or `dotghost mount "skills/*"` |
| `dotghost mount --exclude <glob>` | Mount everything except matches |
| `.dotghostignore` in registry | Permanent exclusion list (like `.gitignore` for the registry) |

**Why:** As the registry grows, not every file belongs in every project. A Go project doesn't need `.cursorrules` with React conventions. This is the lightest way to solve that without profiles.

---

## v1.2 — Profiles

Named subsets of the registry for different project types.

| Feature | Description |
| --- | --- |
| `dotghost.profiles.json` in registry | Declare named profiles mapping to file lists/globs |
| `dotghost mount --profile <name>` | Mount only files in that profile |
| `dotghost profiles` | List available profiles |

Example `dotghost.profiles.json`:
```json
{
  "go": ["AGENTS.md", "CLAUDE.md", ".github/copilot-instructions.md"],
  "react": ["AGENTS.md", ".cursorrules", "skills/react-*"],
  "full": ["**/*"]
}
```

**Why:** Profiles emerge naturally once you have 10+ files in the registry and 5+ project types. The selective mounting in v1.1 proves the need; profiles codify common selections.

---

## v1.3 — Project-specific context generation

Auto-generate project-specific agent instructions by scanning the codebase.

| Feature | Description |
| --- | --- |
| `dotghost generate` | Scan project structure and generate a `PROJECT.md` with build commands, architecture, conventions |
| Stack detection | Detect `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, etc. |
| LLM integration (optional) | Shell out to `claude`, `opencode`, or Copilot CLI for richer generation |
| Template-based fallback | Generate useful context without an LLM using heuristics and templates |

**Why:** The biggest remaining friction is the project-specific half of agent instructions. `claude init` and `opencode /init` solve this but each generates its own format. A unified generator that outputs to a standard format means your universal AGENTS.md + generated PROJECT.md covers both halves.

**Open questions:**
- Which LLM backend to default to? Subprocess `claude`? Copilot API? Configurable?
- Should the generated file be committed or stashed like the rest?
- How much can we do without an LLM (pure heuristic detection)?

---

## v1.4 — Drift detection

Detect when local project instructions have drifted from global standards.

| Feature | Description |
| --- | --- |
| `dotghost check` | Compare mounted files against registry, report any local modifications |
| `dotghost update` | Show recommended changes to project-specific files based on registry changes |
| Post-pull hooks | After `dotghost pull`, flag any mounted workspaces that need re-mounting |

**Why:** The registry evolves. After a `dotghost pull` brings new universal rules, you want to know which projects are running stale instructions. This is the "did I forget to re-mount?" safety net.

---

## v1.5 — Multi-source registry

Support multiple git repos feeding into one registry.

| Feature | Description |
| --- | --- |
| `dotghost source add <name> <url>` | Add a named source repo |
| `dotghost source remove <name>` | Remove a source |
| `dotghost source list` | Show all sources |
| Namespaced mounting | Sources mount into `~/.dotghost/<source-name>/` |
| `dotghost pull` updates all sources | Pulls each source independently |

**Why:** Teams want to share a base set of agent instructions while individuals layer personal overrides on top. Multi-source enables: team repo for shared conventions + personal repo for your skills and preferences.

**Risks:** Name collisions across sources. Precedence rules needed (last-wins? explicit priority?). Complexity jump is significant.

---

## v2.0 — Merge engine

Intelligently merge global and local agent instructions instead of replace.

| Feature | Description |
| --- | --- |
| Section-aware merge | Combine universal sections from registry with project-specific sections from the local file |
| Conflict markers | When sections collide, show conflict markers for manual resolution |
| `dotghost merge` | Interactive merge tool |
| LLM-assisted merge | Optionally use an LLM to reconcile conflicting instructions |

**Why:** The stash-and-replace model works for fully global files. But some files (like `AGENTS.md`) naturally have a universal half and a project-specific half. True merging means you keep both without manual copy-paste. This is the hardest feature and the one most likely to need an LLM to do well.

**Deferred until real usage proves the stash model is insufficient.**

---

## Unprioritized ideas

| Idea | Notes |
| --- | --- |
| `dotghost watch` | Watch registry for changes and auto-remount in all active workspaces |
| Shell hooks | Auto-mount on `cd` into a git repo (via shell integration or direnv-style `.envrc`) |
| `dotghost list` | List all files in the registry without mounting |
| `dotghost edit <file>` | Open a registry file in `$EDITOR` |
| npm postinstall hook | Auto-mount after `npm install` in a project |
| Config file (`~/.dotghost.json`) | Global config for default profile, preferred LLM backend, etc. |
| `dotghost link <file>` | Mount a single file from registry on demand |
| Workspace tracking | Remember which projects have been mounted, re-mount all with `dotghost mount --all` |
| Export/import | `dotghost export` to create a shareable archive of your registry |
