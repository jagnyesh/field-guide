import { describe, expect, mock, test } from 'claude-code/testing'

import { standIn } from './stand-in'

const ROWS = [
  { role: 'user', text: 'rename greet to welcome', toolUses: [] },
  {
    role: 'assistant',
    text: '',
    toolUses: [
      { tool_use_id: 't1', tool: 'Read', input: { file_path: 'src/app.py' }, text: 'def greet(): ...' },
      { tool_use_id: 't2', tool: 'Bash', input: { command: 'pytest -q' }, text: '1 passed' },
    ],
  },
]

const TRACE = {
  plugin: 'field-guide',
  surface: 'terminal' as const,
  component: 'Pane' as const,
  requestId: 'field-guide-trace',
  props: { title: 'Loop Trace', isFocused: false, bodyColumns: 80, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 20 }, view: {} },
}

describe('Loop Trace pane', () => {
  test('/guide trace draws each step of the latest turn', async ($, on) => {
    const engine = standIn(on, ROWS)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ command: 'guide', args: 'trace', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 160 } })
    expect(engine.opened).toEqual(['field-guide-trace'])
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /Read\s+src\/app\.py/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Bash\s+pytest -q/ })).toBeDefined()
    await ui.unmount()
  })

  const MARKER = 'FG_MARKER_7f3a'
  const MARKED = [
    { role: 'user', text: `look at ${MARKER}`, toolUses: [] },
    {
      role: 'assistant',
      text: `ok ${MARKER}`,
      toolUses: [
        { tool_use_id: 'b1', tool: 'Bash', input: { command: `grep ${MARKER} .` }, text: `hit ${MARKER}` },
        { tool_use_id: 'b2', tool: 'Bash', input: { command: 'pytest' }, text: `FAILED t.py::test_x[${MARKER}]` },
      ],
    },
  ]
  const DONE = { answer: '', durationMs: 1, isAborted: false, turnId: 'turn-1', reason: 'answer' as const }

  test('with the debug variable set, each main-loop turn writes one metadata-only debug line', async ($, on) => {
    const engine = standIn(on, MARKED)
    mock.env(on, { FIELD_GUIDE_DEBUG: '1' })
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(DONE)
    const lines = engine.logs.filter(line => line.startsWith('field-guide: {'))
    expect(lines.length).toBe(1)
    expect(JSON.parse(lines[0].slice('field-guide: '.length)).turns[0].steps.length).toBe(2)
    expect(engine.logs.join('\n')).not.toContain(MARKER)
  })

  test('without the debug variable, no debug line is written', async ($, on) => {
    const engine = standIn(on, MARKED)
    mock.env(on, {})
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(DONE)
    expect(engine.logs.filter(line => line.startsWith('field-guide: {'))).toEqual([])
  })

  test('a failure inside the plugin goes to the debug log and the turn carries on', async ($, on) => {
    const engine = standIn(on, () => {
      throw new Error('transcript unavailable')
    })
    on('turn.complete', () => ({ text: 'the answer' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const result = await $.turn.complete(DONE)
    expect(result.text).toBe('the answer')
    expect(engine.logs.some(line => line.startsWith('field-guide: turn.complete failed'))).toBe(true)
  })
})
