import type { Turn } from './transcript'

// Everything that leaves the transcript goes through here (see ADR 0003): only
// fields named below are copied, so a new field on Step stays out until added on purpose.
export function debugLine(turns: readonly Turn[]): string {
  return JSON.stringify({
    turns: turns.map(turn => ({
      index: turn.index,
      steps: turn.steps.map(step => ({ tool: step.tool, isError: step.isError, resultSize: step.resultSize })),
    })),
  })
}
