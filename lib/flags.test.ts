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
