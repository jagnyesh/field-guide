import { basename, segments } from './shell'
import type { Segment } from './shell'

export type StepKind = 'read' | 'search' | 'edit' | 'run' | 'verify' | 'delegate' | 'other'

export type Verification = 'tested' | 'checked'

const BY_TOOL: Readonly<Record<string, StepKind>> = {
  Read: 'read',
  WebFetch: 'read',
  Grep: 'search',
  Glob: 'search',
  WebSearch: 'search',
  Edit: 'edit',
  MultiEdit: 'edit',
  Write: 'edit',
  NotebookEdit: 'edit',
  Agent: 'delegate',
  Task: 'delegate',
  SubagentHandback: 'delegate',
}

const PRINTERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'bat', 'nl', 'wc'])
const SEARCHERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ag', 'find', 'fd', 'ls', 'tree'])
const GIT_LOOKS = new Set(['status', 'diff', 'log', 'show', 'blame', 'grep', 'branch'])
const NEUTRAL = new Set(['cd', 'pushd', 'popd', 'true', 'echo', 'printf'])
const RUNNERS = new Set(['pytest', 'py.test', 'vitest', 'jest', 'mocha', 'rspec', 'phpunit', 'tox', 'nox'])
const CHECKERS = new Set(['ruff', 'flake8', 'pylint', 'mypy', 'pyright', 'eslint', 'tsc', 'prettier', 'black', 'biome', 'clippy'])
const LAUNCHERS = new Set(['npx', 'bunx', 'pnpx'])
const SCRIPT_RUNNERS = new Set(['npm', 'pnpm', 'yarn', 'bun'])
const PY_RUNNERS = new Set(['uv', 'poetry', 'pdm', 'hatch', 'pipenv'])
const BUILD_TASKS = /^(lint|typecheck|type-check|check|build|tsc)(:.*)?$/
const TEST_TASKS = /^test(:.*)?$/

function isPython(program: string): boolean {
  return /^python(\d+(\.\d+)?)?$/.test(basename(program))
}

// What a command verifies, if anything, after any launcher (`npx`, `uv run`, `python -m`) in front of it.
export function verification(argv: readonly string[]): Verification | null {
  if (argv.length === 0) return null
  const program = basename(argv[0])
  if (LAUNCHERS.has(program)) return verification(argv.slice(1))
  if (PY_RUNNERS.has(program) && argv[1] === 'run') return verification(argv.slice(2))
  if (isPython(argv[0]) && argv[1] === '-m') return verification(argv.slice(2))
  if (RUNNERS.has(program)) return 'tested'
  if (CHECKERS.has(program)) return 'checked'
  if (SCRIPT_RUNNERS.has(program)) {
    const task = argv[1] === 'run' ? argv[2] : argv[1]
    if (task === undefined) return null
    if (TEST_TASKS.test(task)) return 'tested'
    if (BUILD_TASKS.test(task)) return 'checked'
    return null
  }
  if (program === 'go') return argv[1] === 'test' ? 'tested' : argv[1] === 'vet' || argv[1] === 'build' ? 'checked' : null
  if (program === 'cargo') return argv[1] === 'test' ? 'tested' : ['check', 'clippy', 'build'].includes(argv[1] ?? '') ? 'checked' : null
  return null
}

// The strongest verification any part of a command line performs.
export function commandVerification(command: string): Verification | null {
  const found = segments(command).map(segment => verification(segment.argv))
  return found.includes('tested') ? 'tested' : found.includes('checked') ? 'checked' : null
}

function segmentKind(segment: Segment): StepKind | null {
  if (segment.writesFile) return 'run'
  const argv = segment.argv
  if (argv.length === 0) return null
  const program = basename(argv[0])
  if (verification(argv)) return 'verify'
  if (NEUTRAL.has(program)) return null
  if (PRINTERS.has(program)) return 'read'
  if (program === 'sed') return argv.includes('-n') && !argv.some(arg => arg.startsWith('-i')) ? 'read' : 'run'
  if (SEARCHERS.has(program)) return 'search'
  if (program === 'git' && GIT_LOOKS.has(argv[1] ?? '')) return 'search'
  return 'run'
}

// Strongest first: one verify makes the whole command a verify; any other run makes it a run.
const PRECEDENCE: readonly StepKind[] = ['verify', 'run', 'read', 'search']

function shellKind(command: string, isReadOnly: boolean | undefined): StepKind {
  const kinds = new Set(segments(command).map(segmentKind).filter((k): k is StepKind => k !== null))
  const kind = PRECEDENCE.find(k => kinds.has(k)) ?? 'run'
  if (isReadOnly === false && (kind === 'read' || kind === 'search')) return 'run'
  return kind
}

export function classify(
  tool: string,
  input: Readonly<Record<string, unknown>>,
  facts: { readonly isReadOnly?: boolean } = {},
): StepKind {
  if (tool === 'Bash' && typeof input.command === 'string') return shellKind(input.command, facts.isReadOnly)
  return BY_TOOL[tool] ?? 'other'
}
