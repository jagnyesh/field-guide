import { verification } from './classify'
import { basename, segments } from './shell'

export type TestRun = {
  readonly runner: 'pytest'
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

function parsePytest(output: string): TestRun | null {
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
  return runnerOf(command) === 'pytest' ? parsePytest(output) : null
}
