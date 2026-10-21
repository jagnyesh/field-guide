// What the engine answers beneath the plugin in a session, for the hooks tests.
export type StandIn = { logs: string[]; opened: string[]; toasts: string[]; statuses: (string | undefined)[] }

// `rows` is the main transcript, or a function answering each `session.messages` call.
export type StandInOptions = { band?: unknown }

export function standIn(on: any, rows: unknown[] | ((e: { agentId?: string }) => unknown[]) = [], options: StandInOptions = {}): StandIn {
  const seen: StandIn = { logs: [], opened: [], toasts: [], statuses: [] }
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
  on('session.usage', () => ({ value: { startedAt: 0, context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [] } }))
  on('command.register', () => ({ value: undefined }))
  // Nothing of the engine's own is drawn in the band unless a test says so.
  on('ui.render', { component: 'AbovePrompt' }, () => options.band ?? { type: 'engine', ref: 0 })
  return seen
}
