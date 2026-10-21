import { describe, expect, test } from 'claude-code/testing'
import { buildTimeline } from './transcript'
import type { ToolUse, TranscriptMessage } from './transcript'

const prompt = (text: string): TranscriptMessage => ({ role: 'user', text, toolUses: [] })
const reply = (text: string, toolUses: ToolUse[] = []): TranscriptMessage => ({ role: 'assistant', text, toolUses })
const use = (id: string, tool: string, input: Record<string, unknown>, text = 'ok'): ToolUse => ({ tool_use_id: id, tool, input, text })

describe('Transcript Reader', () => {
  test('a developer prompt and its tool calls form one turn, in order', async () => {
    const turns = buildTimeline([
      prompt('rename greet to welcome'),
      reply('', [use('t1', 'Read', { file_path: 'src/app.py' })]),
      { role: 'user', text: '', toolResults: [{ tool_use_id: 't1', text: 'ok' }] },
      reply('', [use('t2', 'Edit', { file_path: 'src/app.py', old_string: 'a', new_string: 'b' })]),
      reply('done'),
    ])
    expect(turns.length).toBe(1)
    expect(turns[0].steps.map(s => s.tool)).toEqual(['Read', 'Edit'])
  })

  test('messages the engine writes do not start a turn', async () => {
    const turns = buildTimeline([
      { role: 'user', text: 'This session is being continued from a previous conversation that ran out of context.' },
      prompt('run the tests'),
      reply('', [use('t1', 'Bash', { command: 'pytest' })]),
      { role: 'user', text: '<task-notification>\n<task-id>a1</task-id>\n</task-notification>' },
      reply('', [use('t2', 'Read', { file_path: 'b.txt' })]),
      { role: 'user', text: '<local-command-stdout>Compacted</local-command-stdout>' },
      { role: 'user', text: '' },
      prompt('now fix it'),
      reply('', [use('t3', 'Edit', { file_path: 'a.py' })]),
    ])
    expect(turns.map(t => t.steps.map(s => s.id))).toEqual([['t1', 't2'], ['t3']])
  })

  test('each step carries a short input summary, its error state, and its result size', async () => {
    const [turn] = buildTimeline([
      prompt('go'),
      reply('', [
        use('r', 'Read', { file_path: 'src/app.py' }, 'line one'),
        use('b', 'Bash', { command: 'pytest -q\necho second line' }),
        { ...use('g', 'Grep', { pattern: 'def greet', path: 'src' }), isError: true as const },
        use('a', 'Agent', { description: 'Find callers', prompt: 'long prompt text', subagent_type: 'Explore' }),
        use('x', 'TodoWrite', { todos: [] }),
      ]),
    ])
    expect(turn.steps.map(s => s.summary)).toEqual(['src/app.py', 'pytest -q', 'def greet', 'Find callers', ''])
    expect(turn.steps.map(s => s.isError)).toEqual([false, false, true, false, false])
    expect(turn.steps[0].resultSize).toBe(8)
  })

  test('a long command is cut to one short line', async () => {
    const [turn] = buildTimeline([prompt('go'), reply('', [use('b', 'Bash', { command: 'x'.repeat(200) })])])
    expect(turn.steps[0].summary.length).toBeLessThanOrEqual(80)
    expect(turn.steps[0].summary.endsWith('…')).toBe(true)
  })
})
