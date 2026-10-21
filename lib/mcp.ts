import type { ToolUse } from './transcript'

// MCP servers that stand in for the built-in tools (lean-ctx, filesystem servers): read by their
// short name and arguments as the built-in tool they replace, so every rule treats them alike.
const SHELL = /^(ctx_)?(shell|bash|exec|execute|run_command|execute_command)$/
const READ = /^(ctx_)?(read|read_file|read_text_file)$/
const EDIT = /^(ctx_)?(patch|edit|edit_file|write|write_file|create_file)$/
const SEARCH = /^(ctx_)?(search|grep|search_files)$/
const LIST = /^(ctx_)?(glob|tree|list_dir|list_directory)$/

export function shortName(tool: string): string {
  return tool.startsWith('mcp__') ? tool.slice(tool.lastIndexOf('__') + 2) : tool
}

function text(input: Readonly<Record<string, unknown>>, ...fields: string[]): string | undefined {
  for (const field of fields) if (typeof input[field] === 'string') return input[field] as string
  return undefined
}

// The built-in tool an MCP call stands in for, or the call unchanged.
export function asBuiltIn(use: ToolUse): ToolUse {
  if (!use.tool.startsWith('mcp__')) return use
  const name = shortName(use.tool)
  const input = use.input
  const paths = Array.isArray(input.paths) ? (input.paths as unknown[]).filter((p): p is string => typeof p === 'string') : []
  const path = text(input, 'path', 'file_path') ?? paths[0]
  const command = text(input, 'command')
  if (SHELL.test(name) && command) return { ...use, tool: 'Bash', input: { command } }
  if (READ.test(name) && path) return { ...use, tool: 'Read', input: { file_path: path } }
  if (EDIT.test(name) && path) {
    const content = text(input, 'content')
    if (content !== undefined) return { ...use, tool: 'Write', input: { file_path: path, content } }
    return {
      ...use,
      tool: 'Edit',
      input: { file_path: path, old_string: text(input, 'old_string', 'old_text', 'find') ?? '', new_string: text(input, 'new_string', 'new_text', 'new_body', 'replace') ?? '' },
    }
  }
  const pattern = text(input, 'pattern', 'query')
  if (SEARCH.test(name) && pattern) return { ...use, tool: 'Grep', input: { pattern } }
  if (LIST.test(name)) return { ...use, tool: 'Glob', input: { pattern: pattern ?? path ?? '' } }
  return use
}
