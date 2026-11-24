import { describe, expect, test } from 'claude-code/testing'
import { turnGrowth } from './growth'
import type { TranscriptMessage } from './transcript'

const rows: TranscriptMessage[] = [
  { role: 'user', text: 'p'.repeat(400) },
  {
    role: 'assistant',
    text: 'a'.repeat(200),
    toolUses: [
      { tool_use_id: 'r', tool: 'Read', input: { file_path: 'src/big.py' }, text: 'x'.repeat(12_000) },
      { tool_use_id: 'b', tool: 'Bash', input: { command: 'pytest -q' }, text: 'y'.repeat(800) },
    ],
  },
  { role: 'user', text: '', toolResults: [{ tool_use_id: 'r' }, { tool_use_id: 'b' }] },
  { role: 'assistant', text: 'd'.repeat(40) },
]

describe('Context X-ray: Turn growth', () => {
  test("splits the measured growth across the turn's messages, each estimated from its length", async () => {
    const growth = turnGrowth({ measured: 5_000, rows, attachmentChars: 1_200 })
    expect(growth.parts).toEqual([
      { label: 'Read src/big.py', approxTokens: 3_007 },
      { label: 'Attachments', approxTokens: 300 },
      { label: 'Bash pytest -q', approxTokens: 206 },
      { label: 'Your prompt', approxTokens: 100 },
      { label: 'Agent text', approxTokens: 60 },
    ])
  })

  test('shows what the estimates leave over as its own row, never scaled to fit', async () => {
    expect(turnGrowth({ measured: 5_000, rows, attachmentChars: 1_200 }).unattributed).toBe(5_000 - 3_673)
    expect(turnGrowth({ measured: 1_000, rows, attachmentChars: 0 }).unattributed).toBe(1_000 - 3_373)
  })

  test("a tool row counts the input the model wrote as well as the result, by length only", async () => {
    // {"file_path":"src/notes.md","content":"<4,000 chars>"} is 4,041 characters, the result 2: ⌈4,043 / 4⌉.
    const content = 'FG_MARKER_7f3a' + 'c'.repeat(3_986)
    const rowsAt = [{ role: 'assistant' as const, text: '', toolUses: [{ tool_use_id: 'w', tool: 'Write', input: { file_path: 'src/notes.md', content }, text: 'ok' }] }]
    const growth = turnGrowth({ measured: 2_000, rows: rowsAt, attachmentChars: 0 })
    expect(growth.parts).toEqual([{ label: 'Write src/notes.md', approxTokens: 1_011 }])
    expect(growth.parts.some(p => p.label.includes('FG_MARKER_7f3a'))).toBe(false)
    expect(growth.unattributed).toBe(2_000 - 1_011)
  })

  test('a tool use with no result text still gets a row, sized from its input', async () => {
    // {"pattern":"**/*.py"} is 21 characters: ⌈21 / 4⌉.
    const rowsAt = [{ role: 'assistant' as const, text: '', toolUses: [{ tool_use_id: 'g', tool: 'Glob', input: { pattern: '**/*.py' } }] }]
    const growth = turnGrowth({ measured: 100, rows: rowsAt, attachmentChars: 0 })
    expect(growth.parts).toEqual([{ label: 'Glob **/*.py', approxTokens: 6 }])
    expect(growth.unattributed + growth.parts.reduce((sum, p) => sum + p.approxTokens, 0)).toBe(100)
  })

  test('labels show paths relative to the session folder', async () => {
    const long = '/srv/a/long/session/folder/that/goes/on/for/a/good/while/fixture'
    const rowsAt = [{ role: 'assistant' as const, text: '', toolUses: [{ tool_use_id: 'r', tool: 'Read', input: { file_path: `${long}/src/big.py` }, text: 'x'.repeat(400) }] }]
    expect(turnGrowth({ measured: 200, rows: rowsAt, attachmentChars: 0, cwd: long }).parts[0].label).toBe('Read src/big.py')
  })

  test('names an MCP call the way the views do', async () => {
    const rowsAt = [{ role: 'assistant' as const, text: '', toolUses: [{ tool_use_id: 's', tool: 'mcp__lean-ctx__ctx_shell', input: { command: 'pytest -q' }, text: 'x'.repeat(400) }] }]
    expect(turnGrowth({ measured: 200, rows: rowsAt, attachmentChars: 0 }).parts[0].label).toBe('ctx_shell pytest -q')
  })
})

