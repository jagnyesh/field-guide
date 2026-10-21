import type { Step, Turn } from './transcript'

type StepMetadata = { tool: string; kind: string; isError: boolean; resultSize: number; children?: StepMetadata[] }

function stepMetadata(step: Step): StepMetadata {
  const out: StepMetadata = { tool: step.tool, kind: step.kind, isError: step.isError, resultSize: step.resultSize }
  if (step.children) out.children = step.children.map(stepMetadata)
  return out
}

// Everything that leaves the transcript goes through here (see ADR 0003): only
// fields named above are copied, so a new field on Step stays out until added on purpose.
export function debugLine(turns: readonly Turn[]): string {
  return JSON.stringify({ turns: turns.map(turn => ({ index: turn.index, steps: turn.steps.map(stepMetadata) })) })
}
