import { describe, expect, test } from 'claude-code/testing'
import { judge } from './flags'
import { debugLine, stripParams } from './metadata'
import { buildTimeline } from './transcript'
import { OUTPUT } from './fixtures/pytest'

// Planted in every field that can carry content: if any copy of it leaves, the rule is broken.
export const MARKER = 'FG_MARKER_7f3a'

const markedTranscript = () => [
  { role: 'user' as const, text: `please look at ${MARKER}` },
  {
    role: 'assistant' as const,
    text: `reading ${MARKER}`,
    toolUses: [
      { tool_use_id: 'r1', tool: 'Read', input: { file_path: 'notes.txt' }, text: `secret ${MARKER}` },
      { tool_use_id: 'b1', tool: 'Bash', input: { command: `grep ${MARKER} -r .` }, text: `hit ${MARKER}` },
      { tool_use_id: 'b2', tool: 'Bash', input: { command: 'pytest' }, text: `FAILED tests/test_x.py::test_lookup[${MARKER}]` },
    ],
  },
]

describe('Metadata-only rule: the debug line', () => {
  test('names the turn and each step by tool, with sizes and error state', async () => {
    const line = JSON.parse(debugLine(buildTimeline(markedTranscript())))
    expect(line.turns.length).toBe(1)
    expect(line.turns[0].steps.map((s: { tool: string }) => s.tool)).toEqual(['Read', 'Bash', 'Bash'])
    expect(line.turns[0].steps[0].resultSize).toBe(`secret ${MARKER}`.length)
  })

  test('never carries text from a message, a tool result, or a command', async () => {
    expect(debugLine(buildTimeline(markedTranscript()))).not.toContain(MARKER)
  })

  test("carries each step's kind, and a subagent's steps under the Agent step with the same fields", async () => {
    const turns = buildTimeline(
      [
        { role: 'user', text: 'go' },
        { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'a', tool: 'Agent', input: { description: MARKER }, agentId: 'a1' }] },
      ],
      () => [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 's', tool: 'Read', input: { file_path: 'x' }, text: MARKER }] }],
    )
    const line = debugLine(turns)
    const step = JSON.parse(line).turns[0].steps[0]
    expect(step.kind).toBe('delegate')
    expect(step.children.map((c: { tool: string; kind: string }) => [c.tool, c.kind])).toEqual([['Read', 'read']])
    expect(line).not.toContain(MARKER)
  })

  test('a test id keeps its file and name and loses its parameters', async () => {
    expect(stripParams(`tests/test_lookup.py::test_lookup[${MARKER}-2]`)).toBe('tests/test_lookup.py::test_lookup[…]')
    expect(stripParams('tests/test_x.py::TestA::test_b')).toBe('tests/test_x.py::TestA::test_b')
    expect(stripParams('src/a.test.ts > adds > [case 1]')).toBe('src/a.test.ts > adds > […]')
  })

  test("carries each test run's counts and failing ids without parameters, and the turn's verification", async () => {
    const turns = buildTimeline([
      { role: 'user', text: 'go' },
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'e', tool: 'Edit', input: { file_path: 'a.py' } },
          { tool_use_id: 'p', tool: 'Bash', input: { command: 'pytest -q' }, text: OUTPUT['param-fail'] },
        ],
      },
    ])
    const line = debugLine(turns)
    const turn = JSON.parse(line).turns[0]
    expect(turn.verification).toBe('tested')
    expect(turn.steps[1].run).toEqual({
      runner: 'pytest', passed: 2, failed: 3, errors: 0, skipped: 0,
      failingIds: ['tests/test_legacy.py::test_legacy_format', 'tests/test_lookup.py::test_lookup[…]', 'tests/test_ratelimit.py::test_over_limit'],
    })
    expect(line).not.toContain(MARKER)
  })

  test("carries the latest turn's findings by kind and level only", async () => {
    const turns = buildTimeline([
      { role: 'user', text: 'go' },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'e', tool: 'Edit', input: { file_path: 'a.py' } }] },
    ])
    const line = JSON.parse(debugLine(turns, judge(turns[0]) ?? []))
    expect(line.findings).toEqual([{ kind: 'unverified-edit', level: 'flag' }])
  })
})
