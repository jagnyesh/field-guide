import { describe, expect, test } from 'claude-code/testing'
import { readingLists } from './readinglist'
import { buildTimeline } from './transcript'
import type { ToolUse, TranscriptMessage } from './transcript'

const prompt = (text: string): TranscriptMessage => ({ role: 'user', text })
const reply = (toolUses: ToolUse[]): TranscriptMessage => ({ role: 'assistant', text: '', toolUses })
const use = (id: string, tool: string, input: Record<string, unknown>): ToolUse => ({ tool_use_id: id, tool, input, text: 'ok' })
const read = (id: string, path: string) => use(id, 'Read', { file_path: path })
const edit = (id: string, path: string) => use(id, 'Edit', { file_path: path })

describe('Reading List', () => {
  test('lists, for each edited file, what was read earlier in the session before that edit, once each, in first-read order', async () => {
    const turns = buildTimeline([
      prompt('look around'),
      reply([read('r1', 'src/settings.ini')]),
      prompt('now change the limit'),
      reply([read('r2', 'src/ratelimit.py'), read('r3', 'src/settings.ini'), edit('e1', 'src/ratelimit.py'), read('r4', 'README.md')]),
    ])
    const lists = readingLists(turns[1], turns)
    expect(lists.map(l => [l.file, l.entries.map(e => (e.kind === 'read' ? e.path : e.query))])).toEqual([['src/ratelimit.py', ['src/settings.ini', 'src/ratelimit.py']]])
  })

  test("lists a subagent's reads under that subagent, a search as its query, and files a read-only shell command printed", async () => {
    const turns = buildTimeline(
      [
        prompt('fix lookup'),
        reply([
          { ...use('a', 'Agent', { description: 'Find lookup', subagent_type: 'Explore' }), agentId: 'x1' },
          use('g', 'Grep', { pattern: 'def lookup', path: 'src' }),
          use('c', 'Bash', { command: 'cat src/lookup.py tests/test_lookup.py' }),
          edit('e', 'src/lookup.py'),
        ]),
      ],
      () => [reply([read('s1', 'src/__init__.py')])],
    )
    const [list] = readingLists(turns[0], turns)
    expect(list.entries).toEqual([
      { kind: 'read', path: 'src/__init__.py', agent: 'Explore' },
      { kind: 'search', query: 'def lookup' },
      { kind: 'read', path: 'src/lookup.py' },
      { kind: 'read', path: 'tests/test_lookup.py' },
    ])
  })
})

