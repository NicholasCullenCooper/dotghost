release level="patch" message="chore: prepare release":
    #!/usr/bin/env bash
    set -euo pipefail
    command -v git >/dev/null
    command -v npm >/dev/null
    command -v node >/dev/null
    command -v gh >/dev/null
    git rev-parse --is-inside-work-tree >/dev/null
    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [[ "$branch" != "main" ]]; then
    echo "Release must be run from main. Current branch: $branch" >&2
    exit 1
    fi
    if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Working tree is not clean. Commit or stash your changes before releasing." >&2
    exit 1
    fi
    npm version {{ level }}
    version="$(node -p "JSON.parse(require('fs').readFileSync('package.json', 'utf8')).version")"
    git push origin main --follow-tags
    gh release create "v$version" --generate-notes
