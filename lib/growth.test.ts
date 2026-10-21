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
      { label: 'Read src/big.py', approxTokens: 3_000 },
      { label: 'Attachments', approxTokens: 300 },
      { label: 'Bash pytest -q', approxTokens: 200 },
      { label: 'Your prompt', approxTokens: 100 },
      { label: 'Agent text', approxTokens: 60 },
    ])
  })

  test('shows what the estimates leave over as its own row, never scaled to fit', async () => {
    expect(turnGrowth({ measured: 5_000, rows, attachmentChars: 1_200 }).unattributed).toBe(5_000 - 3_660)
    expect(turnGrowth({ measured: 1_000, rows, attachmentChars: 0 }).unattributed).toBe(1_000 - 3_360)
  })

  test('labels show paths relative to the session folder', async () => {
    const long = '/srv/a/long/session/folder/that/goes/on/for/a/good/while/fixture'
    const rowsAt = [{ role: 'assistant' as const, text: '', toolUses: [{ tool_use_id: 'r', tool: 'Read', input: { file_path: `${long}/src/big.py` }, text: 'x'.repeat(400) }] }]
    expect(turnGrowth({ measured: 200, rows: rowsAt, attachmentChars: 0, cwd: long }).parts[0].label).toBe('Read src/big.py')
  })
})

