type HandledMessage = { readonly handle?: string }

export type CompactionInput = { readonly trigger: string; readonly messages: readonly HandledMessage[] }

export type CompactionOutput =
  | { readonly messages: readonly HandledMessage[]; readonly tokensBefore?: number; readonly tokensAfter?: number; readonly skip?: undefined }
  | { readonly skip: string; readonly messages?: undefined }

// Metadata only: what a compaction kept and folded away, never the text (ADR 0003).
export type CompactionRecord = {
  readonly trigger: string
  readonly tokensBefore?: number
  readonly tokensAfter?: number
  // Messages that came through word for word, and input messages folded into the summary.
  readonly kept: number
  readonly summarised: number
}

// A message kept word for word still carries its input handle; the summary arrives with a new one.
export function diffCompaction(input: CompactionInput, output: CompactionOutput): CompactionRecord | null {
  if (output.skip !== undefined || !output.messages) return null
  const inputHandles = new Set(input.messages.flatMap(message => (message.handle ? [message.handle] : [])))
  const kept = output.messages.filter(message => message.handle !== undefined && inputHandles.has(message.handle)).length
  return {
    trigger: input.trigger,
    ...(output.tokensBefore !== undefined ? { tokensBefore: output.tokensBefore } : {}),
    ...(output.tokensAfter !== undefined ? { tokensAfter: output.tokensAfter } : {}),
    kept,
    summarised: input.messages.length - kept,
  }
}
