import { mock } from 'claude-code/testing'

// What the engine answers beneath the plugin in a session, for the hooks tests.
export type StandIn = {
  logs: string[]
  opened: string[]
  toasts: string[]
  statuses: (string | undefined)[]
  filled: string[]
  processes: { argv: string[]; timeoutMs?: number }[]
  usageArgs: unknown[]
}

// `rows` is the main transcript, or a function answering each `session.messages` call.
export type StandInOptions = {
  band?: unknown
  // The /context breakdown the engine would estimate, and the instruction files it would find.
  breakdown?: unknown
  ancestors?: unknown[]
  // What `git status --porcelain -z -uall` prints after a shell call, and each file's mtime.
  status?: string
  mtimes?: Record<string, number>
}

export function standIn(on: any, rows: unknown[] | ((e: { agentId?: string }) => unknown[]) = [], options: StandInOptions = {}): StandIn {
  const seen: StandIn = { logs: [], opened: [], toasts: [], statuses: [], filled: [], processes: [], usageArgs: [] }
  mock.store(on)
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.messages', (_: unknown, e: { agentId?: string }) => ({ value: typeof rows === 'function' ? rows(e ?? {}) : rows }))
  on('ui.open', (_: unknown, e: { id: string }) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.log', (_: unknown, e: { text: string }) => {
    seen.logs.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', (_: unknown, e: { text: string }) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_: unknown, e: { text?: string }) => {
    seen.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.invalidate', () => ({ value: undefined }))
  on('process.run', (_: unknown, e: { argv: string[]; init?: { timeoutMs?: number } }) => {
    seen.processes.push({ argv: e.argv, timeoutMs: e.init?.timeoutMs })
    const isRepo = options.status !== undefined
    const stdout = e.argv.includes('--show-toplevel') ? '/work\n' : (options.status ?? '')
    return { value: { exitCode: isRepo ? 0 : 128, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // Paths arrive absolute; the test names them relative to the repository.
  const mtimeOf = (path: string) => Object.entries(options.mtimes ?? {}).find(([name]) => path.endsWith('/' + name))?.[1] ?? 0
  on('fs.stat', (_: unknown, e: { path: string }) => ({ value: { kind: 'file', size: 1, mtimeMs: mtimeOf(e.path), isLink: false } }))
  on('prompt.submit', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('prompt.fill', (_: unknown, e: { text: string }) => {
    seen.filled.push(e.text)
    return { isFilled: true }
  })
  on('session.usage', (_: unknown, e: { breakdown?: string } | undefined) => {
    seen.usageArgs.push(e ?? {})
    const breakdown = e?.breakdown && options.breakdown ? { breakdown: options.breakdown } : {}
    return { value: { startedAt: 0, context: { tokens: 50_000, window: 200_000, percent: 25, ...breakdown }, rateLimits: [] } }
  })
  on('fs.ancestors', () => ({ value: options.ancestors ?? [] }))
  on('prompt.section', (_: unknown, e: { text: string | null }) => ({ text: e.text }))
  on('command.register', () => ({ value: undefined }))
  // Nothing of the engine's own is drawn in the band unless a test says so.
  on('ui.render', { component: 'AbovePrompt' }, () => options.band ?? { type: 'engine', ref: 0 })
  return seen
}
