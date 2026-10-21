import { asBuiltIn, shortName } from './mcp'
import { summarize } from './transcript'
import type { TranscriptMessage } from './transcript'
import { approxTokens } from './xray'

export type GrowthPart = { readonly label: string; readonly approxTokens: number }

// One turn's measured growth (exact, from the engine), split across its messages (estimates), and
// what the estimates leave over: reminders, formatting, thinking. Never scaled to fit (CONTEXT.md).
export type TurnGrowth = { readonly measured: number; readonly parts: readonly GrowthPart[]; readonly unattributed: number }

export type GrowthInput = {
  readonly measured: number
  // The turn's transcript rows, read for lengths only.
  readonly rows: readonly TranscriptMessage[]
  readonly attachmentChars: number
  // The session's folder: labels show paths under it relative to it.
  readonly cwd?: string
}

export function turnGrowth({ measured, rows, attachmentChars, cwd = '' }: GrowthInput): TurnGrowth {
  const parts: GrowthPart[] = []
  let prompt = 0
  let text = 0
  for (const row of rows) {
    if (row.role === 'user') {
      if (!row.toolResults?.length) prompt += row.text.length
      continue
    }
    text += row.text.length
    for (const use of row.toolUses ?? []) {
      parts.push({ label: `${shortName(use.tool)} ${summarize(asBuiltIn(use), cwd)}`.trimEnd(), approxTokens: approxTokens(use.text?.length ?? 0) })
    }
  }
  if (attachmentChars > 0) parts.push({ label: 'Attachments', approxTokens: approxTokens(attachmentChars) })
  if (prompt > 0) parts.push({ label: 'Your prompt', approxTokens: approxTokens(prompt) })
  if (text > 0) parts.push({ label: 'Agent text', approxTokens: approxTokens(text) })
  const sorted = parts.filter(p => p.approxTokens > 0).sort((a, b) => b.approxTokens - a.approxTokens)
  return { measured, parts: sorted, unattributed: measured - sorted.reduce((sum, p) => sum + p.approxTokens, 0) }
}
