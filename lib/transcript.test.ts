import { describe, expect, test } from 'claude-code/testing'
import { buildTimeline, verificationOf } from './transcript'
import { OUTPUT } from './fixtures/pytest'
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

  test('each step carries its kind', async () => {
    const [turn] = buildTimeline([prompt('go'), reply('', [use('r', 'Read', { file_path: 'a' }), use('b', 'Bash', { command: 'pytest' }, OUTPUT.quiet)])])
    expect(turn.steps.map(s => s.kind)).toEqual(['read', 'verify'])
  })

  test("a subagent's steps sit under the Agent step that started it, labelled with the subagent", async () => {
    const subagents: Record<string, TranscriptMessage[]> = {
      a1: [
        { role: 'user', text: 'Read c.txt and reply with its first word.' },
        reply('', [use('s1', 'Read', { file_path: 'c.txt' }), use('s2', 'SubagentHandback', {})]),
      ],
    }
    const [turn] = buildTimeline(
      [prompt('go'), reply('', [{ ...use('a', 'Agent', { description: 'Read c', subagent_type: 'Explore' }), agentId: 'a1' }])],
      agentId => subagents[agentId],
    )
    expect(turn.steps.length).toBe(1)
    const agent = turn.steps[0]
    expect(agent.kind).toBe('delegate')
    expect(agent.children?.map(s => [s.tool, s.agentId])).toEqual([['Read', 'a1'], ['SubagentHandback', 'a1']])
  })

  test("a subagent's hand-back and the main-loop turn it starts stay in the Settled turn that started the subagent", async () => {
    // The row shapes seen in a live session: the Agent call returns at once, the main loop stops,
    // and the subagent's hand-back arrives later as a task notification that starts a new main-loop turn.
    const turns = buildTimeline([
      prompt('Use the Agent tool with subagent_type Explore'),
      reply('', [{ ...use('a', 'Agent', { description: 'Read a' }), agentId: 'a8' }]),
      { role: 'user', text: '', toolResults: [{ tool_use_id: 'a' }] },
      reply('The subagent is still running.'),
      { role: 'user', text: '<task-notification>\n<task-id>a8</task-id>\n<tool-use-id>a</tool-use-id>' },
      reply('', [use('r', 'Read', { file_path: 'a.txt' })]),
      reply('done'),
    ])
    expect(turns.length).toBe(1)
    expect(turns[0].steps.map(s => s.id)).toEqual(['a', 'r'])
  })

  test('a test run it can read is attached to its step; one it cannot read is a plain run', async () => {
    const [turn] = buildTimeline([
      prompt('go'),
      reply('', [
        use('p', 'Bash', { command: '.venv/bin/python -m pytest -q' }, OUTPUT.quiet),
        use('j', 'Bash', { command: 'npm test' }, '> test\n> mocha\n\n  2 passing (5ms)'),
        use('l', 'Bash', { command: 'ruff check .' }, 'All checks passed!'),
      ]),
    ])
    const [pytest, npm, ruff] = turn.steps
    expect([pytest.kind, pytest.verification, pytest.run?.failed]).toEqual(['verify', 'tested', 2])
    expect([npm.kind, npm.verification, npm.run]).toEqual(['run', undefined, undefined])
    expect([ruff.kind, ruff.verification]).toEqual(['verify', 'checked'])
  })

  test('a Settled turn is Tested or Checked by what ran after its last edit, or neither', async () => {
    const pytest = (id: string) => use(id, 'Bash', { command: 'pytest -q' }, OUTPUT['all-pass'])
    const ruff = (id: string) => use(id, 'Bash', { command: 'ruff check .' })
    const edit = (id: string) => use(id, 'Edit', { file_path: 'a.py' })
    const of = (...uses: ToolUse[]) => verificationOf(buildTimeline([prompt('go'), reply('', uses)])[0])
    expect(of(edit('e'), pytest('p'))).toBe('tested')
    expect(of(pytest('p'), edit('e'))).toBe(null)
    expect(of(edit('e'), ruff('r'))).toBe('checked')
    expect(of(edit('e'), ruff('r'), pytest('p'))).toBe('tested')
    expect(of(ruff('r'))).toBe('checked')
    expect(of(use('r', 'Read', { file_path: 'a.py' }))).toBe(null)
  })

  test("a test run inside a subagent after the main loop's edit counts", async () => {
    const turns = buildTimeline(
      [prompt('go'), reply('', [use('e', 'Edit', { file_path: 'a.py' }), { ...use('a', 'Agent', { description: 'run tests' }), agentId: 'a1' }])],
      () => [reply('', [use('p', 'Bash', { command: 'pytest -q' }, OUTPUT['all-pass'])])],
    )
    expect(verificationOf(turns[0])).toBe('tested')
  })

  test('a turn is not settled while a backgrounded subagent has not handed back; a foreground one never holds it open', async () => {
    const launched = { ...use('a', 'Agent', { description: 'Read a' }), agentId: 'a8', result: { status: 'async_launched', agentId: 'a8' } }
    const finished = { ...use('a', 'Agent', { description: 'Read a' }), agentId: 'a9', result: { status: 'completed' } }
    const start = [prompt('go'), reply('', [launched]), { role: 'user' as const, text: '', toolResults: [{ tool_use_id: 'a' }] }, reply('still running')]
    expect(buildTimeline(start)[0].isSettled).toBe(false)
    const handedBack = [...start, { role: 'user' as const, text: '<task-notification>\n<task-id>a8</task-id>\n<tool-use-id>a</tool-use-id>' }, reply('done')]
    expect(buildTimeline(handedBack)[0].isSettled).toBe(true)
    expect(buildTimeline([prompt('go'), reply('', [finished]), reply('done')])[0].isSettled).toBe(true)
  })

  test('a subagent that turns up inside its own transcript is expanded once, not forever', async () => {
    const loop = [prompt('go'), reply('', [{ ...use('a', 'Agent', { description: 'x' }), agentId: 'a1' }])]
    const [turn] = buildTimeline(loop, () => loop)
    expect(turn.steps[0].children?.map(s => [s.id, s.children?.length ?? 0])).toEqual([['a', 0]])
  })
})
