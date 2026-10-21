#!/usr/bin/env bash
# Type-checks the mod with TypeScript 5.6.3 against the engine's declarations.
#   scripts/typecheck.sh [path to claude-code.d.ts]
# Default: the declarations the engine writes beside the mod when it loads it.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
types="${1:-$root/.claude-plugin/types/claude-code/index.d.ts}"
[ -f "$types" ] || { echo "typecheck: no declarations at $types; pass the path to claude-code.d.ts" >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'command rm -rf "$tmp"' EXIT
cat > "$tmp/tsconfig.json" <<JSON
{
  "compilerOptions": {
    "strict": true, "noEmit": true, "target": "ES2022", "module": "ESNext",
    "moduleResolution": "Bundler", "lib": ["ES2023"], "types": [],
    "jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"
  },
  "include": ["$types", "$root/types/**/*", "$root/hooks/**/*", "$root/lib/**/*"]
}
JSON
npx --yes -p typescript@5.6.3 tsc -p "$tmp/tsconfig.json"
