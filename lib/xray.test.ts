import { describe, expect, test } from 'claude-code/testing'
import { fixedLoad } from './xray'

const category = (name: string, tokens: number, kind: 'used' | 'free' | 'buffer' | 'deferred' = 'used') => ({ name, tokens, color: 'x', isDeferred: kind === 'deferred', kind })

const BREAKDOWN = {
  categories: [
    category('System prompt', 3_100),
    category('System tools', 11_800),
    category('MCP tools', 4_200),
    category('Memory files', 2_600),
    category('Messages', 40_000),
    category('Free space', 140_000, 'free'),
    category('Autocompact buffer', 33_000, 'buffer'),
  ],
  memoryFiles: [{ path: '/home/dev/.claude/CLAUDE.md', type: 'User', tokens: 1_900 }, { path: '/work/CLAUDE.md', type: 'Project', tokens: 700 }],
  mcpTools: [
    { name: 'mcp__ctx__read', serverName: 'ctx', tokens: 1_500, isLoaded: true },
    { name: 'mcp__ctx__search', serverName: 'ctx', tokens: 1_200, isLoaded: true },
    { name: 'mcp__docs__query', serverName: 'docs', tokens: 1_500, isLoaded: true },
  ],
}

describe('Context X-ray: fixed load', () => {
  test('is what every request pays before the conversation: largest first, without messages, free space, or buffer', async () => {
    const load = fixedLoad({ breakdown: BREAKDOWN })
    expect(load.categories).toEqual([
      { name: 'System tools', tokens: 11_800 },
      { name: 'MCP tools', tokens: 4_200 },
      { name: 'System prompt', tokens: 3_100 },
      { name: 'Memory files', tokens: 2_600 },
    ])
    expect(load.total).toBe(21_700)
  })

  test('groups MCP tools by server, largest first', async () => {
    expect(fixedLoad({ breakdown: BREAKDOWN }).mcpServers).toEqual([
      { server: 'ctx', tokens: 2_700, tools: 2 },
      { server: 'docs', tokens: 1_500, tools: 1 },
    ])
  })

  test('traces each memory file to the files it imported, with paths and estimated sizes', async () => {
    const ancestors = [
      {
        dir: '/work',
        name: 'CLAUDE.md',
        content: '',
        parts: [
          { path: '/work/CLAUDE.md', content: 'x'.repeat(2_000) },
          { path: '/work/docs/style.md', content: 'y'.repeat(800) },
        ],
      },
    ]
    expect(fixedLoad({ breakdown: BREAKDOWN, ancestors }).memory).toEqual([
      { path: '/home/dev/.claude/CLAUDE.md', type: 'User', tokens: 1_900, imports: [] },
      { path: '/work/CLAUDE.md', type: 'Project', tokens: 700, imports: [{ path: '/work/docs/style.md', approxTokens: 200 }] },
    ])
  })

  test('lists system-prompt sections by name with estimated sizes, largest first', async () => {
    const sections = [{ name: 'env_info_simple', chars: 400 }, { name: 'mcp_instructions', chars: 9_000 }, { name: 'memory', chars: 0 }]
    expect(fixedLoad({ breakdown: BREAKDOWN, sections }).sections).toEqual([
      { name: 'mcp_instructions', approxTokens: 2_250 },
      { name: 'env_info_simple', approxTokens: 100 },
    ])
  })
})

