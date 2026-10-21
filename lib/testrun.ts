import { verification } from './classify'
import { basename, segments } from './shell'

// Which tests a run could have reported on: all of them, those under some paths, or unknown
// (selected by keyword, marker, or last failures).
export type RunScope = 'all' | 'unknown' | readonly string[]

export type TestRun = {
  readonly runner: 'pytest'
  readonly scope: RunScope
  readonly passed: number
  readonly failed: number
  readonly errors: number
  readonly skipped: number
  // Whole ids, parameters included: for the developer's own pane only (ADR 0003).
  readonly failingIds: readonly string[]
}

// pytest's closing line, e.g. "2 failed, 3 passed, 1 skipped, 1 warning in 0.01s".
const PYTEST_SUMMARY = /^=*\s*((?:\d+ (?:failed|passed|skipped|deselected|xfailed|xpassed|errors?|warnings?)(?:, )?)+) in [\d.]+s/
const PYTEST_FAILING = /^(FAILED|ERROR) (\S+)/

function runnerOf(command: string): 'pytest' | null {
  for (const segment of segments(command)) {
    if (verification(segment.argv) !== 'tested') continue
    if (segment.argv.some(arg => basename(arg) === 'pytest' || basename(arg) === 'py.test')) return 'pytest'
  }
  return null
}

const PYTEST_SELECTORS = new Set(['-k', '-m', '--lf', '--last-failed', '--deselect', '--sw', '--stepwise'])
const PYTEST_VALUED = new Set(['-k', '-m', '-p', '-c', '-o', '-n', '-W', '--rootdir', '--deselect', '--ignore', '--maxfail', '--tb', '--junitxml', '--cov', '--basetemp', '--confcutdir', '--log-level', '--durations'])

function pytestScope(command: string): RunScope {
  for (const segment of segments(command)) {
    const at = segment.argv.findIndex(arg => basename(arg) === 'pytest' || basename(arg) === 'py.test')
    if (at === -1) continue
    const paths: string[] = []
    const args = segment.argv.slice(at + 1)
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      const flag = arg.split('=')[0]
      if (PYTEST_SELECTORS.has(flag)) return 'unknown'
      if (PYTEST_VALUED.has(arg)) i++
      else if (!arg.startsWith('-')) paths.push(arg.split('::')[0].replace(/^\.\//, ''))
    }
    return paths.length ? paths : 'all'
  }
  return 'unknown'
}

function parsePytest(output: string): Omit<TestRun, 'scope'> | null {
  const lines = output.split('\n').map(line => line.trimEnd())
  const summary = lines.map(line => PYTEST_SUMMARY.exec(line.trim())).filter(Boolean).pop()
  if (!summary) return null
  const count = (word: RegExp) => Number(new RegExp(`(\\d+) ${word.source}`).exec(summary[1])?.[1] ?? 0)
  const failingIds = lines.flatMap(line => {
    const match = PYTEST_FAILING.exec(line)
    return match ? [match[2]] : []
  })
  return {
    runner: 'pytest',
    passed: count(/passed/),
    failed: count(/failed/),
    errors: count(/errors?/),
    skipped: count(/skipped/),
    failingIds,
  }
}

// A test run read from a command and the output the model read, or null when it isn't one we can read.
export function parseTestRun(command: string, output: string): TestRun | null {
  if (runnerOf(command) !== 'pytest') return null
  const run = parsePytest(output)
  return run && { ...run, scope: pytestScope(command) }
}

// Whether a run could have reported on the test with this id.
export function covers(run: TestRun, id: string): boolean {
  if (run.scope === 'all') return true
  if (run.scope === 'unknown') return false
  const file = id.split('::')[0]
  return run.scope.some(path => file === path || file.startsWith(path.replace(/\/$/, '') + '/'))
}
