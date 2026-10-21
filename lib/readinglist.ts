import { changedFiles, flatSteps } from './transcript'
import type { Step, Turn } from './transcript'

// `agent` names the kind of subagent that did it; the main loop saw only that subagent's summary.
// `compaction` marks a read from before a compaction: re-attached by the engine afterwards, or not.
export type ReadingEntry =
  | { readonly kind: 'read'; readonly path: string; readonly agent?: string; readonly compaction?: 're-attached' | 'read before' }
  | { readonly kind: 'search'; readonly query: string; readonly agent?: string }

export type ReadingList = { readonly file: string; readonly entries: readonly ReadingEntry[] }

// Reads the transcript no longer holds because a compaction folded them away, kept as paths only,
// and the paths the engine attached again on the first request after it.
export type EarlierReads = {
  readonly reads: readonly { readonly path: string; readonly agent?: string }[]
  readonly reattached: readonly string[]
}

function editedFiles(step: Step): readonly string[] {
  if (!changedFiles(step)) return []
  if (step.shellEdit) return step.shellEdit.paths
  return step.path ? [step.path] : []
}

// For each file the turn edits: what the agent read earlier in the session before that edit.
export function readingLists(turn: Turn, session: readonly Turn[], earlier: EarlierReads = { reads: [], reattached: [] }): ReadingList[] {
  const steps = session.flatMap(flatSteps)
  const inTurn = new Set(flatSteps(turn).map(step => step.id))
  const agentTypes = new Map(steps.flatMap(step => (step.agentType && step.agentId ? [[step.agentId, step.agentType] as const] : [])))
  const lists = new Map<string, ReadingEntry[]>()
  const readSoFar: ReadingEntry[] = []
  const seen = new Map<string, number>()
  const add = (key: string, entry: ReadingEntry) => {
    const at = seen.get(key)
    if (at === undefined) {
      seen.set(key, readSoFar.length)
      readSoFar.push(entry)
    } else if (readSoFar[at].kind === 'read' && 'compaction' in readSoFar[at]) {
      // Read again since the compaction: in context once more, so unmarked, in its first place.
      readSoFar[at] = entry
    }
  }
  const reattached = new Set(earlier.reattached)
  for (const { path, agent } of earlier.reads) {
    add(`read:${path}`, { kind: 'read', path, ...(agent ? { agent } : {}), compaction: reattached.has(path) ? 're-attached' : 'read before' })
  }
  for (const step of steps) {
    const agent = step.kind !== 'delegate' && step.agentId ? agentTypes.get(step.agentId) : undefined
    const by = agent ? { agent } : {}
    if (step.kind === 'read') {
      for (const path of step.path ? [step.path] : (step.shellReads ?? [])) add(`read:${path}`, { kind: 'read', path, ...by })
    }
    if (step.kind === 'search' && step.summary) add(`search:${step.summary}`, { kind: 'search', query: step.summary, ...by })
    if (!inTurn.has(step.id)) continue
    for (const file of editedFiles(step)) if (!lists.has(file)) lists.set(file, [...readSoFar])
  }
  return [...lists].map(([file, entries]) => ({ file, entries }))
}
