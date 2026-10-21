import { flatSteps } from './transcript'
import type { Step, Turn } from './transcript'

// `agent` names the kind of subagent that did it; the main loop saw only that subagent's summary.
export type ReadingEntry =
  | { readonly kind: 'read'; readonly path: string; readonly agent?: string }
  | { readonly kind: 'search'; readonly query: string; readonly agent?: string }

export type ReadingList = { readonly file: string; readonly entries: readonly ReadingEntry[] }

function editedFiles(step: Step): readonly string[] {
  if (step.kind !== 'edit') return []
  if (step.shellEdit) return step.shellEdit.paths
  return step.path ? [step.path] : []
}

// For each file the turn edits: what the agent read earlier in the session before that edit.
export function readingLists(turn: Turn, session: readonly Turn[]): ReadingList[] {
  const steps = session.flatMap(flatSteps)
  const inTurn = new Set(flatSteps(turn).map(step => step.id))
  const agentTypes = new Map(steps.flatMap(step => (step.agentType && step.agentId ? [[step.agentId, step.agentType] as const] : [])))
  const lists = new Map<string, ReadingEntry[]>()
  const readSoFar: ReadingEntry[] = []
  const seen = new Set<string>()
  const add = (key: string, entry: ReadingEntry) => {
    if (seen.has(key)) return
    seen.add(key)
    readSoFar.push(entry)
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
