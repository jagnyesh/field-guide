import { verification } from './classify'
import { basename, segments } from './shell'

// Which tests a run could have reported on: all of them, those under some paths, or unknown
// (selected by keyword, marker, or last failures).
export type RunScope = 'all' | 'unknown' | readonly string[]

export type Runner = 'pytest' | 'vitest' | 'jest'

export type TestRun = {
  readonly runner: Runner
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

const NAMED: Readonly<Record<string, Runner>> = { pytest: 'pytest', 'py.test': 'pytest', vitest: 'vitest', jest: 'jest' }

// Script runners that start whatever runner the project configured.
const WRAPPERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'tox', 'nox', 'make'])

// The runner a command names; 'unnamed' when a script runner starts an unnamed one (`npm test`);
// null for anything else, including runners not read here (`cargo test`, `go test`).
function runnerOf(command: string): Runner | 'unnamed' | null {
  let wrapped = false
  for (const segment of segments(command)) {
    if (verification(segment.argv) !== 'tested') continue
    for (const arg of segment.argv) if (NAMED[basename(arg)]) return NAMED[basename(arg)]
    if (WRAPPERS.has(basename(segment.argv[0] ?? ''))) wrapped = true
  }
  return wrapped ? 'unnamed' : null
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

const VITEST_SUMMARY = /^\s*Tests\s+(.+?)\s+\(\d+\)\s*$/
const VITEST_FAIL = /^\s*FAIL\s+(.+?)\s*$/
const VITEST_SUITE = /^(\S+) \[ \S+ \]$/

function countOf(text: string, word: string): number {
  return Number(new RegExp(`(\\d+) ${word}`).exec(text)?.[1] ?? 0)
}

function parseVitest(output: string): Omit<TestRun, 'scope'> | null {
  const lines = output.split('\n')
  const summary = lines.map(line => VITEST_SUMMARY.exec(line)).filter(Boolean).pop()
  if (!summary) return null
  const ids = new Set<string>()
  let errors = 0
  for (const line of lines) {
    const fail = VITEST_FAIL.exec(line)
    if (!fail) continue
    const suite = VITEST_SUITE.exec(fail[1])
    if (suite) errors++
    ids.add(suite ? suite[1] : fail[1])
  }
  return {
    runner: 'vitest',
    passed: countOf(summary[1], 'passed'),
    failed: countOf(summary[1], 'failed'),
    errors,
    skipped: countOf(summary[1], 'skipped'),
    failingIds: [...ids],
  }
}

const JEST_SUMMARY = /^Tests:\s+(.+?),\s+\d+ total/
const JEST_FILE = /^(?:FAIL|PASS)\s+(\S+)/
const JEST_FAILURE = /^\s*● (.+?)\s*$/

function parseJest(output: string): Omit<TestRun, 'scope'> | null {
  const lines = output.split('\n')
  const summary = lines.map(line => JEST_SUMMARY.exec(line.trim())).filter(Boolean).pop()
  if (!summary) return null
  const ids = new Set<string>()
  let errors = 0
  let file = ''
  for (const line of lines) {
    const header = JEST_FILE.exec(line)
    if (header) {
      file = header[1]
      continue
    }
    const failure = JEST_FAILURE.exec(line)
    if (!failure || !file) continue
    if (failure[1] === 'Test suite failed to run') {
      errors++
      ids.add(file)
    } else {
      ids.add(`${file} › ${failure[1]}`)
    }
  }
  return {
    runner: 'jest',
    passed: countOf(summary[1], 'passed'),
    failed: countOf(summary[1], 'failed'),
    errors,
    skipped: countOf(summary[1], 'skipped'),
    failingIds: [...ids],
  }
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

const JS_SELECTORS = new Set(['-t', '--testNamePattern', '--changed', '-o', '--onlyChanged', '--related', '--findRelatedTests', '--lastCommit'])
const JS_VALUED = new Set(['--reporter', '--config', '-c', '--project', '--root', '--dir', '--coverage.provider', '--maxWorkers', '-w'])

// vitest and jest take file filters as positional arguments, after `run` for vitest.
function jsScope(command: string, runner: Runner): RunScope {
  for (const segment of segments(command)) {
    const at = segment.argv.findIndex(arg => basename(arg) === runner)
    if (at === -1) continue
    const paths: string[] = []
    const args = segment.argv.slice(at + 1).filter((arg, i) => !(i === 0 && (arg === 'run' || arg === 'watch')))
    for (let i = 0; i < args.length; i++) {
      const flag = args[i].split('=')[0]
      if (JS_SELECTORS.has(flag)) return 'unknown'
      if (JS_VALUED.has(args[i])) i++
      else if (!args[i].startsWith('-')) paths.push(args[i].replace(/^\.\//, ''))
    }
    return paths.length ? paths : 'all'
  }
  return 'all'
}

const PARSERS: Readonly<Record<Runner, (output: string) => Omit<TestRun, 'scope'> | null>> = {
  pytest: parsePytest,
  vitest: parseVitest,
  jest: parseJest,
}

// A test run read from a command and the output the model read, or null when it isn't one we can read.
// A command that names no runner (`npm test`) is read by whichever runner's summary its output carries.
export function parseTestRun(command: string, output: string): TestRun | null {
  const named = runnerOf(command)
  if (named === null) return null
  const candidates: Runner[] = named === 'unnamed' ? ['pytest', 'vitest', 'jest'] : [named]
  for (const runner of candidates) {
    const run = PARSERS[runner](output)
    if (run) return { ...run, scope: named === 'unnamed' ? 'all' : runner === 'pytest' ? pytestScope(command) : jsScope(command, runner) }
  }
  return null
}

// pytest joins file and test with "::", vitest with " > ", jest with " › ".
const ID_SEPARATOR = /::| > | › /

// The file part of a test id.
export function testIdFile(id: string): string {
  return id.split(ID_SEPARATOR)[0]
}

// Whether a run could have reported on the test with this id.
export function covers(run: TestRun, id: string): boolean {
  if (run.scope === 'all') return true
  if (run.scope === 'unknown') return false
  const file = testIdFile(id)
  return run.scope.some(path => file === path || file.startsWith(path.replace(/\/$/, '') + '/'))
}
