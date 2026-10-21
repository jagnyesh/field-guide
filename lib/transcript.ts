import { classify, commandVerification } from './classify'
import type { StepKind, Verification } from './classify'
import { parseTestRun } from './testrun'
import type { TestRun } from './testrun'

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
  readonly kind: StepKind
  readonly summary: string
  readonly isError: boolean
  readonly resultSize: number
  // On a verify step: what it verified, and for a test runner the run as read from its output.
  readonly verification?: Verification
  readonly run?: TestRun
  // Set on a subagent's own steps, and on an Agent step that started one.
  readonly agentId?: string
  // On an Agent step: the kind of subagent it started, and that subagent's steps.
  readonly agentType?: string
  readonly children?: readonly Step[]
}

// A subagent's transcript by its id, as the engine keeps it; undefined when it can't be read.
export type SubagentRows = (agentId: string) => readonly TranscriptMessage[] | undefined

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

function toolUses(messages: readonly TranscriptMessage[]): ToolUse[] {
  return messages.flatMap(message => (message.role === 'assistant' ? (message.toolUses ?? []) : []))
}

// A test command whose output can't be read proves nothing the ledger can show, so it is a plain run.
function verifyFacts(use: ToolUse): Pick<Step, 'kind' | 'verification' | 'run'> | null {
  if (use.tool !== 'Bash' || typeof use.input.command !== 'string') return null
  const verification = commandVerification(use.input.command)
  if (verification !== 'tested') return verification ? { kind: 'verify', verification } : null
  const run = parseTestRun(use.input.command, use.text ?? '')
  return run ? { kind: 'verify', verification, run } : { kind: 'run' }
}

function toStep(use: ToolUse, subagents: SubagentRows, agentId?: string): Step {
  const kind = classify(use.tool, use.input)
  const step: Step = {
    id: use.tool_use_id,
    tool: use.tool,
    kind,
    ...(kind === 'verify' ? verifyFacts(use) : {}),
    summary: summarize(use),
    isError: use.isError === true,
    resultSize: use.text?.length ?? 0,
    ...(agentId ? { agentId } : {}),
  }
  if (step.kind !== 'delegate' || !use.agentId) return step
  const rows = subagents(use.agentId)
  const childId = use.agentId
  const agentType = typeof use.input.subagent_type === 'string' ? use.input.subagent_type : 'subagent'
  return { ...step, agentId: childId, agentType, children: rows ? toolUses(rows).map(child => toStep(child, subagents, childId)) : [] }
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

// Steps in the order they ran, a subagent's right after the Agent step that started it.
export function flatSteps(turn: Turn): Step[] {
  return turn.steps.flatMap(step => [step, ...(step.children ? flatSteps({ index: turn.index, steps: [...step.children] }) : [])])
}

// Tested or Checked by what ran after the turn's last edit (or anywhere, with no edit); null for neither.
export function verificationOf(turn: Turn): Verification | null {
  const steps = flatSteps(turn)
  let lastEdit = -1
  steps.forEach((step, i) => {
    if (step.kind === 'edit') lastEdit = i
  })
  const after = steps.slice(lastEdit + 1)
  if (after.some(step => step.verification === 'tested')) return 'tested'
  if (after.some(step => step.verification === 'checked')) return 'checked'
  return null
}

// The agent ids a transcript's Agent steps started; the session's agent list is empty after a resume.
export function startedAgents(messages: readonly TranscriptMessage[]): string[] {
  return toolUses(messages).flatMap(use => (use.agentId && classify(use.tool, use.input) === 'delegate' ? [use.agentId] : []))
}

export function buildTimeline(messages: readonly TranscriptMessage[], subagents: SubagentRows = () => undefined): Turn[] {
  const turns: Turn[] = []
  for (const message of messages) {
    if (message.role === 'user') {
      if (isDeveloperPrompt(message)) turns.push({ index: turns.length, steps: [] })
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    for (const use of message.toolUses ?? []) {
      turn.steps.push(toStep(use, subagents))
    }
  }
  return turns
}
