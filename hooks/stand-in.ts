// What the engine answers beneath the plugin in a session, for the hooks tests.
export type StandIn = { logs: string[]; opened: string[]; toasts: string[]; statuses: (string | undefined)[] }

// `rows` is the main transcript, or a function answering each `session.messages` call.
export function standIn(on: any, rows: unknown[] | ((e: { agentId?: string }) => unknown[]) = []): StandIn {
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
  on('command.register', () => ({ value: undefined }))
  return seen
}
