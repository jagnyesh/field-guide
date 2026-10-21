import { describe, expect, test } from 'claude-code/testing'
import { judge } from './flags'
import { OUTPUT } from './fixtures/pytest'
import { buildTimeline } from './transcript'
import type { ToolUse, TranscriptMessage } from './transcript'

const prompt = (text: string): TranscriptMessage => ({ role: 'user', text })
const reply = (toolUses: ToolUse[]): TranscriptMessage => ({ role: 'assistant', text: '', toolUses })
const use = (id: string, tool: string, input: Record<string, unknown>, text = 'ok'): ToolUse => ({ tool_use_id: id, tool, input, text })
const edit = (id: string) => use(id, 'Edit', { file_path: 'src/ratelimit.py' })
const pytest = (id: string) => use(id, 'Bash', { command: 'pytest -q' }, OUTPUT['all-pass'])
const turnOf = (...uses: ToolUse[]) => buildTimeline([prompt('go'), reply(uses)])[0]

describe('Loop Flags: Unverified edit', () => {
  test('fires for a Settled turn with an edit and nothing verifying it afterwards', async () => {
    const findings = judge(turnOf(pytest('p'), edit('e')))
    expect(findings?.map(f => [f.kind, f.level, f.stepIds])).toEqual([['unverified-edit', 'flag', ['e']]])
    expect(findings?.[0].reason.length).toBeGreaterThan(20)
  })

  test('does not fire when a test run follows the last edit', async () => {
    expect(judge(turnOf(edit('e'), pytest('p')))).toEqual([])
  })

  test('judges nothing before the turn settles', async () => {
    const turn = buildTimeline([
      prompt('go'),
      reply([edit('e'), { ...use('a', 'Agent', { description: 'x' }), agentId: 'a1', result: { status: 'async_launched' } }]),
    ])[0]
    expect(judge(turn)).toBeNull()
  })
})

const run = (id: string, output: string) => use(id, 'Bash', { command: '.venv/bin/python -m pytest -q' }, output)
const session = (...turns: ToolUse[][]) => buildTimeline(turns.flatMap((uses, i) => [prompt(`turn ${i + 1}`), reply(uses)]))
const kinds = (turns: ReturnType<typeof session>, index = turns.length - 1) => judge(turns[index], turns)?.map(f => f.kind)

describe('Loop Flags: Ended red', () => {
  test('failures already there at the Baseline run never raise Ended red', async () => {
    expect(kinds(session([run('p1', OUTPUT.quiet)]))).toEqual([])
  })

  test('a failure that is new since the Baseline run raises Ended red, naming the new failing test', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [use('e', 'Edit', { file_path: 'src/lookup.py' }), run('p2', OUTPUT['param-fail'])])
    const findings = judge(turns[1], turns) ?? []
    const red = findings.find(f => f.kind === 'ended-red')
    expect([red?.level, red?.view, red?.testIds]).toEqual(['flag', 'ledger', ['tests/test_lookup.py::test_lookup[FG_MARKER_7f3a]']])
    expect(red?.reason).toMatch(/1 failing test that was not failing at the start of the session/)
  })

  test('a first run that came after a source edit is no baseline, so its failures are new', async () => {
    expect(kinds(session([use('e', 'Edit', { file_path: 'src/ratelimit.py' }), run('p1', OUTPUT.quiet)]))).toContain('ended-red')
  })

  test('a first run after editing only a test file is still the baseline', async () => {
    expect(kinds(session([use('e', 'Edit', { file_path: 'tests/test_lookup.py' }), run('p1', OUTPUT.quiet)]))).not.toContain('ended-red')
  })

  test('when the output names no tests, it compares counts and says so', async () => {
    const countsOnly = 'Exit code 1\n3 failed, 2 passed in 0.02s'
    const turns = session([run('p1', OUTPUT.quiet)], [use('e', 'Edit', { file_path: 'src/a.py' }), run('p2', countsOnly)])
    const red = judge(turns[1], turns)?.find(f => f.kind === 'ended-red')
    expect(red?.reason).toMatch(/compares counts/)
    const same = session([run('p1', OUTPUT.quiet)], [use('e', 'Edit', { file_path: 'src/a.py' }), run('p2', 'Exit code 1\n2 failed, 3 passed in 0.02s')])
    expect(kinds(same)).not.toContain('ended-red')
  })

  test('a turn the developer interrupted raises no Ended red, and the interruption does not start a turn', async () => {
    const turns = buildTimeline([
      prompt('turn 1'),
      reply([run('p1', OUTPUT.quiet)]),
      prompt('turn 2'),
      reply([use('e', 'Edit', { file_path: 'src/lookup.py' }), run('p2', OUTPUT['param-fail'])]),
      { role: 'user', text: '[Request interrupted by user for tool use]' },
    ])
    expect(turns.length).toBe(2)
    expect(turns[1].isInterrupted).toBe(true)
    expect(judge(turns[1], turns)?.map(f => f.kind)).not.toContain('ended-red')
  })

  test('when the last test command gave no readable result, an earlier failing run does not raise Ended red', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [
      use('e', 'Edit', { file_path: 'src/lookup.py' }),
      run('p2', OUTPUT['param-fail']),
      run('p3', 'Traceback (most recent call last):\nKeyboardInterrupt'),
    ])
    expect(kinds(turns)).not.toContain('ended-red')
  })
})

// pytest -q's closing lines for a run; the parser itself is tested on real output (testrun.test.ts).
const pytestOut = (failing: string[], passed: number) =>
  [...failing.map(id => `FAILED ${id} - AssertionError`), `${failing.length ? `${failing.length} failed, ` : ''}${passed} passed in 0.01s`].join('\n')

describe('Loop Flags: Red step', () => {
  test('a turn whose only failures are in a test file it added, with no source edits, is a Red step and not Ended red', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [
      use('w', 'Write', { file_path: 'tests/test_feature.py', content: 'def test_feature(): assert feature()' }),
      run('p2', pytestOut(['tests/test_legacy.py::test_legacy_format', 'tests/test_ratelimit.py::test_over_limit', 'tests/test_feature.py::test_feature'], 3)),
    ])
    const findings = judge(turns[1], turns) ?? []
    expect(findings.map(f => [f.kind, f.level])).toEqual([['red-step', 'note']])
  })

  test('the same turn with a source edit too is Ended red, not a Red step', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [
      use('w', 'Write', { file_path: 'tests/test_feature.py', content: 'def test_feature(): assert feature()' }),
      use('e', 'Edit', { file_path: 'src/feature.py' }),
      run('p2', pytestOut(['tests/test_legacy.py::test_legacy_format', 'tests/test_ratelimit.py::test_over_limit', 'tests/test_feature.py::test_feature'], 3)),
    ])
    expect(kinds(turns)).toEqual(['ended-red'])
  })
})

describe('Loop Flags: Test changed to pass', () => {
  const OVER = 'tests/test_ratelimit.py::test_over_limit'
  const LEGACY = 'tests/test_legacy.py::test_legacy_format'
  const testEdit = (id: string, newString = 'assert status_for(11) == 429') =>
    use(id, 'Edit', { file_path: '/work/tests/test_ratelimit.py', old_string: 'assert status_for(11) == 403', new_string: newString })
  const sourceEdit = (id: string) => use(id, 'Edit', { file_path: '/work/src/ratelimit.py', old_string: '429', new_string: '403' })
  const after = (...uses: ToolUse[]) => session([run('p1', OUTPUT.quiet)], [...uses, run('p2', pytestOut([LEGACY], 4))])
  const found = (turns: ReturnType<typeof session>) => (judge(turns[1], turns) ?? []).map(f => [f.kind, f.level, f.testIds])

  test('a test that failed, then passed with only its own test file edited in between, raises the flag', async () => {
    expect(found(after(testEdit('t')))).toEqual([['test-changed-to-pass', 'flag', [OVER]]])
  })

  test('a fix to the source alone raises nothing', async () => {
    expect(found(after(sourceEdit('s')))).toEqual([])
  })

  test('when the source changed too, it is a note, not the flag', async () => {
    expect(found(after(testEdit('t'), sourceEdit('s')))).toEqual([['test-and-source-changed', 'note', [OVER]]])
  })

  test('an added skip marker raises the flag even when the source changed too', async () => {
    const skip = testEdit('t', '@pytest.mark.skip(reason="later")\ndef test_over_limit():')
    expect(found(after(skip, sourceEdit('s')))).toEqual([['test-changed-to-pass', 'flag', [OVER]]])
  })

  test('a later run that did not cover the test proves nothing', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [
      testEdit('t'),
      use('p2', 'Bash', { command: '.venv/bin/python -m pytest -q tests/test_legacy.py' }, pytestOut([LEGACY], 0)),
    ])
    expect(found(turns)).toEqual([])
    const keyword = session([run('p1', OUTPUT.quiet)], [testEdit('t'), use('p2', 'Bash', { command: 'pytest -q -k legacy' }, pytestOut([LEGACY], 0))])
    expect(found(keyword)).toEqual([])
  })
})

describe('Loop Flags: other runners', () => {
  test('a Red step is recognised from vitest ids too', async () => {
    const vitestRun = (id: string, failing: string[]) =>
      use(id, 'Bash', { command: 'npx vitest run' }, [...failing.map(f => ` FAIL  ${f}`), `      Tests  ${failing.length} failed | 3 passed (4)`].join('\n'))
    const turns = session([vitestRun('v1', [])], [
      use('w', 'Write', { file_path: '/work/tests/feature.test.ts', content: 'test("feature works", () => {})' }),
      vitestRun('v2', ['tests/feature.test.ts > feature works']),
    ])
    expect(kinds(turns)).toEqual(['red-step'])
  })
})

describe('Loop Flags: shell edits count as edits', () => {
  test('a shell edit with nothing after it raises Unverified edit', async () => {
    expect(kinds(session([use('s', 'Bash', { command: "sed -i '' 's/60/30/' src/settings.ini" })]))).toEqual(['unverified-edit'])
  })

  test('a shell edit to the test file alone, between a failing and a passing run, raises Test changed to pass', async () => {
    const turns = session([run('p1', OUTPUT.quiet)], [
      use('s', 'Bash', { command: "sed -i '' 's/== 403/== 429/' tests/test_ratelimit.py" }),
      run('p2', pytestOut(['tests/test_legacy.py::test_legacy_format'], 4)),
    ])
    expect(kinds(turns)).toEqual(['test-changed-to-pass'])
  })
})

describe('Loop Flags: Boundary mock', () => {
  const mockEdit = (id: string, path: string, newString: string) => use(id, 'Edit', { file_path: path, old_string: '', new_string: newString })
  const judged = (uses: ToolUse[], options?: { boundaryMockAsFlag?: boolean; boundaryModules?: readonly string[] }) => {
    const turns = session([...uses, run('p', pytestOut([], 5))])
    return (judge(turns[0], turns, options) ?? []).map(f => [f.kind, f.level, f.reason])
  }

  test('a test that now mocks a boundary module is a note explaining the risk', async () => {
    const [found] = judged([mockEdit('e', 'tests/test_client.py', '@patch("requests.get")')])
    expect(found.slice(0, 2)).toEqual(['boundary-mock', 'note'])
    expect(found[2]).toMatch(/mocks requests\. A mock can pass while the real thing behaves differently/)
  })

  test('mocking project code, or a mock outside a test file, is not a boundary mock', async () => {
    expect(judged([mockEdit('e', 'tests/test_lookup.py', 'patch("src.lookup.KNOWN", {})')])).toEqual([])
    expect(judged([mockEdit('e', 'src/client.py', 'patch("requests.get")')])).toEqual([])
  })

  test('a project can make it a flag, and choose its own boundary modules', async () => {
    expect(judged([mockEdit('e', 'tests/test_client.py', '@patch("requests.get")')], { boundaryMockAsFlag: true })[0].slice(0, 2)).toEqual(['boundary-mock', 'flag'])
    expect(judged([mockEdit('e', 'tests/test_x.py', '@patch("internal_billing.charge")')], { boundaryModules: ['internal_billing'] })[0][0]).toBe('boundary-mock')
  })
})

