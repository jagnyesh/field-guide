// Field Guide's $.state contract. Values here are metadata only (ADR 0003): flag keys, the Live
// Probe's read-only flag and changed paths, compaction counts, and paths read: never transcript text.
export type ProbeRecord = { isReadOnly?: boolean; shellEdits?: string[] }

export type CompactionState = { trigger: string; tokensBefore?: number; tokensAfter?: number; kept: number; summarised: number }

export type EarlierRead = { path: string; agent?: string }

// After a compaction: waiting for the next request ('pending'), inside it ('in-turn'), or past it.
export type ReattachWindow = 'pending' | 'in-turn' | 'closed'

// Kept in the plugin's store, not $.state, so a resumed session (a new process) still has it.
export type CompactionMemory = {
  compactions: CompactionState[]
  earlierReads: EarlierRead[]
  reattached: string[]
  window: ReattachWindow
}

declare module 'claude-code' {
  interface PluginState {
    'field-guide': {
      toasted: string[]
      acknowledged: string[]
      probe: Record<string, ProbeRecord>
    }
  }
}
