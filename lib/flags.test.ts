import { describe, expect, test } from 'claude-code/testing'
import { judge } from './flags'
import { OUTPUT } from './fixtures/pytest'
import { buildTimeline } from './transcript'
import type { ToolUse, TranscriptMessage } from './transcript'

const prompt = (text: string): TranscriptMessage => ({ role: 'user', text })
const reply = (toolUses: ToolUse[]): TranscriptMessage => ({ role: 'assistant', text: '', toolUses })
const use = (id: string, tool: string, input: Record<string, unknown>, text = 'ok'): ToolUse => ({ tool_use_id: id, tool, input, text })
const edit = (id: string) => use(id, 'Edit', { file_path: 'src/ratelimit.py' })
const pytest = (id: string) => use(id, 'Bash', { command: 'pytest -q' }, OUTPUT['all-pass'])
const turnOf = (...uses: ToolUse[]) => buildTimeline([prompt('go'), reply(uses)])[0]

describe('Loop Flags: Unverified edit', () => {
  test('fires for a Settled turn with an edit and nothing verifying it afterwards', async () => {
    const findings = judge(turnOf(pytest('p'), edit('e')))
    expect(findings?.map(f => [f.kind, f.level, f.stepIds])).toEqual([['unverified-edit', 'flag', ['e']]])
    expect(findings?.[0].reason.length).toBeGreaterThan(20)
  })

  test('does not fire when a test run follows the last edit', async () => {
    expect(judge(turnOf(edit('e'), pytest('p')))).toEqual([])
  })

  test('judges nothing before the turn settles', async () => {
    const turn = buildTimeline([
      prompt('go'),
      reply([edit('e'), { ...use('a', 'Agent', { description: 'x' }), agentId: 'a1', result: { status: 'async_launched' } }]),
    ])[0]
    expect(judge(turn)).toBeNull()
  })
})
