import { describe, expect, test } from 'claude-code/testing'
import { debugLine } from './metadata'
import { buildTimeline } from './transcript'

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
})
