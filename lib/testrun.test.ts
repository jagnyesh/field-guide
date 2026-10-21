import { describe, expect, test } from 'claude-code/testing'
import { OUTPUT } from './fixtures/pytest'
import { OUTPUT as VITEST } from './fixtures/vitest'
import { OUTPUT as JEST } from './fixtures/jest'
import { parseTestRun } from './testrun'

const PYTEST = '.venv/bin/python -m pytest -q'

describe('Test Output Parser: pytest', () => {
  test('reads counts and failing test ids from a run, with or without the exit-code line the shell tool adds', async () => {
    for (const output of [OUTPUT.quiet, OUTPUT['framed-fail']]) {
      expect(parseTestRun(PYTEST, output)).toEqual({
        runner: 'pytest',
        scope: 'all',
        passed: 3,
        failed: 2,
        errors: 0,
        skipped: 0,
        failingIds: ['tests/test_legacy.py::test_legacy_format', 'tests/test_ratelimit.py::test_over_limit'],
      })
    }
  })

  const counts = (output: string) => {
    const run = parseTestRun(PYTEST, output)
    return run && [run.passed, run.failed, run.errors, run.skipped, run.failingIds.length]
  }

  test('reads the verbose default output, an all-pass run, and a run where every test was deselected', async () => {
    expect(counts(OUTPUT.default)).toEqual([3, 2, 0, 0, 2])
    expect(counts(OUTPUT['all-pass'])).toEqual([3, 0, 0, 0, 0])
    expect(counts(OUTPUT.none)).toEqual([0, 0, 0, 0, 0])
  })

  test('reads warnings and skips, a collection error, and a failing parametrised test', async () => {
    expect(counts(OUTPUT['warnings-skips'])).toEqual([4, 2, 0, 1, 2])
    const broken = parseTestRun(PYTEST, OUTPUT['collection-error'])
    expect([broken?.errors, broken?.failingIds]).toEqual([1, ['tests/test_broken.py']])
    expect(parseTestRun(PYTEST, OUTPUT['param-fail'])?.failingIds).toContain('tests/test_lookup.py::test_lookup[FG_MARKER_7f3a]')
  })

  test('another runner, or output with no closing summary, is not a run it can read', async () => {
    expect(parseTestRun('cargo test', OUTPUT.quiet)).toBeNull()
    expect(parseTestRun(PYTEST, 'Traceback (most recent call last):\n  ImportError: no module named x')).toBeNull()
    expect(parseTestRun('ruff check .', 'All checks passed!')).toBeNull()
  })

  test('knows which tests a run could have reported on', async () => {
    const scope = (command: string) => parseTestRun(command, OUTPUT['all-pass'])?.scope
    expect(scope('pytest -q')).toBe('all')
    expect(scope('pytest -q tests/test_lookup.py ./tests/unit/')).toEqual(['tests/test_lookup.py', 'tests/unit/'])
    expect(scope('pytest -q tests/test_x.py::test_y')).toEqual(['tests/test_x.py'])
    expect(scope('pytest -k lookup')).toBe('unknown')
    expect(scope('pytest --lf')).toBe('unknown')
    expect(scope('pytest --tb short -q')).toBe('all')
  })
})

describe('Test Output Parser: vitest', () => {
  const VITEST_RUN = 'npx vitest run'
  const read = (output: string) => {
    const run = parseTestRun(VITEST_RUN, output)
    return run && { runner: run.runner, counts: [run.passed, run.failed, run.errors, run.skipped], failingIds: run.failingIds }
  }

  test('reads counts and failing ids, one per test, named by file and test path', async () => {
    expect(read(VITEST.fail)).toEqual({
      runner: 'vitest',
      counts: [2, 2, 0, 1],
      failingIds: ['tests/limit.test.js > statusFor > over limit', 'tests/limit.test.js > lookup FG_MARKER_7f3a'],
    })
  })

  test('reads an all-pass run, and a suite that failed to load as an error for its file', async () => {
    expect(read(VITEST['all-pass'])?.counts).toEqual([3, 0, 0, 1])
    expect(read(VITEST['suite-error'])).toEqual({ runner: 'vitest', counts: [3, 0, 1, 1], failingIds: ['tests/broken.test.js'] })
  })

  test('watch output with no closing summary is not a run it can read', async () => {
    expect(parseTestRun('npx vitest', ' DEV  v2.1.9 /work\n\n ✓ tests/limit.test.js (4 tests)\n\n Waiting for file changes...')).toBeNull()
  })
})

describe('Test Output Parser: jest', () => {
  const read = (command: string, output: string) => {
    const run = parseTestRun(command, output)
    return run && { runner: run.runner, counts: [run.passed, run.failed, run.errors, run.skipped], failingIds: run.failingIds }
  }

  test('reads counts and failing ids, named by file and test path', async () => {
    expect(read('npx jest', JEST.fail)).toEqual({
      runner: 'jest',
      counts: [2, 2, 0, 1],
      failingIds: ['tests/limit.test.js › statusFor › over limit', 'tests/limit.test.js › lookup FG_MARKER_7f3a'],
    })
  })

  test('reads an all-pass run, and a suite that failed to run as an error for its file', async () => {
    expect(read('npx jest', JEST['all-pass'])?.counts).toEqual([3, 0, 0, 1])
    expect(read('npx jest', JEST['suite-error'])).toEqual({ runner: 'jest', counts: [3, 0, 1, 1], failingIds: ['tests/broken.test.js'] })
  })

  test('npm test is read by the summary its output carries', async () => {
    expect(read('npm test', JEST.fail)?.runner).toBe('jest')
    expect(read('npm run test', VITEST.fail)?.runner).toBe('vitest')
  })
})

