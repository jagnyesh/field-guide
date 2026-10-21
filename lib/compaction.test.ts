import { describe, expect, test } from 'claude-code/testing'
import { diffCompaction } from './compaction'

const row = (role: 'user' | 'assistant', text: string, handle?: string) => ({ role, text, toolUses: [], ...(handle ? { handle } : {}) })

describe('Compaction Diff', () => {
  test('a message was kept word for word only if its handle was in the input; the summary arrives with a new one', async () => {
    // The shape seen live: six messages in, two out, the summary new and "ok" kept.
    const input = [row('user', 'read a.txt', 'h1'), row('assistant', '', 'h2'), row('user', '', 'h3'), row('assistant', '', 'h4'), row('user', '', 'h5'), row('assistant', 'ok', 'h6')]
    const output = [row('user', 'This session is being continued from a previous conversation…', 's1'), row('assistant', 'ok', 'h6')]
    expect(diffCompaction({ trigger: 'manual', messages: input }, { messages: output, tokensBefore: 35_383, tokensAfter: 2_217 })).toEqual({
      trigger: 'manual',
      tokensBefore: 35_383,
      tokensAfter: 2_217,
      kept: 1,
      summarised: 5,
    })
  })

  test('a skipped compaction, or one that kept nothing countable, records what it can', async () => {
    expect(diffCompaction({ trigger: 'auto', messages: [row('user', 'x', 'h1')] }, { skip: 'a hook said no' })).toBeNull()
    expect(diffCompaction({ trigger: 'auto', messages: [row('user', 'x', 'h1')] }, { messages: [row('user', 'summary', 's1')] })).toEqual({
      trigger: 'auto',
      kept: 0,
      summarised: 1,
    })
  })
})
