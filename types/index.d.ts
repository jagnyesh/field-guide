// Field Guide's $.state contract. Values here are metadata only (ADR 0003): flag keys of the form
// "<turn index>:<finding kind>", and per tool call the Live Probe's read-only flag and changed paths.
export type ProbeRecord = { isReadOnly?: boolean; shellEdits?: string[] }

declare module 'claude-code' {
  interface PluginState {
    'field-guide': {
      toasted: string[]
      acknowledged: string[]
      probe: Record<string, ProbeRecord>
    }
  }
}
