import type { TestRun } from './testrun'
import { flatSteps, verificationOf } from './transcript'
import type { Turn } from './transcript'

export type FindingKind = 'unverified-edit' | 'ended-red'

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
  // Whole test ids the finding is about: for the pane only; strip them anywhere else (ADR 0003).
  readonly testIds?: readonly string[]
}

const TEST_FILE = /(^|\/)(tests?|__tests__|spec)\/|(^|\/)test_[^/]*\.py$|_test\.(py|go)$|\.(test|spec)\.[cm]?[jt]sx?$/

export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path)
}

// The session's first run of each runner, kept only if no source file had been edited before it.
function baselines(session: readonly Turn[]): Map<string, TestRun> {
  const found = new Map<string, TestRun>()
  const seen = new Set<string>()
  let sourceEdited = false
  for (const step of session.flatMap(flatSteps)) {
    if (step.kind === 'edit' && !(step.path && isTestFile(step.path))) sourceEdited = true
    if (!step.run || seen.has(step.run.runner)) continue
    seen.add(step.run.runner)
    if (!sourceEdited) found.set(step.run.runner, step.run)
  }
  return found
}

// Test ids failing at each runner's Baseline run.
export function alreadyFailing(session: readonly Turn[]): Map<string, Set<string>> {
  return new Map([...baselines(session)].map(([runner, run]) => [runner, new Set(run.failingIds)]))
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function endedRed(turn: Turn, session: readonly Turn[]): Finding | null {
  if (turn.isInterrupted) return null
  // The last test command decides; when its output couldn't be read, nothing is known.
  const runs = flatSteps(turn).filter(step => step.run || step.unreadableRun)
  const last = runs[runs.length - 1]?.run
  if (!last) return null
  const base = baselines(session).get(last.runner)
  const failing = last.failed + last.errors
  if (failing > 0 && last.failingIds.length === 0) {
    const before = base ? base.failed + base.errors : 0
    if (failing <= before) return null
    return {
      kind: 'ended-red',
      level: 'flag',
      title: 'Ended red',
      view: 'ledger',
      stepIds: [runs[runs.length - 1].id],
      reason: `The last test run has ${failing} failures against ${before} at the start of the session; its output named no tests, so this compares counts.`,
    }
  }
  const already = new Set(base?.failingIds ?? [])
  const fresh = last.failingIds.filter(id => !already.has(id))
  if (fresh.length === 0) return null
  return {
    kind: 'ended-red',
    level: 'flag',
    title: 'Ended red',
    view: 'ledger',
    stepIds: [runs[runs.length - 1].id],
    reason: `The last test run in this turn has ${plural(fresh.length, 'failing test that was', 'failing tests that were')} not failing at the start of the session.`,
    testIds: fresh,
  }
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
export function judge(turn: Turn, session: readonly Turn[] = [turn]): Finding[] | null {
  if (!turn.isSettled) return null
  return [unverifiedEdit(turn), endedRed(turn, session)].filter((f): f is Finding => f !== null)
}
