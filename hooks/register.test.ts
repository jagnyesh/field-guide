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
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeDefined()
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
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: /context 25%/ })).toBeDefined()
    await band.unmount()
  })

  test('with another plugin drawing in the band, Field Guide draws nothing there and the flag moves to the status line', async ($, on) => {
    const other = { type: 'Text', children: ['another mod is holding a command'] }
    const engine = standIn(on, EDITED, { band: other })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /another mod is holding a command/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeUndefined()
    expect(engine.statuses.some(text => text?.includes('No test or check ran since the last edit'))).toBe(true)
    await band.unmount()
  })

  test('while a survey holds the band, Field Guide gives way', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const survey = BAND()
    const band = await $.ui.mount({ ...survey, props: { ...survey.props, hasSurvey: true } })
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeUndefined()
    await band.unmount()
  })

  test('the band validates at 80 and 144 columns and never runs past its width', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    for (const columns of [144, 80, 24]) {
      const band = await $.ui.mount(BAND(columns))
      const line = await band.find({ type: 'Text', text: /No test or check|…/ })
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

  test('a flag raised when a turn settles shows one toast, not one per rebuild', async ($, on) => {
    const engine = standIn(on, EDITED)
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(DONE)
    await $.turn.complete(DONE)
    expect(engine.toasts.filter(t => t.includes('Unverified edit')).length).toBe(1)
  })

  test('resuming a session whose last turn was flagged does not toast again', async ($, on) => {
    const engine = standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    expect(engine.toasts).toEqual([])
  })

  test('opening the flag\'s view acknowledges it: the band goes back to live facts', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'trace' })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeUndefined()
    expect(await band.find({ type: 'Text', text: /context 25%/ })).toBeDefined()
    await band.unmount()
  })

  test('sending the next prompt acknowledges the flag', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.prompt.submit({ text: 'thanks, now the docs', origin: { kind: 'composer' }, turnId: 't2', wait: false })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeUndefined()
    await band.unmount()
  })

  test('opening a different view does not acknowledge the flag', async ($, on) => {
    standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'ledger' })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /No test or check ran since the last edit/ })).toBeDefined()
    await band.unmount()
  })

  test('Loop Trace explains each flag and "Tell Claude" fills an editable prompt rather than sending one', async ($, on) => {
    const engine = standIn(on, EDITED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'trace' })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /no test, lint, type check, or build ran after the last edit/ })).toBeDefined()
    await ui.press({ key: 'tell:unverified-edit' })
    expect(engine.filled.length).toBe(1)
    expect(engine.filled[0]).toMatch(/Turn 1/)
    expect(engine.filled[0]).toMatch(/Unverified edit/)
    expect(engine.filled[0]).toMatch(/information, not a request to change approach/)
    expect(engine.filled[0]).not.toMatch(/please check/i)
    await ui.unmount()
  })

  const RED = [
    { role: 'user', text: 'run the tests', toolUses: [] },
    { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'p1', tool: 'Bash', input: { command: '.venv/bin/python -m pytest -q' }, text: OUTPUT.quiet }] },
    { role: 'user', text: 'now tidy lookup', toolUses: [] },
    {
      role: 'assistant',
      text: '',
      toolUses: [
        { tool_use_id: 'e1', tool: 'Edit', input: { file_path: 'src/lookup.py' }, text: 'ok' },
        { tool_use_id: 'p2', tool: 'Bash', input: { command: '.venv/bin/python -m pytest -q' }, text: OUTPUT['param-fail'] },
      ],
    },
  ]

  test('the band raises Ended red for a failure that is new since the baseline', async ($, on) => {
    standIn(on, RED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /New failures in the last test run · Turn 2 · \/guide ledger/ })).toBeDefined()
    await band.unmount()
  })

  test('the Ledger marks tests that were already failing at the Baseline run', async ($, on) => {
    standIn(on, RED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-ledger', props: { title: 'Red/Green Ledger', ...PANE_PROPS } })
    expect(await ui.find({ type: 'Text', text: /test_legacy_format  \(already failing\)$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /test_lookup\[FG_MARKER_7f3a\]$/ })).toBeDefined()
    await ui.unmount()
  })

  test('Tell Claude for Ended red names the new tests without their parameters', async ($, on) => {
    const engine = standIn(on, RED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-ledger', props: { title: 'Red/Green Ledger', ...PANE_PROPS } })
    await ui.press({ key: 'tell:ended-red' })
    expect(engine.filled[0]).toContain('tests/test_lookup.py::test_lookup[…]')
    expect(engine.filled[0]).not.toContain('FG_MARKER_7f3a')
    await ui.unmount()
  })

  test('after a shell call that is not read-only, the Live Probe credits the files it changed, without taking the index lock', async ($, on) => {
    let callId = ''
    const rows = () => [
      { role: 'user', text: 'shorten the window', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: callId, tool: 'Bash', input: { command: 'python tools/rewrite.py' }, text: '' }] },
    ]
    const clock = mock.clock(on, { now: 5_000 })
    mock.env(on, {})
    const engine = standIn(on, rows, { status: ' M src/settings.ini\0 M src/other.py\0', mtimes: { 'src/settings.ini': 5_000, 'src/other.py': 10 } })
    on('tool.call', (_, e) => {
      callId = e.tool_use_id
      return { result: { stdout: '', stderr: '', interrupted: false }, text: '' }
    })
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const result = await $.tool.call({ tool: 'Bash', command: 'python tools/rewrite.py', description: 'rewrite' })
    expect(result.text).toBe('')
    await clock.settle()
    const git = engine.processes.find(p => p.argv[0] === 'git' && p.argv.includes('status'))
    expect(git?.argv).toContain('--no-optional-locks')
    expect(git?.timeoutMs).toBeGreaterThan(0)
    await $.turn.complete(DONE)
    await $.command.run({ ...RUN, args: 'trace' })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /edit\s+Bash\s+python tools\/rewrite\.py · via shell, exact: src\/settings\.ini · not in the diff views/ })).toBeDefined()
    await ui.unmount()
  })

  test('a commit with no test or check since the last edit toasts mid-turn, stating what happened', async ($, on) => {
    const clock = mock.clock(on, { now: 5_000 })
    mock.env(on, {})
    const engine = standIn(on, EDITED)
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'git add -A && git commit -m "shorter window"', description: 'commit' })
    await clock.settle()
    expect(engine.toasts.filter(t => t.includes('git commit'))).toEqual(['Field Guide · git commit with no test or check since the last edit.'])
  })

  test('a commit after a test run, red or green, raises nothing', async ($, on) => {
    const clock = mock.clock(on, { now: 5_000 })
    mock.env(on, {})
    const engine = standIn(on, TESTED)
    on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'git add -A && git commit -m "shorter window"', description: 'commit' })
    await clock.settle()
    expect(engine.toasts.filter(t => t.includes('git commit'))).toEqual([])
  })

  test('a read-only shell call takes no snapshot', async ($, on) => {
    const clock = mock.clock(on, { now: 5_000 })
    const engine = standIn(on, [], { status: '' })
    on('tool.call', () => ({ result: { stdout: 'x', stderr: '', interrupted: false }, text: 'x', isReadOnly: true }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'cat a.txt', description: 'read' })
    await clock.settle()
    expect(engine.processes).toEqual([])
  })

  test('Loop Trace shows the Reading List for each file the turn edited', async ($, on) => {
    const main = [
      { role: 'user', text: 'fix lookup', toolUses: [] },
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'a', tool: 'Agent', input: { description: 'Find lookup', subagent_type: 'Explore' }, text: 'ok', agentId: 'x1' },
          { tool_use_id: 'g', tool: 'Grep', input: { pattern: 'def lookup' }, text: '' },
          { tool_use_id: 'e', tool: 'Edit', input: { file_path: 'src/lookup.py' }, text: 'ok' },
        ],
      },
    ]
    const sub = [{ role: 'assistant', text: '', toolUses: [{ tool_use_id: 's', tool: 'Read', input: { file_path: 'src/__init__.py' }, text: '' }] }]
    standIn(on, e => (e.agentId ? sub : main))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /^Reading List · src\/lookup\.py$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /read\s+src\/__init__\.py \(by Explore\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /searched\s+def lookup/ })).toBeDefined()
    await ui.unmount()
  })

  test('after a compaction, the Reading List keeps earlier reads, marking which the engine re-attached; /guide autopsy shows the record', async ($, on) => {
    const before = [
      { role: 'user', text: 'look at the notes', toolUses: [] },
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'r1', tool: 'Read', input: { file_path: '/work/a.txt' }, text: 'alpha' },
          { tool_use_id: 'c1', tool: 'Bash', input: { command: 'cat /work/b.txt' }, text: 'bravo' },
        ],
      },
    ]
    const after = [
      { role: 'user', text: 'This session is being continued from a previous conversation. Summary: read notes.', toolUses: [] },
      { role: 'user', text: 'now edit c', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'e1', tool: 'Edit', input: { file_path: '/work/src/c.py' }, text: 'ok' }] },
    ]
    let rows = before
    mock.env(on, {})
    standIn(on, () => rows)
    on('session.compact', () => ({ messages: [{ role: 'user', text: after[0].text, toolUses: [], handle: 's1' }], tokensBefore: 30_000, tokensAfter: 2_000 }))
    on('prompt.attachment', (_, e) => e)
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.session.compact({
      trigger: 'manual',
      messages: [
        { role: 'user', text: 'look at the notes', toolUses: [], handle: 'h1' },
        { role: 'assistant', text: '', toolUses: [], handle: 'h2' },
      ],
    })
    rows = after
    await $.prompt.attachment({ type: 'file', text: 'Called the Read tool with the following input: {"file_path":"/work/a.txt"}\nalpha', origin: { kind: 'engine' } })
    await $.turn.complete(DONE)
    const trace = await $.ui.mount(TRACE)
    expect(await trace.find({ type: 'Text', text: /read\s+a\.txt · re-attached after compaction/ })).toBeDefined()
    expect(await trace.find({ type: 'Text', text: /read\s+b\.txt · read before compaction/ })).toBeDefined()
    await trace.unmount()
    await $.command.run({ ...RUN, args: 'autopsy' })
    const autopsy = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-autopsy', props: { title: 'Compaction Autopsy', ...PANE_PROPS } })
    expect(await autopsy.find({ type: 'Text', text: /Compaction 1 · .* · 30\.0k → 2\.0k tokens · 0 kept word for word · 2 summarised/ })).toBeDefined()
    expect(await autopsy.find({ type: 'Text', text: /This session is being continued/ })).toBeDefined()
    await autopsy.unmount()
  })

  test('/guide xray shows the fixed load from the free estimate, memory files with their imports, and sections, all marked ≈', async ($, on) => {
    const category = (name: string, tokens: number, kind = 'used') => ({ name, tokens, color: 'x', isDeferred: false, kind })
    const breakdown = {
      categories: [category('System tools', 11_800), category('System prompt', 3_100), category('Memory files', 700), category('Messages', 9_000), category('Free space', 1, 'free')],
      memoryFiles: [{ path: '/work/CLAUDE.md', type: 'Project', tokens: 700 }],
      mcpTools: [{ name: 'mcp__ctx__read', serverName: 'ctx', tokens: 2_700, isLoaded: true }],
    }
    const ancestors = [{ dir: '/work', name: 'CLAUDE.md', content: '', parts: [{ path: '/work/CLAUDE.md', content: 'a' }, { path: '/work/docs/style.md', content: 'y'.repeat(800) }] }]
    const engine = standIn(on, [], { breakdown, ancestors })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.prompt.section({ name: 'mcp_instructions', text: 'x'.repeat(9_000) })
    await $.command.run({ ...RUN, args: 'xray' })
    const ui = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-xray', props: { title: 'Context X-ray', ...PANE_PROPS } })
    expect(await ui.find({ type: 'Text', text: /^Fixed load ≈ 15\.6k tokens, paid on every request$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /System tools\s+≈ 11\.8k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ctx\s+≈ 2\.7k \(1 tool\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /\/work\/CLAUDE\.md\s+≈ 700 · Project/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /imports \/work\/docs\/style\.md\s+≈ 200/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /mcp_instructions\s+≈ 2\.3k/ })).toBeDefined()
    expect(engine.usageArgs.some(args => (args as { breakdown?: string }).breakdown === 'full')).toBe(false)
    expect(engine.usageArgs.some(args => (args as { breakdown?: string }).breakdown === 'summary')).toBe(true)
    await ui.unmount()
  })

  const XRAY_PANE = { plugin: 'field-guide', surface: 'terminal' as const, component: 'Pane' as const, requestId: 'field-guide-xray', props: { title: 'Context X-ray', ...PANE_PROPS } }
  const BREAKDOWN = { categories: [{ name: 'System prompt', tokens: 3_000, color: 'x', isDeferred: false, kind: 'used' }], memoryFiles: [], mcpTools: [] }

  test('X-ray shows the last turn\'s measured growth split across its messages, with what is left over as Unattributed', async ($, on) => {
    const first = [{ role: 'user', text: 'hello', toolUses: [] }, { role: 'assistant', text: 'hi', toolUses: [] }]
    const second = [
      ...first,
      { role: 'user', text: 'read the big file', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'r', tool: 'Read', input: { file_path: 'src/big.py' }, text: 'x'.repeat(12_000) }] },
    ]
    let rows: unknown[] = first
    let fill = 10_000
    mock.env(on, {})
    standIn(on, () => rows, { breakdown: BREAKDOWN, contextTokens: () => fill })
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(DONE)
    rows = second
    fill = 15_000
    await $.turn.complete(DONE)
    await $.command.run({ ...RUN, args: 'xray' })
    const ui = await $.ui.mount(XRAY_PANE)
    expect(await ui.find({ type: 'Text', text: /^Last turn added 5\.0k tokens \(measured\)$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Read src\/big\.py\s+≈ 3\.0k/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Unattributed\s+≈ 2\.0k · reminders, formatting, thinking/ })).toBeDefined()
    await ui.unmount()
  })

  test('the exact breakdown runs only when asked for, and says it sends token-count requests', async ($, on) => {
    const engine = standIn(on, [], { breakdown: BREAKDOWN })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.command.run({ ...RUN, args: 'xray' })
    const ui = await $.ui.mount(XRAY_PANE)
    expect(engine.usageArgs.some(a => (a as { breakdown?: string }).breakdown === 'full')).toBe(false)
    await ui.press({ key: 'exact' })
    expect(engine.usageArgs.some(a => (a as { breakdown?: string }).breakdown === 'full')).toBe(true)
    // The stand-in answers ui.invalidate itself, so redraw by hand as the engine would.
    await ui.redraw()
    expect(await ui.find({ type: 'Text', text: /exact counts/ })).toBeDefined()
    await ui.unmount()
  })

  test('a turn that compacted shows tokens before and after instead of a breakdown', async ($, on) => {
    mock.env(on, {})
    standIn(on, [{ role: 'user', text: 'hello', toolUses: [] }], { breakdown: BREAKDOWN })
    on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [], handle: 's1' }], tokensBefore: 30_000, tokensAfter: 2_000 }))
    on('turn.complete', () => ({ text: '' }))
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.turn.complete(DONE)
    await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hello', toolUses: [], handle: 'h1' }] })
    await $.turn.complete(DONE)
    await $.command.run({ ...RUN, args: 'xray' })
    const ui = await $.ui.mount(XRAY_PANE)
    expect(await ui.find({ type: 'Text', text: /^Last turn compacted: 30\.0k → 2\.0k tokens$/ })).toBeDefined()
    await ui.unmount()
  })

  const MOCKED = [
    { role: 'user', text: 'test the client', toolUses: [] },
    {
      role: 'assistant',
      text: '',
      toolUses: [
        { tool_use_id: 'w', tool: 'Write', input: { file_path: 'tests/test_client.py', content: '@patch("requests.get")\ndef test_fetch(get): ...' }, text: 'ok' },
        { tool_use_id: 'p', tool: 'Bash', input: { command: 'pytest -q' }, text: OUTPUT['all-pass'] },
      ],
    },
  ]

  test('by default a boundary mock is a note in the Ledger and never reaches the band', async ($, on) => {
    standIn(on, MOCKED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /A test now mocks/ })).toBeUndefined()
    await band.unmount()
    const ledger = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-ledger', props: { title: 'Red/Green Ledger', ...PANE_PROPS } })
    expect(await ledger.find({ type: 'Text', text: /Boundary mock: A test now mocks requests/ })).toBeDefined()
    await ledger.unmount()
  })

  test('a project that turns the option on gets a flag in the band', { options: { boundaryMockAsFlag: true } }, async ($, on) => {
    standIn(on, MOCKED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const band = await $.ui.mount(BAND())
    expect(await band.find({ type: 'Text', text: /⚑ A test now mocks/ })).toBeDefined()
    await band.unmount()
  })

  test('the session start a hot reload raises keeps what the Live Probe saw: it lives in the host state', async ($, on) => {
    let callId = ''
    const rows = () => [
      { role: 'user', text: 'shorten the window', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: callId, tool: 'Bash', input: { command: 'python tools/rewrite.py' }, text: '' }] },
    ]
    const clock = mock.clock(on, { now: 5_000 })
    mock.env(on, {})
    standIn(on, rows, { status: ' M src/settings.ini\0', mtimes: { 'src/settings.ini': 5_000 } })
    on('tool.call', (_, e) => {
      callId = e.tool_use_id
      return { result: { stdout: '', stderr: '', interrupted: false }, text: '' }
    })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'Bash', command: 'python tools/rewrite.py', description: 'rewrite' })
    await clock.settle()
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /via shell, exact: src\/settings\.ini/ })).toBeDefined()
    await ui.unmount()
  })

  test('Loop Trace shows paths relative to the session folder, steps first, and marks notes apart from flags', async ($, on) => {
    standIn(on, [
      { role: 'user', text: 'tidy settings', toolUses: [] },
      {
        role: 'assistant',
        text: '',
        toolUses: [
          { tool_use_id: 'r', tool: 'Read', input: { file_path: '/work/src/settings.ini' }, text: 'x' },
          { tool_use_id: 'e', tool: 'Edit', input: { file_path: '/work/src/settings.ini' }, text: 'ok' },
        ],
      },
    ])
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /^read\s+Read  src\/settings\.ini$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Reading List · src\/settings\.ini$/ })).toBeDefined()
    const drawn = JSON.stringify(await ui.drawn())
    expect(drawn.indexOf('Read  src/settings.ini')).toBeLessThan(drawn.indexOf('Reading List'))
    expect(drawn).not.toContain('/work/')
    await ui.unmount()
  })

  test('the Ledger marks a note with ○ and a flag with ⚑', async ($, on) => {
    standIn(on, MOCKED)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ledger = await $.ui.mount({ plugin: 'field-guide', surface: 'terminal', component: 'Pane', requestId: 'field-guide-ledger', props: { title: 'Red/Green Ledger', ...PANE_PROPS } })
    expect(await ledger.find({ type: 'Text', text: /^○ Boundary mock/ })).toBeDefined()
    await ledger.unmount()
  })

  test('the Live Probe also snapshots after an MCP shell call, such as lean-ctx\'s', async ($, on) => {
    let callId = ''
    const rows = () => [
      { role: 'user', text: 'shorten the window', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: callId, tool: 'mcp__lean-ctx__ctx_shell', input: { command: 'python tools/rewrite.py' }, text: '' }] },
    ]
    const clock = mock.clock(on, { now: 5_000 })
    mock.env(on, {})
    const engine = standIn(on, rows, { status: ' M src/settings.ini\0', mtimes: { 'src/settings.ini': 5_000 } })
    on('tool.call', (_, e) => {
      callId = e.tool_use_id
      return { result: { content: [] }, text: '' }
    })
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    await $.tool.call({ tool: 'mcp__lean-ctx__ctx_shell', command: 'python tools/rewrite.py' })
    await clock.settle()
    expect(engine.processes.some(p => p.argv.includes('status'))).toBe(true)
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /edit\s+ctx_shell\s+python tools\/rewrite\.py · via shell, exact: src\/settings\.ini/ })).toBeDefined()
    await ui.unmount()
  })

  test('a turn with no edit says tests ran, not that they ran after an edit', async ($, on) => {
    standIn(on, [
      { role: 'user', text: 'run the tests', toolUses: [] },
      { role: 'assistant', text: '', toolUses: [{ tool_use_id: 'p', tool: 'Bash', input: { command: 'pytest -q' }, text: OUTPUT['all-pass'] }] },
    ])
    await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount(TRACE)
    expect(await ui.find({ type: 'Text', text: /^Tests ran this turn$/ })).toBeDefined()
    await ui.unmount()
  })
})

