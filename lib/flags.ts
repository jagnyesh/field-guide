import { covers, testIdFile } from './testrun'
import type { TestRun } from './testrun'
import { flatSteps, verificationOf } from './transcript'
import type { Step, Turn } from './transcript'

export type FindingKind = 'unverified-edit' | 'ended-red' | 'red-step' | 'test-changed-to-pass' | 'test-and-source-changed'

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

const testFile = testIdFile

// Tools write absolute paths, runners print paths relative to their root: compare by suffix.
function samePath(a: string, b: string): boolean {
  const trim = (p: string) => p.replace(/^\.\//, '')
  const [x, y] = [trim(a), trim(b)]
  return x === y || x.endsWith('/' + y) || y.endsWith('/' + x)
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
  const edits = flatSteps(turn).filter(step => step.kind === 'edit')
  const testEdits = edits.filter(step => step.path && isTestFile(step.path))
  const isRedStep =
    edits.length === testEdits.length &&
    fresh.every(id => testEdits.some(step => step.path !== undefined && samePath(step.path, testFile(id))))
  if (isRedStep) {
    return {
      kind: 'red-step',
      level: 'note',
      title: 'Red step',
      view: 'ledger',
      stepIds: [runs[runs.length - 1].id],
      reason: 'The new failures are all in tests this turn wrote, and no source file changed: the first step of test-driven development, before the code exists.',
      testIds: fresh,
    }
  }
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
// For each test that failed and then passed in a run this turn: the edits between the two runs.
function passTransitions(turn: Turn, session: readonly Turn[]): { id: string; between: Step[] }[] {
  const steps = session.flatMap(flatSteps)
  const inTurn = new Set(flatSteps(turn).map(step => step.id))
  const found = new Map<string, Step[]>()
  steps.forEach((later, j) => {
    const run = later.run
    if (!run || !inTurn.has(later.id)) return
    const failingNow = new Set(run.failingIds)
    for (let i = j - 1; i >= 0; i--) {
      const earlier = steps[i].run
      if (!earlier || earlier.runner !== run.runner) continue
      for (const id of earlier.failingIds) {
        if (found.has(id) || failingNow.has(id) || !covers(run, id) || !covers(earlier, id)) continue
        found.set(id, steps.slice(i + 1, j).filter(step => step.kind === 'edit'))
      }
      break
    }
  })
  return [...found].map(([id, between]) => ({ id, between }))
}

function changedTests(turn: Turn, session: readonly Turn[]): Finding[] {
  const flagged: string[] = []
  const noted: string[] = []
  for (const { id, between } of passTransitions(turn, session)) {
    const own = between.filter(step => step.path !== undefined && samePath(step.path, testFile(id)))
    if (own.length === 0) continue
    const sourceChanged = between.some(step => !(step.path && isTestFile(step.path)))
    if (own.some(step => step.addsMarker) || !sourceChanged) flagged.push(id)
    else noted.push(id)
  }
  const out: Finding[] = []
  if (flagged.length) {
    out.push({
      kind: 'test-changed-to-pass',
      level: 'flag',
      title: 'Test changed to pass',
      view: 'ledger',
      stepIds: [],
      reason: `${plural(flagged.length, 'test', 'tests')} failed and then passed with only the test itself edited in between: check whether the test or the code was wrong.`,
      testIds: flagged,
    })
  }
  if (noted.length) {
    out.push({
      kind: 'test-and-source-changed',
      level: 'note',
      title: 'Test and source both changed',
      view: 'ledger',
      stepIds: [],
      reason: `${plural(noted.length, 'test', 'tests')} passed after both the test and the source changed: usual for a bug fix, worth a look at what the test now asserts.`,
      testIds: noted,
    })
  }
  return out
}

export function judge(turn: Turn, session: readonly Turn[] = [turn]): Finding[] | null {
  if (!turn.isSettled) return null
  return [unverifiedEdit(turn), endedRed(turn, session), ...changedTests(turn, session)].filter((f): f is Finding => f !== null)
}
