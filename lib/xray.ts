// The context's Fixed load: what every request pays before the conversation (CONTEXT.md).

type Category = { readonly name: string; readonly tokens: number; readonly kind: string }
type McpTool = { readonly serverName: string; readonly tokens: number; readonly isLoaded: boolean }
type McpServer = { readonly server: string; readonly tokens: number; readonly tools: number }

export type BreakdownInput = {
  readonly categories: readonly Category[]
  readonly memoryFiles?: readonly { readonly path: string; readonly type: string; readonly tokens: number }[]
  readonly mcpTools?: readonly McpTool[]
}

// An instruction file as the engine's memory loader read it: the file, then each file it imported.
export type AncestorInput = { readonly dir: string; readonly name: string; readonly parts: readonly { readonly path: string; readonly content: string }[] }

export type MemoryFile = {
  readonly path: string
  readonly type: string
  readonly tokens: number
  readonly imports: readonly { readonly path: string; readonly approxTokens: number }[]
}

export type FixedLoad = {
  readonly categories: readonly { readonly name: string; readonly tokens: number }[]
  readonly total: number
  readonly mcpServers: readonly McpServer[]
  // Schemas the engine loads on demand (ToolSearch): only their names are paid until one is searched for.
  readonly mcpDeferred: readonly McpServer[]
  readonly memory: readonly MemoryFile[]
  readonly sections: readonly { readonly name: string; readonly approxTokens: number }[]
}

// A local estimate from text length, marked ≈ wherever it shows.
export function approxTokens(chars: number): number {
  return Math.ceil(chars / 4)
}

// The conversation grows turn by turn; everything else in use is paid again on every request.
const CONVERSATION = /message/i

export type FixedLoadInput = {
  readonly breakdown: BreakdownInput
  readonly ancestors?: readonly AncestorInput[]
  // System-prompt sections by name, sized by their text's length (the text itself is not kept).
  readonly sections?: readonly { readonly name: string; readonly chars: number }[]
}

export function fixedLoad({ breakdown, ancestors = [], sections = [] }: FixedLoadInput): FixedLoad {
  const categories = breakdown.categories
    .filter(c => c.kind === 'used' && !CONVERSATION.test(c.name))
    .map(({ name, tokens }) => ({ name, tokens }))
    .sort((a, b) => b.tokens - a.tokens)
  const tools = breakdown.mcpTools ?? []
  const imported = new Map(ancestors.map(a => [`${a.dir}/${a.name}`, a.parts.slice(1)]))
  return {
    categories,
    total: categories.reduce((sum, c) => sum + c.tokens, 0),
    mcpServers: byServer(tools.filter(t => t.isLoaded)),
    mcpDeferred: byServer(tools.filter(t => !t.isLoaded)),
    memory: (breakdown.memoryFiles ?? []).map(file => ({
      path: file.path,
      type: file.type,
      tokens: file.tokens,
      imports: (imported.get(file.path) ?? []).map(part => ({ path: part.path, approxTokens: approxTokens(part.content.length) })),
    })),
    sections: sections
      .filter(section => section.chars > 0)
      .map(section => ({ name: section.name, approxTokens: approxTokens(section.chars) }))
      .sort((a, b) => b.approxTokens - a.approxTokens),
  }
}

function byServer(tools: readonly McpTool[]): McpServer[] {
  const servers = new Map<string, { tokens: number; tools: number }>()
  for (const tool of tools) {
    const server = servers.get(tool.serverName) ?? { tokens: 0, tools: 0 }
    servers.set(tool.serverName, { tokens: server.tokens + tool.tokens, tools: server.tools + 1 })
  }
  return [...servers].map(([server, s]) => ({ server, ...s })).sort((a, b) => b.tokens - a.tokens)
}
