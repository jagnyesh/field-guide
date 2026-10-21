import type { Finding } from './flags'
import type { TestRun } from './testrun'
import { verificationOf } from './transcript'
import type { Step, Turn } from './transcript'

// Parameter values can carry data, so outside the developer's own pane: a pytest id keeps its
// file and test name but not its bracketed parameters; a vitest or jest id keeps only its file,
// since those runners write parameter values into the test's name.
export function stripParams(id: string): string {
  const js = / > | › /.exec(id)
  if (js) return `${id.slice(0, js.index)}${js[0]}…`
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
  shellEdit?: { exact: boolean; paths: string[] }
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
  if (step.shellEdit) out.shellEdit = { exact: step.shellEdit.exact, paths: [...step.shellEdit.paths] }
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
