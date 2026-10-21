import { describe, expect, mock, test } from 'claude-code/testing'

import { OUTPUT } from '../lib/fixtures/pytest'
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

  test('Loop Trace shows each step\'s kind, marks failed calls, and nests a subagent\'s steps under it', async ($, on) => {
    const main = [
      { role: 'user', text: 'find the callers', toolUses: [] },
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'g', tool: 'Grep', input: { pattern: 'greet' }, text: '', isError: true },
          { tool_use_id: 'a', tool: 'Agent', input: { description: 'Find callers', subagent_type: 'Explore' }, text: 'ok', agentId: 'a1' },
        ],
      },
    ]
    const sub = [
      { role: 'user', text: 'Find callers of greet', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 's', tool: 'Read', input: { file_path: 'c.py' }, text: 'x' }] },
    ]
    const asked: (string | undefined)[] = []
    standIn(on, e => {
      asked.push(e.agentId)
      return e.agentId === 'a1' ? sub : main
    })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ command: 'guide', args: 'trace', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 160 } })
    const ui = await $.ui.mount(TRACE)
    expect(asked).toContain('a1')
    expect(await ui.find({ type: 'Text', text: /^✗ search\s+Grep\s+greet/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /delegate\s+Agent\s+Find callers/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /↳ Explore › read\s+Read\s+c\.py/ })).toBeDefined()
    await ui.unmount()
  })

  const PANE_PROPS = { isFocused: false, bodyColumns: 100, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 30 }, view: {} }
  const RUN = { command: 'guide', origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 160 } }
  const TESTED = [
    { role: 'user', text: 'fix the limit', toolUses: [] },
    {
      role: 'assistant',
      text: '',
      toolUses: [
        { tool_use_id: 'p1', tool: 'Bash', input: { command: '.venv/bin/python -m pytest -q' }, text: OUTPUT['param-fail'], isError: true },
        { tool_use_id: 'e1', tool: 'Edit', input: { file_path: 'src/ratelimit.py' }, text: 'ok' },
        { tool_use_id: 'p2', tool: 'Bash', input: { command: '.venv/bin/python -m pytest -q' }, text: OUTPUT['all-pass'] },
      ],
    },
  ]

  test('/guide ledger lists each test run in order, with counts and whole failing ids', async ($, on) => {
    const engine = standIn(on, TESTED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'ledger' })
    expect(engine.opened).toEqual(['field-guide-ledger'])
    const ui = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-ledger', props: { title: 'Red/Green Ledger', ...PANE_PROPS } })
    expect(await ui.find({ type: 'Text', text: /Turn 1 · pytest · 2 passed, 3 failed/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /test_lookup\[FG_MARKER_7f3a\]/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Turn 1 · pytest · 3 passed$/ })).toBeDefined()
    await ui.unmount()
  })

  test('Loop Trace says whether the turn was Tested, Checked, or not verified after its last edit', async ($, on) => {
    standIn(on, TESTED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'trace' })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /Tested after the last edit/ })).toBeDefined()
    await ui.unmount()
  })

  const BAND = (bodyColumns = 144) => ({
    plugin: 'field-guide',
    surface: 'terminal' as const,
    component: 'AbovePrompt' as const,
    props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns, scroll: { offset: 0, bodyRows: 4 }, view: {} },
  })
  const EDITED = [
    { role: 'user', text: 'change the limit', toolUses: [] },
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'e1', tool: 'Edit', input: { file_path: 'src/ratelimit.py' }, text: 'ok' }] },
    { role: 'assistant', text: 'done', toolUses: [] },
  ]

  test('after a Settled turn with an edit and no verification, the band raises Unverified edit', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /Unverified edit/ })).toBeDefined()
    await band.unmount()
  })

  test('while a backgrounded subagent has not handed back, the band shows only live facts', async ($, on) => {
    standIn(on, e => (e.agentId ? [] : [
      ...EDITED.slice(0, 2),
      {
        role: 'assistant',
        text: '',
        toolUses: [{ tool_use_id: 'a', tool: 'Agent', input: { description: 'x' }, agentId: 'a1', result: { status: 'async_launched', agentId: 'a1' }, text: 'launched' }],
      },
    ]))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /Unverified edit/ })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: /context 25%/ })).toBeDefined()
    await band.unmount()
  })

  test('with another plugin drawing in the band, Field Guide draws nothing there and the flag moves to the status line', async ($, on) => {
    const other = { type: 'Text', children: ['another mod is holding a command'] }
    const engine = standIn(on, EDITED, { band: other })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /another mod is holding a command/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /Unverified edit/ })).toBeUndefined()
    expect(engine.statuses.some(text => text?.includes('Unverified edit'))).toBe(true)
    await band.unmount()
  })

  test('while a survey holds the band, Field Guide gives way', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const survey = BAND()
    const band = await $.ui.mount({ ...survey, props: { ...survey.props, hasSurvey: true } })
    expect(await band.find({ type: 'Text', text: /Unverified edit/ })).toBeUndefined()
    await band.unmount()
  })

  test('the band validates at 80 and 144 columns and never runs past its width', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    for (const columns of [144, 80, 24]) {
      const band = await $.ui.mount(BAND(columns))
      const line = await band.find({ type: 'Text', text: /Unverified|…/ })
      expect(line).toBeDefined()
      expect((line?.text ?? '').length).toBeLessThanOrEqual(columns)
      await band.unmount()
    }
  })

  test('flags never reach the model: the /guide reply names only the view', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    for (const args of ['trace', 'ledger', 'nonsense']) {
      const reply = await $.command.run({ ...RUN, args })
      expect(reply.text ?? '').not.toMatch(/Unverified|flag|edit/i)
      expect(reply.context).toBeUndefined()
    }
  })
})
