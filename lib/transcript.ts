import { classify, commandVerification } from './classify'
import type { StepKind, Verification } from './classify'
import { asBuiltIn, shortName } from './mcp'
import { addedMockTargets } from './mocks'
import { relativeTo } from './paths'
import { guessWrites, shellReads } from './shelledit'
import { parseTestRun } from './testrun'
import type { TestRun } from './testrun'

export type ToolUse = {
  readonly tool_use_id: string
  readonly tool: string
  readonly input: Readonly<Record<string, unknown>>
  readonly text?: string
  readonly isError?: true
  readonly agentId?: string
  // The tool's typed record; for Agent, `status` says whether it ran or was backgrounded.
  readonly result?: unknown
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
  // The file a file tool read or changed.
  readonly path?: string
  // The files a read-only shell command printed.
  readonly shellReads?: readonly string[]
  readonly isError: boolean
  readonly resultSize: number
  // On a verify step: what it verified, and for a test runner the run as read from its output.
  readonly verification?: Verification
  readonly run?: TestRun
  // A test command whose output could not be read: it proves nothing, either way.
  readonly unreadableRun?: true
  // An edit that adds a skip, expected-failure, or run-only marker to a test.
  readonly addsMarker?: true
  // The mock and patch targets an edit adds (module paths, read from its text in memory).
  readonly mockTargets?: readonly string[]
  // Files a shell command changed: exact from the Live Probe's change list, or a best guess
  // from the command text. The diff views don't show these.
  readonly shellEdit?: { readonly paths: readonly string[]; readonly exact: boolean }
  // Set on a subagent's own steps, and on an Agent step that started one.
  readonly agentId?: string
  // On an Agent step: the kind of subagent it started, and that subagent's steps.
  readonly agentType?: string
  readonly children?: readonly Step[]
  // An Agent step whose subagent was backgrounded: the turn waits for its hand-back.
  readonly isBackground?: true
}

// A subagent's transcript by its id, as the engine keeps it; undefined when it can't be read.
export type SubagentRows = (agentId: string) => readonly TranscriptMessage[] | undefined

// What the Live Probe saw of a call that the transcript doesn't keep; nothing after a resume.
export type ProbeFacts = {
  readonly isReadOnly?: boolean
  // Set when the probe read the repository's change list after the call.
  readonly shellEdits?: readonly string[]
}

export type ProbeLookup = (toolUseId: string) => ProbeFacts | undefined

type Context = { readonly subagents: SubagentRows; readonly probe: ProbeLookup; readonly cwd: string }

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

export function summarize(use: ToolUse, cwd = ''): string {
  const field = SUMMARY_FIELD[use.tool]
  const value = field ? use.input[field] : undefined
  if (typeof value !== 'string') return ''
  const line = relativeTo(cwd, value.split('\n')[0].trim())
  return line.length > SUMMARY_LIMIT ? line.slice(0, SUMMARY_LIMIT - 1) + '…' : line
}

function toolUses(messages: readonly TranscriptMessage[]): ToolUse[] {
  return messages.flatMap(message => (message.role === 'assistant' ? (message.toolUses ?? []) : []))
}

// A test command whose output can't be read proves nothing the ledger can show, so it is a plain run.
function verifyFacts(use: ToolUse): Pick<Step, 'kind' | 'verification' | 'run' | 'unreadableRun'> | null {
  if (use.tool !== 'Bash' || typeof use.input.command !== 'string') return null
  const verification = commandVerification(use.input.command)
  if (verification !== 'tested') return verification ? { kind: 'verify', verification } : null
  const run = parseTestRun(use.input.command, use.text ?? '')
  return run ? { kind: 'verify', verification, run } : { kind: 'run', unreadableRun: true as const }
}

const PATH_FIELD: Readonly<Record<string, string>> = {
  Read: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  Write: 'file_path',
  NotebookEdit: 'notebook_path',
}

function pathOf(use: ToolUse): string | undefined {
  const value = PATH_FIELD[use.tool] ? use.input[PATH_FIELD[use.tool]] : undefined
  return typeof value === 'string' ? value : undefined
}

const TEST_MARKER = /@pytest\.mark\.(skip|skipif|xfail)\b|\bpytest\.(skip|xfail)\(|\b(it|test|describe)\.(skip|only|todo)\(|\bx(it|describe|test)\(|@unittest\.skip|\bt\.Skip\(/g

function texts(input: Readonly<Record<string, unknown>>, ...fields: string[]): string {
  const edits = Array.isArray(input.edits) ? (input.edits as Record<string, unknown>[]) : []
  return [input, ...edits]
    .flatMap(part => fields.map(field => part[field]))
    .filter((v): v is string => typeof v === 'string')
    .join('\n')
}

function mockFacts(use: ToolUse): Pick<Step, 'mockTargets'> {
  const added = addedMockTargets(use.input)
  return added.length ? { mockTargets: added } : {}
}

// Read in memory only, never kept: does this edit leave more markers than it found?
function addsMarker(use: ToolUse): boolean {
  const count = (text: string) => text.match(TEST_MARKER)?.length ?? 0
  return count(texts(use.input, 'new_string', 'content', 'new_source')) > count(texts(use.input, 'old_string'))
}

function shellEditOf(use: ToolUse, facts: ProbeFacts | undefined): Step['shellEdit'] | undefined {
  if (use.tool !== 'Bash' || typeof use.input.command !== 'string') return undefined
  if (facts?.shellEdits) return facts.shellEdits.length ? { paths: facts.shellEdits, exact: true } : undefined
  if (facts?.isReadOnly) return undefined
  const guessed = guessWrites(use.input.command)
  return guessed.length ? { paths: guessed, exact: false } : undefined
}

// `expanding` holds the subagents already being expanded above this step, so a cycle stops.
function toStep(original: ToolUse, ctx: Context, agentId?: string, expanding: ReadonlySet<string> = new Set()): Step {
  const use = asBuiltIn(original)
  const facts = ctx.probe(use.tool_use_id)
  const classified = classify(use.tool, use.input, { isReadOnly: facts?.isReadOnly })
  const verified = classified === 'verify' ? verifyFacts(use) : null
  const shellEdit = shellEditOf(use, facts)
  const done = verified?.kind ?? classified
  // A command that changed files is an edit, unless it also verified: then the verify is what it did last.
  const kind = shellEdit && done !== 'verify' ? 'edit' : done
  const path = pathOf(use)
  const step: Step = {
    id: use.tool_use_id,
    tool: shortName(original.tool),
    ...(verified ?? {}),
    kind,
    ...(shellEdit ? { shellEdit } : {}),
    ...(path ? { path } : {}),
    ...(kind === 'read' && use.tool === 'Bash' && typeof use.input.command === 'string'
      ? { shellReads: shellReads(use.input.command) }
      : {}),
    ...(kind === 'edit' && addsMarker(use) ? { addsMarker: true as const } : {}),
    ...(kind === 'edit' && use.tool !== 'Bash' ? mockFacts(use) : {}),
    summary: summarize(use, ctx.cwd),
    isError: use.isError === true,
    resultSize: use.text?.length ?? 0,
    ...(agentId ? { agentId } : {}),
  }
  if (step.kind !== 'delegate' || !use.agentId) return step
  const rows = expanding.has(use.agentId) ? undefined : ctx.subagents(use.agentId)
  const isBackground = (use.result as { status?: string } | undefined)?.status === 'async_launched'
  const childId = use.agentId
  const agentType = typeof use.input.subagent_type === 'string' ? use.input.subagent_type : 'subagent'
  return {
    ...step,
    agentId: childId,
    agentType,
    children: rows ? toolUses(rows).map(child => toStep(child, ctx, childId, new Set([...expanding, childId]))) : [],
    ...(isBackground ? { isBackground: true as const } : {}),
  }
}

export type Turn = {
  readonly index: number
  readonly steps: Step[]
  // The developer stopped this turn before it finished.
  readonly isInterrupted?: true
  // False while a backgrounded subagent this turn started has not handed back.
  readonly isSettled: boolean
}

// The row the engine writes when the developer stops a turn.
const INTERRUPTED = /^\[Request interrupted by user/

// The engine writes these rows as user messages; none of them is the developer asking for work.
const ENGINE_WRITTEN = [
  /^<(task-notification|local-command-stdout|local-command-stderr|system-reminder|bash-stdout|bash-stderr)\b/,
  /^This session is being continued from a previous conversation/,
  INTERRUPTED,
]

export function isDeveloperPrompt(message: TranscriptMessage): boolean {
  if (message.role !== 'user' || message.toolResults?.length) return false
  const text = message.text.trimStart()
  return text.length > 0 && !ENGINE_WRITTEN.some(pattern => pattern.test(text))
}

// Whether a step changed files: an edit tool that failed changed nothing; a failing shell
// command may still have written files, so it counts.
export function changedFiles(step: Step): boolean {
  return step.kind === 'edit' && !(step.isError && !step.shellEdit)
}

// Steps in the order they ran, a subagent's right after the Agent step that started it.
function flatten(steps: readonly Step[]): Step[] {
  return steps.flatMap(step => [step, ...(step.children ? flatten(step.children) : [])])
}

export function flatSteps(turn: Turn): Step[] {
  return flatten(turn.steps)
}

const HANDED_BACK = /<task-id>([^<]+)<\/task-id>/g

// Tested or Checked by what ran after the turn's last edit (or anywhere, with no edit); null for neither.
export function verificationOf(turn: Turn): Verification | null {
  const steps = flatSteps(turn)
  let lastEdit = -1
  steps.forEach((step, i) => {
    if (changedFiles(step)) lastEdit = i
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

export function buildTimeline(
  messages: readonly TranscriptMessage[],
  subagents: SubagentRows = () => undefined,
  probe: ProbeLookup = () => undefined,
  // The session's folder: summaries show paths under it relative to it.
  cwd = '',
): Turn[] {
  const ctx: Context = { subagents, probe, cwd }
  const turns: { index: number; steps: Step[]; isInterrupted?: true }[] = []
  const handedBack = new Set<string>()
  for (const message of messages) {
    if (message.role === 'user') {
      if (isDeveloperPrompt(message)) turns.push({ index: turns.length, steps: [] })
      else if (INTERRUPTED.test(message.text.trimStart()) && turns.length > 0) turns[turns.length - 1].isInterrupted = true
      for (const match of message.text.matchAll(HANDED_BACK)) handedBack.add(match[1])
      continue
    }
    const turn = turns[turns.length - 1]
    if (!turn) continue
    for (const use of message.toolUses ?? []) {
      turn.steps.push(toStep(use, ctx))
    }
  }
  // Only the main loop's own Agent steps hand back here; a nested one hands back to its parent subagent.
  return turns.map(turn => ({
    ...turn,
    isSettled: turn.steps.every(step => !step.isBackground || (step.agentId !== undefined && handedBack.has(step.agentId))),
  }))
}
