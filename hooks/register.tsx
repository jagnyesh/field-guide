import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import { commandVerification, gitPublish } from '../lib/classify'
import { alreadyFailing, editUncheckedAtCommit, judge } from '../lib/flags'
import type { Finding, JudgeOptions } from '../lib/flags'
import { debugLine, stripParams } from '../lib/metadata'
import { diffCompaction } from '../lib/compaction'
import { asBuiltIn } from '../lib/mcp'
import { relativeTo } from '../lib/paths'
import { turnGrowth } from '../lib/growth'
import type { TurnGrowth } from '../lib/growth'
import { fixedLoad } from '../lib/xray'
import type { BreakdownInput, FixedLoad } from '../lib/xray'
import { readingLists } from '../lib/readinglist'
import type { EarlierReads, ReadingEntry } from '../lib/readinglist'
import { creditChanges, parseStatus } from '../lib/shelledit'
import type { CompactionMemory, EarlierRead, ProbeRecord } from '../types'
import { buildTimeline, changedFiles, flatSteps, startedAgents, verificationOf } from '../lib/transcript'
import type { Step, TranscriptMessage, Turn } from '../lib/transcript'
import type { TestRun } from '../lib/testrun'

const TRACE = 'field-guide-trace'
const LEDGER = 'field-guide-ledger'
const AUTOPSY = 'field-guide-autopsy'
const XRAY = 'field-guide-xray'
const VIEWS: Readonly<Record<string, { id: string; title: string }>> = {
  xray: { id: XRAY, title: 'Context X-ray' },
  trace: { id: TRACE, title: 'Loop Trace' },
  ledger: { id: LEDGER, title: 'Red/Green Ledger' },
  autopsy: { id: AUTOPSY, title: 'Compaction Autopsy' },
}

// Rebuilt from the transcript at every session start (which a resume and a hot reload both raise)
// and after every main-loop turn, so nothing here needs to survive a reload (ADR 0002).
let timeline: Turn[] = []
// The session's folder: paths under it show relative to it.
let sessionCwd = ''
const rel = (text: string) => relativeTo(sessionCwd, text)
// The project's choices, from the plugin's options (a change reloads the module).
let judgeOptions: JudgeOptions = {}
// Reads from before the last compaction, the compactions so far, and the latest summary's text
// (held in memory only, read back from the transcript).
let earlier: EarlierReads = { reads: [], reattached: [] }
let compactionCount = 0
let summaryText: string | null = null
const SUMMARY_START = /^This session is being continued from a previous conversation/
// System-prompt sections by name and text length, as the engine composed them; never their text.
const sectionChars = new Map<string, number>()
let xray: FixedLoad | null = null
let xrayIsExact = false
// Readings at each main-loop turn's end: the context's measured fill and the transcript's length.
let mainRows: TranscriptMessage[] = []
let contextTokens: number | null = null
const readings: { tokens: number; rows: number; compactions: number }[] = []
// Attachment text length since the last reading (the engine's own context for the model).
let pendingAttachmentChars = 0
let lastGrowth: { kind: 'growth'; growth: TurnGrowth } | { kind: 'compacted'; before?: number; after?: number } | null = null

// Which flags were toasted, kept by the host so a hot reload doesn't toast them again.
const toasted = atom({ plugin: 'field-guide', key: 'toasted' } as const, [] as string[])
// Flags the developer has seen: they opened its view or sent their next prompt.
const acknowledged = atom({ plugin: 'field-guide', key: 'acknowledged' } as const, [] as string[])
// The Live Probe's facts per shell call, which the transcript doesn't keep (ADR 0002).
const probe = atom({ plugin: 'field-guide', key: 'probe' } as const, {} as Record<string, ProbeRecord>)
const EMPTY_MEMORY: CompactionMemory = { compactions: [], earlierReads: [], reattached: [], window: 'closed' }
const MEMORY_PREFIX = 'compaction:'
const MEMORY_SESSIONS = 20
const PROBE_KEEP = 500
const SNAPSHOT_TIMEOUT_MS = 2_000
const STAT_LIMIT = 200
// The change list after the last shell call: the "before" of the next, for telling new deletions.
let lastStatus = ''
// The repository's top folder: git lists paths from there, the session may run from below it.
let repoTop: string | null = null
// The latest turn's findings, judged only once it settled; and the context window's fill.
let findings: Finding[] = []
let latestSettled = true
let contextPercent: number | null = null

async function readRows($: EngineInterface, agentId?: string): Promise<TranscriptMessage[] | undefined> {
  const rows = agentId ? await $.session.messages({ agentId }) : await $.session.messages()
  return Array.isArray(rows) ? (rows as TranscriptMessage[]) : undefined
}

async function rebuild($: EngineInterface): Promise<void> {
  const { main, turns } = await readTimeline($)
  mainRows = main
  timeline = turns
  const memory = await loadMemory($)
  earlier = { reads: memory.earlierReads, reattached: memory.reattached }
  compactionCount = memory.compactions.length
  summaryText = main.find(row => row.role === 'user' && SUMMARY_START.test(row.text.trimStart()))?.text ?? null
  const latest = timeline[timeline.length - 1]
  latestSettled = latest?.isSettled ?? true
  findings = (latest && judge(latest, timeline, judgeOptions)) || []
  await readUsage($)
  $.ui.invalidate('ui.render')
}

async function readTimeline($: EngineInterface): Promise<{ main: TranscriptMessage[]; turns: Turn[] }> {
  const main = (await readRows($)) ?? []
  // Subagents can start subagents, so follow Agent steps until no new id turns up.
  const subagents = new Map<string, TranscriptMessage[]>()
  const pending = startedAgents(main)
  while (pending.length > 0) {
    const agentId = pending.shift() as string
    if (subagents.has(agentId)) continue
    const rows = (await readRows($, agentId)) ?? []
    subagents.set(agentId, rows)
    pending.push(...startedAgents(rows))
  }
  const facts = await read($, probe)
  return { main, turns: buildTimeline(main, agentId => subagents.get(agentId), id => facts[id], sessionCwd) }
}

// A commit or push is where an unchecked edit leaves the session, so it is checked mid-turn as well
// as at the turn's end: a toast for the developer that states what happened, never sent to the model.
async function checkPublish($: EngineInterface, action: 'commit' | 'push', command: string): Promise<void> {
  const unchecked = commandVerification(command) === null && editUncheckedAtCommit((await readTimeline($)).turns)
  if (unchecked) $.ui.toast(`Field Guide · git ${action} with no test or check since the last edit.`)
  if ((await $.env.get('FIELD_GUIDE_DEBUG')) === '1') $.ui.log(`field-guide-publish: ${JSON.stringify({ action, unchecked })}`, { to: 'debug' })
}

async function readUsage($: EngineInterface): Promise<void> {
  try {
    const usage = await $.session.usage()
    const percent = usage.context?.percent
    contextPercent = typeof percent === 'number' ? Math.round(percent) : null
    contextTokens = typeof usage.context?.tokens === 'number' ? usage.context.tokens : null
  } catch {
    contextPercent = null
  }
}

// Turn numbers start again after a compaction, so a key also names how many came before.
function flagKey(finding: Finding): string {
  return `${compactionCount}:${timeline.length - 1}:${finding.kind}`
}

// One toast per flag per Settled turn, raised only as a turn ends: a resume or reload rebuilds
// quietly, so an old flag never toasts twice.
async function toastNewFlags($: EngineInterface): Promise<void> {
  if (!latestSettled) return
  const seen = await read($, toasted)
  const fresh = findings.filter(f => f.level === 'flag' && !seen.includes(flagKey(f)))
  if (fresh.length === 0) return
  for (const flag of fresh) $.ui.toast(`Field Guide · ${flag.title}: ${flag.reason}`)
  await update($, toasted, keys => [...keys, ...fresh.map(flagKey)].slice(-200))
}

// With a view, only the flags that view explains; without one (the next prompt), all of them.
async function acknowledgeFlags($: EngineInterface, view?: string): Promise<void> {
  const keys = findings.filter(f => f.level === 'flag' && (view === undefined || f.view === view)).map(flagKey)
  if (keys.length === 0) return
  await update($, acknowledged, seen => [...new Set([...seen, ...keys])].slice(-200))
}

// What "Tell Claude" puts in the prompt box: the developer edits it and sends it as their own. A flag
// says what happened, not whether it was intended, so the hand-off reports it and leaves the plan alone.
function handOff(finding: Finding): string {
  const ids = finding.testIds?.length ? ` Tests: ${finding.testIds.map(stripParams).join(', ')}.` : ''
  return `Field Guide noted on Turn ${timeline.length}: ${finding.title}. ${finding.reason}${ids} This is information, not a request to change approach: if it was intended, keep to the plan.`
}

// The latest turn's findings that a view explains, each with its reason and a Tell Claude button.
function findingList($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0], view: string): RenderChildren[] {
  const { Box, Button, Text } = $.ui.resolve(e)
  return findings
    .filter(finding => finding.view === view)
    .map(finding => (
      <Box key={`finding:${finding.kind}`} flexDirection="column">
        <Text color={finding.level === 'flag' ? 'yellow' : undefined}>{`${finding.level === 'flag' ? '⚑' : '○'} ${finding.title}: ${finding.reason}`}</Text>
        <Button key={`tell:${finding.kind}`} label="Tell Claude" onPress={() => $.prompt.fill({ text: handOff(finding) })} />
      </Box>
    ))
}

function lastRun(): TestRun | undefined {
  for (let t = timeline.length - 1; t >= 0; t--) {
    const steps = flatSteps(timeline[t])
    for (let i = steps.length - 1; i >= 0; i--) {
      const run = steps[i].run
      if (run) return run
    }
  }
  return undefined
}

// What the hooks beneath drew: the engine's own node when nothing else is there (seen live, #3 checks).
function isDrawnBeneath(tree: unknown): boolean {
  return typeof tree === 'object' && tree !== null && (tree as { type?: unknown }).type !== 'engine'
}

let statusText: string | undefined

function setStatus($: EngineInterface, text: string | undefined): void {
  if (text === statusText) return
  statusText = text
  $.ui.status(text)
}

function fit(text: string, columns: number): string {
  return text.length <= columns ? text : text.slice(0, Math.max(1, columns - 1)) + '…'
}

// The band's one line: a flag once the latest turn settled, otherwise live facts; null for nothing.
function bandLine(isWorking: boolean, seen: readonly string[]): { text: string; isFlag: boolean } | null {
  const flag = findings.find(f => f.level === 'flag' && !seen.includes(flagKey(f)))
  if (flag && latestSettled && !isWorking) {
    return { text: `⚑ ${flag.fact} · Turn ${timeline.length} · /guide ${flag.view}`, isFlag: true }
  }
  const facts: string[] = []
  const run = lastRun()
  if (run) facts.push(`${run.runner} ${runCounts(run)}`)
  if (contextPercent !== null) facts.push(`context ${contextPercent}%`)
  return facts.length ? { text: `Field Guide · ${facts.join(' · ')}`, isFlag: false } : null
}

function runCounts(run: TestRun): string {
  const parts: [number, string][] = [[run.passed, 'passed'], [run.failed, 'failed'], [run.errors, 'errors'], [run.skipped, 'skipped']]
  const shown = parts.filter(([n]) => n > 0).map(([n, word]) => `${n} ${word}`)
  return shown.length ? shown.join(', ') : 'no tests ran'
}

function verificationLine(turn: Turn): string | null {
  const verified = verificationOf(turn)
  const edited = flatSteps(turn).some(changedFiles)
  if (verified === 'tested') return edited ? 'Tested after the last edit' : 'Tests ran this turn'
  if (verified === 'checked') return edited ? 'Checked after the last edit (lint, type check, or build; no test run)' : 'Checks ran this turn (lint, type check, or build)'
  return edited ? 'Not verified after the last edit' : null
}

function entryLine(entry: ReadingEntry): string {
  const by = entry.agent ? ` (by ${entry.agent})` : ''
  if (entry.kind === 'search') return `  searched  ${rel(entry.query)}${by}`
  const mark = entry.compaction === 're-attached' ? ' · re-attached after compaction' : entry.compaction ? ' · read before compaction' : ''
  return `  read      ${rel(entry.path)}${by}${mark}`
}

// After each main-loop turn: what it added, measured, split across the rows it added.
async function recordGrowth($: EngineInterface): Promise<void> {
  if (contextTokens === null) return
  const now = { tokens: contextTokens, rows: mainRows.length, compactions: compactionCount }
  const previous = readings[readings.length - 1]
  if (previous && previous.compactions !== now.compactions) {
    const record = (await loadMemory($)).compactions.slice(-1)[0]
    lastGrowth = { kind: 'compacted', before: record?.tokensBefore, after: record?.tokensAfter }
  } else if (previous) {
    const rows = mainRows.slice(previous.rows)
    lastGrowth = { kind: 'growth', growth: turnGrowth({ measured: now.tokens - previous.tokens, rows, attachmentChars: pendingAttachmentChars, cwd: sessionCwd }) }
  }
  readings.push(now)
  pendingAttachmentChars = 0
}

// The free local estimate unless the developer asks for exact counts, which send token-count requests.
async function readXray($: EngineInterface, exact = false): Promise<void> {
  const usage = await $.session.usage({ breakdown: exact ? 'full' : 'summary' })
  xrayIsExact = exact
  const breakdown = usage.context.breakdown as BreakdownInput | undefined
  if (!breakdown) return
  const ancestors = await $.fs.ancestors({ names: ['CLAUDE.md', 'CLAUDE.local.md'] })
  xray = fixedLoad({ breakdown, ancestors, sections: [...sectionChars].map(([name, chars]) => ({ name, chars })) })
  $.ui.invalidate('ui.render')
  // Key names avoid "token": the engine's debug log redacts such fields.
  if ((await $.env.get('FIELD_GUIDE_DEBUG')) === '1') {
    const summary = {
      categories: xray.categories.map(c => ({ name: c.name, size: c.tokens })),
      total: xray.total,
      mcpServers: xray.mcpServers.length,
      memory: xray.memory.map(m => ({ path: m.path, imports: m.imports.length })),
      sections: xray.sections.length,
    }
    $.ui.log(`field-guide-xray: ${JSON.stringify(summary)}`, { to: 'debug' })
  }
}

function tokens(n: number | undefined): string {
  return n === undefined ? '?' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

// Every path read so far, for the Reading List to keep once a compaction folds the reads away.
function readsSoFar(): EarlierRead[] {
  const agentTypes = new Map(timeline.flatMap(flatSteps).flatMap(s => (s.agentType && s.agentId ? [[s.agentId, s.agentType] as const] : [])))
  return timeline.flatMap(flatSteps).flatMap(step => {
    if (step.kind !== 'read') return []
    const agent = step.agentId ? agentTypes.get(step.agentId) : undefined
    return (step.path ? [step.path] : (step.shellReads ?? [])).map(path => (agent ? { path, agent } : { path }))
  })
}

// A resumed session keeps its first launch time, so it finds its own memory again.
async function memoryKey($: EngineInterface): Promise<string> {
  return `${MEMORY_PREFIX}${(await $.session.usage()).startedAt}`
}

async function loadMemory($: EngineInterface): Promise<CompactionMemory> {
  try {
    const stored = (await $.store.get(await memoryKey($))) as CompactionMemory | undefined
    return stored ?? EMPTY_MEMORY
  } catch (err) {
    fail($, 'store', err)
    return EMPTY_MEMORY
  }
}

async function saveMemory($: EngineInterface, change: (memory: CompactionMemory) => CompactionMemory): Promise<void> {
  const key = await memoryKey($)
  const memory = change(((await $.store.get(key)) as CompactionMemory | undefined) ?? EMPTY_MEMORY)
  await $.store.set(key, memory)
  const old = (await $.store.keys())
    .filter(k => k.startsWith(MEMORY_PREFIX))
    .sort((a, b) => Number(a.slice(MEMORY_PREFIX.length)) - Number(b.slice(MEMORY_PREFIX.length)))
    .slice(0, -MEMORY_SESSIONS)
  for (const k of old) await $.store.delete(k)
}

// The Read tool's input opens a re-attached file's text: `... input: {"file_path":"/x/a.txt"}`.
const REATTACHED_PATH = /"file_path"\s*:\s*"([^"]+)"/

function shellEditLabel(step: Step): string {
  if (!step.shellEdit) return ''
  const how = step.shellEdit.exact ? 'exact' : 'best guess'
  return ` · via shell, ${how}: ${step.shellEdit.paths.map(rel).join(', ')} · not in the diff views`
}

function stepLine(step: Step): string {
  return `${step.isError ? '✗ ' : ''}${step.kind.padEnd(8)} ${step.tool}  ${step.summary}`.trimEnd() + shellEditLabel(step)
}

async function remember($: EngineInterface, id: string, record: ProbeRecord): Promise<void> {
  await update($, probe, all => {
    const next = { ...all, [id]: record }
    const ids = Object.keys(next)
    for (const old of ids.slice(0, Math.max(0, ids.length - PROBE_KEEP))) delete next[old]
    return next
  })
}

// Runs after the call has returned its result, so the snapshot never delays it. The index lock
// is left alone (--no-optional-locks), so the agent's own git commands never collide with it.
async function snapshot($: EngineInterface, id: string, start: number, end: number): Promise<void> {
  try {
    if (repoTop === null) {
      const top = await $.process.run(['git', 'rev-parse', '--show-toplevel'], { timeoutMs: SNAPSHOT_TIMEOUT_MS })
      if (top.exitCode !== 0) {
        await remember($, id, { isReadOnly: false })
        return
      }
      repoTop = top.stdout.trim()
    }
    const status = await $.process.run(['git', '--no-optional-locks', 'status', '--porcelain', '-z', '-uall'], {
      timeoutMs: SNAPSHOT_TIMEOUT_MS,
    })
    if (status.exitCode !== 0 || status.isStdoutTruncated) {
      await remember($, id, { isReadOnly: false })
      return
    }
    const entries = parseStatus(status.stdout).filter(entry => !entry.status.includes('D'))
    if (entries.length > STAT_LIMIT) {
      await remember($, id, { isReadOnly: false })
      return
    }
    const mtimes = new Map<string, number>()
    for (const entry of entries) {
      try {
        mtimes.set(entry.path, (await $.fs.stat(`${repoTop}/${entry.path}`)).mtimeMs)
      } catch {
        // Gone again already: nothing to credit.
      }
    }
    const shellEdits = creditChanges({ after: status.stdout, previous: lastStatus, mtimeOf: path => mtimes.get(path), start, end })
    lastStatus = status.stdout
    await remember($, id, { isReadOnly: false, shellEdits })
    await rebuild($)
  } catch (err) {
    await remember($, id, { isReadOnly: false })
    fail($, 'snapshot', err)
  }
}

async function logDebug($: EngineInterface): Promise<void> {
  if ((await $.env.get('FIELD_GUIDE_DEBUG')) !== '1') return
  const latest = timeline[timeline.length - 1]
  const lists = latest ? readingLists(latest, timeline, earlier) : []
  $.ui.log(`field-guide: ${debugLine(timeline, findings, lists, (await loadMemory($)).compactions)}`, { to: 'debug' })
}

function latestTurn(): Turn | undefined {
  for (let i = timeline.length - 1; i >= 0; i--) {
    if (timeline[i].steps.length > 0) return timeline[i]
  }
  return timeline[timeline.length - 1]
}

// A bug in this mod must never stop a turn: report it to the debug log and carry on.
function fail($: EngineInterface, where: string, err: unknown): void {
  $.ui.log(`field-guide: ${where} failed: ${err instanceof Error ? err.name : 'error'}`, { to: 'debug' })
}

export const register: Register = (on, options) => {
  const modules = typeof options.boundaryModules === 'string' ? options.boundaryModules.split(',').map(m => m.trim()).filter(Boolean) : []
  judgeOptions = { boundaryMockAsFlag: options.boundaryMockAsFlag === true, ...(modules.length ? { boundaryModules: modules } : {}) }

  on('session.start', async ($, e, next) => {
    sessionCwd = e.cwd
    const result = await next(e)
    try {
      await $.command.register({ name: 'guide', description: 'Field Guide: open a view', argumentHint: 'trace | ledger | xray | autopsy' })
      await rebuild($)
    } catch (err) {
      fail($, 'session.start', err)
    }
    return result
  })

  // The Live Probe: watch-only, the call and its result pass through untouched. It follows the
  // built-in shell and MCP tools that stand in for it (lean-ctx's ctx_shell, for one).
  on('tool.call', async ($, e, next) => {
    const standIn = e.tool.startsWith('mcp__') ? asBuiltIn({ tool_use_id: e.tool_use_id, tool: e.tool, input: e as Record<string, unknown> }) : null
    if (e.tool !== 'Bash' && standIn?.tool !== 'Bash') return next(e)
    const command = String((standIn?.input ?? (e as Record<string, unknown>)).command ?? '')
    const action = gitPublish(command)
    if (action) void $.clock.after(0, () => void checkPublish($, action, command).catch(err => fail($, 'publish check', err)))
    const start = await $.clock.now()
    const result = await next(e)
    try {
      if (result.deny !== undefined) return result
      if (result.isReadOnly) {
        await remember($, e.tool_use_id, { isReadOnly: true })
        return result
      }
      const end = await $.clock.now()
      void $.clock.after(0, () => void snapshot($, e.tool_use_id, start, end))
    } catch (err) {
      fail($, 'tool.call', err)
    }
    return result
  })

  // The main conversation's compactions: what they kept, and the reads they folded away.
  on('session.compact', async ($, e, next) => {
    const result = await next(e)
    try {
      if (e.agentId || e.trigger === 'precompute') return result
      const record = diffCompaction(e, result)
      if (!record) return result
      const reads = readsSoFar()
      await saveMemory($, memory => {
        const merged = [...memory.earlierReads]
        for (const entry of reads) if (!merged.some(r => r.path === entry.path)) merged.push(entry)
        return { compactions: [...memory.compactions, record].slice(-50), earlierReads: merged.slice(-500), reattached: [], window: 'pending' }
      })
    } catch (err) {
      fail($, 'session.compact', err)
    }
    return result
  })

  // On the first request after a compaction the engine attaches recently read files again (spike #2).
  on('prompt.attachment', async ($, e, next) => {
    pendingAttachmentChars += e.text.length
    try {
      if (e.type === 'file' && (await loadMemory($)).window !== 'closed') {
        const path = REATTACHED_PATH.exec(e.text.split('\n')[0])?.[1]
        if (path) await saveMemory($, m => (m.reattached.includes(path) ? m : { ...m, reattached: [...m.reattached, path] }))
      }
    } catch (err) {
      fail($, 'prompt.attachment', err)
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    try {
      if (!e.agentId && (await loadMemory($)).window === 'pending') await saveMemory($, m => ({ ...m, window: 'in-turn' }))
    } catch (err) {
      fail($, 'turn.start', err)
    }
    return next(e)
  })

  on('prompt.section', async ($, e, next) => {
    const result = await next(e)
    sectionChars.set(e.name, result.text?.length ?? 0)
    return result
  })

  on('ui.render', { component: 'Pane', requestId: XRAY }, ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    if (!xray) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No context breakdown yet: open it again after the first reply.</Text>
        </Box>
      )
    }
    const row = (label: string, value: number, tail = '') => `  ${label.padEnd(28)} ≈ ${tokens(value)}${tail}`
    const exact = () => readXray($, true).catch(err => fail($, 'xray exact', err))
    const growth =
      lastGrowth?.kind === 'compacted'
        ? [<Text key="growth" bold>{`Last turn compacted: ${tokens(lastGrowth.before)} → ${tokens(lastGrowth.after)} tokens`}</Text>]
        : lastGrowth?.kind === 'growth'
          ? [
              <Text key="growth" bold>{`Last turn added ${tokens(lastGrowth.growth.measured)} tokens (measured)`}</Text>,
              ...lastGrowth.growth.parts.map((part, i) => <Text key={`growth:${i}`}>{row(rel(part.label), part.approxTokens)}</Text>),
              <Text key="growth:left" dimColor>
                {row('Unattributed', lastGrowth.growth.unattributed, ' · reminders, formatting, thinking')}
              </Text>,
            ]
          : []
    return (
      <Box flexDirection="column">
        {growth}
        <Text bold>{`Fixed load ≈ ${tokens(xray.total)} tokens, paid on every request`}</Text>
        {xray.categories.map(c => (
          <Text key={`cat:${c.name}`}>{row(c.name, c.tokens)}</Text>
        ))}
        {xray.mcpServers.length > 0 && <Text bold>MCP servers</Text>}
        {xray.mcpServers.map(m => (
          <Text key={`mcp:${m.server}`}>{row(m.server, m.tokens, ` (${m.tools} tool${m.tools === 1 ? '' : 's'})`)}</Text>
        ))}
        {xray.memory.length > 0 && <Text bold>Memory files</Text>}
        {xray.memory.flatMap(m => [
          <Text key={`mem:${m.path}`}>{row(m.path, m.tokens, ` · ${m.type}`)}</Text>,
          ...m.imports.map(i => (
            <Text key={`mem:${m.path}:${i.path}`} dimColor>
              {`    imports ${i.path.padEnd(20)} ≈ ${tokens(i.approxTokens)}`}
            </Text>
          )),
        ])}
        {xray.sections.length > 0 && <Text bold>System-prompt sections</Text>}
        {xray.sections.map(sec => (
          <Text key={`sec:${sec.name}`} dimColor>
            {row(sec.name, sec.approxTokens)}
          </Text>
        ))}
        <Text dimColor>
          {xrayIsExact
            ? 'Categories are exact counts from token-count requests; ≈ still marks per-message estimates.'
            : '≈ marks local estimates; nothing here sent a token-count request.'}
        </Text>
        <Button key="exact" label="Exact breakdown (sends token-count requests)" onPress={exact} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: AUTOPSY }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const records = (await loadMemory($)).compactions
    if (records.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No compactions yet.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {records.map((r, i) => (
          <Text key={`compaction:${i}`}>
            {`Compaction ${i + 1} · ${r.trigger} · ${tokens(r.tokensBefore)} → ${tokens(r.tokensAfter)} tokens · ${r.kept} kept word for word · ${r.summarised} summarised`}
          </Text>
        ))}
        {summaryText && <Text bold>Latest summary</Text>}
        {summaryText && <Text dimColor>{summaryText}</Text>}
      </Box>
    )
  })

  // A subagent can finish after the main loop stops, so its own turn end rebuilds too.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    try {
      await rebuild($)
      if (!e.agentId) {
        await recordGrowth($)
        await toastNewFlags($)
        await logDebug($)
        if ((await loadMemory($)).window === 'in-turn') await saveMemory($, m => ({ ...m, window: 'closed' }))
      }
    } catch (err) {
      fail($, 'turn.complete', err)
    }
    return result
  })

  // The reply is a transcript row the model reads, so it names the view and nothing it shows.
  on('command.run', { command: 'guide' }, async ($, e) => {
    const name = e.args.trim().split(/\s+/)[0] || 'trace'
    const view = VIEWS[name]
    if (!view) return { text: `Field Guide views: ${Object.keys(VIEWS).join(', ')}.` }
    if (name === 'xray') {
      try {
        await readXray($)
      } catch (err) {
        fail($, 'xray', err)
      }
    }
    await $.ui.open({ id: view.id, title: view.title })
    await acknowledgeFlags($, name)
    return { text: `Field Guide: opened ${view.title}.` }
  })

  // The developer's next prompt means they've moved on; a subagent's hand-back is not theirs.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'task-notification') {
      try {
        await acknowledgeFlags($)
      } catch (err) {
        fail($, 'prompt.submit', err)
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    const line = bandLine(e.props.isWorking, await read($, acknowledged))
    // A teaching mod never crowds out a survey or another mod's band, safety mods above all;
    // a flag it can't show there goes to the status line instead.
    if (e.props.hasSurvey || isDrawnBeneath(below)) {
      setStatus($, line?.isFlag ? line.text : undefined)
      return below
    }
    setStatus($, undefined)
    if (!line) return below
    const { Box, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text color={line.isFlag ? 'yellow' : undefined} dimColor={!line.isFlag}>
          {fit(line.text, e.props.bodyColumns)}
        </Text>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: LEDGER }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const runs = timeline.flatMap(turn => flatSteps(turn).flatMap(step => (step.run ? [{ turn, step, run: step.run }] : [])))
    if (runs.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No test runs yet.</Text>
        </Box>
      )
    }
    const already = alreadyFailing(timeline)
    return (
      <Box flexDirection="column">
        {findingList($, e, 'ledger')}
        {runs.flatMap(({ turn, step, run }) => [
          <Text key={step.id} color={run.failed + run.errors > 0 ? 'red' : 'green'}>
            {`Turn ${turn.index + 1} · ${run.runner} · ${runCounts(run)}`}
          </Text>,
          ...run.failingIds.map(id =>
            already.get(run.runner)?.has(id) ? (
              <Text key={`${step.id}:${id}`} dimColor>
                {`  ${id}  (already failing)`}
              </Text>
            ) : (
              <Text key={`${step.id}:${id}`} color="red">
                {`  ${id}`}
              </Text>
            ),
          ),
        ])}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: TRACE }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const turn = latestTurn()
    if (!turn || turn.steps.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>No tool calls yet.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Text bold>Turn {turn.index + 1}</Text>
        {turn.steps.flatMap(step => [
          <Text key={step.id} color={step.isError ? 'red' : undefined}>
            {stepLine(step)}
          </Text>,
          ...(step.children ?? []).map(child => (
            <Text key={child.id} dimColor color={child.isError ? 'red' : undefined}>
              {`  ↳ ${step.agentType} › ${stepLine(child)}`}
            </Text>
          )),
        ])}
        {verificationLine(turn) && <Text dimColor>{verificationLine(turn)}</Text>}
        {turn.index === timeline.length - 1 && findingList($, e, 'trace')}
        {readingLists(turn, timeline, earlier).flatMap(list => [
          <Text key={`list:${list.file}`} bold>{`Reading List · ${rel(list.file)}`}</Text>,
          ...(list.entries.length
            ? list.entries.map((entry, i) => (
                <Text key={`list:${list.file}:${i}`} dimColor>
                  {entryLine(entry)}
                </Text>
              ))
            : [
                <Text key={`list:${list.file}:none`} dimColor>
                  {'  nothing read before this edit'}
                </Text>,
              ]),
        ])}

      </Box>
    )
  })
}
