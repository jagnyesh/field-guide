export type ToolUse = {
  readonly tool_use_id: string
  readonly tool: string
  readonly input: Readonly<Record<string, unknown>>
  readonly text?: string
  readonly isError?: true
  readonly agentId?: string
}

export type TranscriptMessage = {
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly toolUses?: readonly ToolUse[]
  readonly toolResults?: readonly unknown[]
}

export type Step = {
  readonly id: string
  readonly tool: string
  readonly summary: string
  readonly isError: boolean
  readonly resultSize: number
}

const SUMMARY_LIMIT = 80

// The input field that says what a step is about, by tool; tools not listed get no summary.
const SUMMARY_FIELD: Readonly<Record<string, string>> = {
  Read: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  Write: 'file_path',
  NotebookEdit: 'notebook_path',
  Bash: 'command',
  Grep: 'pattern',
  Glob: 'pattern',
  Agent: 'description',
  Task: 'description',
  WebFetch: 'url',
  WebSearch: 'query',
}

export function summarize(use: ToolUse): string {
  const field = SUMMARY_FIELD[use.tool]
  const value = field ? use.input[field] : undefined
  if (typeof value !== 'string') return ''
  const line = value.split('\n')[0].trim()
  return line.length > SUMMARY_LIMIT ? line.slice(0, SUMMARY_LIMIT - 1) + '…' : line
}

function toStep(use: ToolUse): Step {
  return {
    id: use.tool_use_id,
    tool: use.tool,
    summary: summarize(use),
    isError: use.isError === true,
    resultSize: use.text?.length ?? 0,
  }
}

export type Turn = {
  readonly index: number
  readonly steps: Step[]
}

// The engine writes these rows as user messages; none of them is the developer asking for work.
const ENGINE_WRITTEN = [
  /^<(task-notification|local-command-stdout|local-command-stderr|system-reminder|bash-stdout|bash-stderr)\b/,
  /^This session is being continued from a previous conversation/,
]

export function isDeveloperPrompt(message: TranscriptMessage): boolean {
  if (message.role !== 'user' || message.toolResults?.length) return false
  const text = message.text.trimStart()
  return text.length > 0 && !ENGINE_WRITTEN.some(pattern => pattern.test(text))
}

export function buildTimeline(messages: readonly TranscriptMessage[]): Turn[] {
  const turns: Turn[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      if (isDeveloperPrompt(message)) turns.push({ index: turns.length, steps: [] })
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    for (const use of message.toolUses ?? []) {
      turn.steps.push(toStep(use))
    }
  }
  return turns
}
