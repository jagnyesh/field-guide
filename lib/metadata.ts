import type { Finding } from './flags'
import type { TestRun } from './testrun'
import { verificationOf } from './transcript'
import type { Step, Turn } from './transcript'

// Parameter values can carry data (pytest puts them into the id), so outside the developer's own
// pane an id keeps only its file and test name.
export function stripParams(id: string): string {
  return id.replace(/\[[^\]]*\]/g, '[…]')
}

type RunMetadata = Omit<TestRun, 'failingIds' | 'scope'> & { failingIds: string[] }

type StepMetadata = {
  tool: string
  kind: string
  isError: boolean
  resultSize: number
  verification?: string
  run?: RunMetadata
  children?: StepMetadata[]
}

function runMetadata(run: TestRun): RunMetadata {
  const { runner, passed, failed, errors, skipped } = run
  return { runner, passed, failed, errors, skipped, failingIds: run.failingIds.map(stripParams) }
}

function stepMetadata(step: Step): StepMetadata {
  const out: StepMetadata = { tool: step.tool, kind: step.kind, isError: step.isError, resultSize: step.resultSize }
  if (step.verification) out.verification = step.verification
  if (step.run) out.run = runMetadata(step.run)
  if (step.children) out.children = step.children.map(stepMetadata)
  return out
}

// Everything that leaves the transcript goes through here (see ADR 0003): only
// fields named above are copied, so a new field on Step stays out until added on purpose.
export function debugLine(turns: readonly Turn[], findings: readonly Finding[] = []): string {
  return JSON.stringify({
    turns: turns.map(turn => ({ index: turn.index, verification: verificationOf(turn), steps: turn.steps.map(stepMetadata) })),
    findings: findings.map(({ kind, level }) => ({ kind, level })),
  })
}
