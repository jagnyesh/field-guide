import { flatSteps, verificationOf } from './transcript'
import type { Turn } from './transcript'

export type FindingKind = 'unverified-edit'

// A flag is raised in the band; a note shows only inside its view (CONTEXT.md).
export type Finding = {
  readonly kind: FindingKind
  readonly level: 'flag' | 'note'
  readonly title: string
  // The view that explains it; opening that view acknowledges the flag.
  readonly view: 'trace' | 'ledger'
  // The steps that set it off.
  readonly stepIds: readonly string[]
  // One sentence on why it fired, stating the principle.
  readonly reason: string
}

function unverifiedEdit(turn: Turn): Finding | null {
  const edits = flatSteps(turn).filter(step => step.kind === 'edit')
  if (edits.length === 0 || verificationOf(turn) !== null) return null
  return {
    kind: 'unverified-edit',
    level: 'flag',
    title: 'Unverified edit',
    view: 'trace',
    stepIds: [edits[edits.length - 1].id],
    reason: 'Files changed and no test, lint, type check, or build ran after the last edit, so nothing has shown the change works.',
  }
}

// Findings for a Settled turn, or null while it hasn't settled: a flag judged halfway through is often wrong.
export function judge(turn: Turn): Finding[] | null {
  if (!turn.isSettled) return null
  return [unverifiedEdit(turn)].filter((f): f is Finding => f !== null)
}
