// A shell command line read just far enough to tell what each part does: quotes are honoured,
// but expansions, subshells, and functions are not interpreted.

export type Segment = {
  readonly argv: readonly string[]
  // Whether this part sends output to a file (`>` or `>>`, not to another descriptor).
  readonly writesFile: boolean
  readonly redirectTargets: readonly string[]
}

const SEPARATORS = new Set(['&&', '||', ';', '|', '&'])

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let hasToken = false
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < command.length) current += command[++i]
      else current += c
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      hasToken = true
      continue
    }
    if (c === '\\' && i + 1 < command.length) {
      current += command[++i]
      hasToken = true
      continue
    }
    if (c === ' ' || c === '\t' || c === '\n') {
      if (hasToken) tokens.push(current)
      current = ''
      hasToken = false
      if (c === '\n') tokens.push(';')
      continue
    }
    const two = command.slice(i, i + 2)
    if (two === '&&' || two === '||' || two === '>>') {
      if (hasToken) tokens.push(current)
      tokens.push(two)
      current = ''
      hasToken = false
      i++
      continue
    }
    if (c === ';' || c === '|' || c === '&' || c === '>' || c === '<') {
      // `2>&1`, `&>`, and `>&2` redirect descriptors; keep them as one token.
      if (c === '>' && command[i + 1] === '&') {
        if (hasToken) tokens.push(current)
        tokens.push('>&' + (command[i + 2] ?? ''))
        current = ''
        hasToken = false
        i += 2
        continue
      }
      if (c === '>' && hasToken && /^\d$/.test(current)) {
        tokens.push(current + '>')
        current = ''
        hasToken = false
        continue
      }
      if (hasToken) tokens.push(current)
      tokens.push(c)
      current = ''
      hasToken = false
      continue
    }
    current += c
    hasToken = true
  }
  if (hasToken) tokens.push(current)
  return tokens
}

// Heredoc bodies are data, not commands: drop each body up to its closing delimiter line.
function stripHeredocs(command: string): string {
  const lines = command.split('\n')
  const kept: string[] = []
  let closing: string | null = null
  for (const line of lines) {
    if (closing !== null) {
      if (line.trim() === closing) closing = null
      continue
    }
    kept.push(line)
    const start = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line)
    if (start) closing = start[2]
  }
  return kept.join('\n')
}

export function segments(command: string): Segment[] {
  command = stripHeredocs(command)
  const out: Segment[] = []
  let argv: string[] = []
  let targets: string[] = []
  const flush = () => {
    if (argv.length || targets.length) out.push({ argv, writesFile: targets.length > 0, redirectTargets: targets })
    argv = []
    targets = []
  }
  const tokens = tokenize(command)
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (SEPARATORS.has(token)) {
      flush()
      continue
    }
    if (token === '>' || token === '>>' || token === '1>') {
      const target = tokens[i + 1]
      if (target !== undefined && !SEPARATORS.has(target)) {
        if (target !== '/dev/null') targets.push(target)
        i++
      }
      continue
    }
    if (token === '<' || /^\d>$/.test(token)) {
      i++
      continue
    }
    if (token.startsWith('>&')) continue
    argv.push(token)
  }
  flush()
  // Leading `VAR=value` assignments only set the environment of the command after them.
  return out.map(segment => {
    let start = 0
    while (start < segment.argv.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(segment.argv[start])) start++
    return start === 0 ? segment : { ...segment, argv: segment.argv.slice(start) }
  })
}

export function basename(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}
