// Field Guide's $.state contract. Values here are metadata only (ADR 0003): flag keys, the Live
// Probe's read-only flag, changed paths and timings, compaction counts, and paths read: never transcript text.
export type ProbeRecord = { isReadOnly?: boolean; shellEdits?: string[] }

// When a tool call was made and how long until it was answered, in $.clock.now()'s milliseconds.
export type CallTiming = { startedAt: number; durationMs: number }

// A turn's first start and last end across the main-loop turns it took (hand-backs included).
export type TurnTiming = { startedAt: number; endedAt: number }

// `at` and `turn` are absent on records an earlier version stored.
export type CompactionState = { trigger: string; tokensBefore?: number; tokensAfter?: number; kept: number; summarised: number; at?: number; turn?: number }

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
      timing: Record<string, CallTiming>
      turnTiming: Record<string, TurnTiming>
    }
  }
}
