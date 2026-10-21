import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import { alreadyFailing, judge } from '../lib/flags'
import type { Finding } from '../lib/flags'
import { debugLine, stripParams } from '../lib/metadata'
import { diffCompaction } from '../lib/compaction'
import { readingLists } from '../lib/readinglist'
import type { EarlierReads, ReadingEntry } from '../lib/readinglist'
import { creditChanges, parseStatus } from '../lib/shelledit'
import type { CompactionMemory, EarlierRead, ProbeRecord } from '../types'
import { buildTimeline, flatSteps, startedAgents, verificationOf } from '../lib/transcript'
import type { Step, TranscriptMessage, Turn } from '../lib/transcript'
import type { TestRun } from '../lib/testrun'

const TRACE = 'field-guide-trace'
const LEDGER = 'field-guide-ledger'
const AUTOPSY = 'field-guide-autopsy'
const VIEWS: Readonly<Record<string, { id: string; title: string }>> = {
  trace: { id: TRACE, title: 'Loop Trace' },
  ledger: { id: LEDGER, title: 'Red/Green Ledger' },
  autopsy: { id: AUTOPSY, title: 'Compaction Autopsy' },
}

// Rebuilt from the transcript at every session start (which a resume and a hot reload both raise)
// and after every main-loop turn, so nothing here needs to survive a reload (ADR 0002).
let timeline: Turn[] = []
// Reads from before the last compaction, the compactions so far, and the latest summary's text
// (held in memory only, read back from the transcript).
let earlier: EarlierReads = { reads: [], reattached: [] }
let compactionCount = 0
let summaryText: string | null = null
const SUMMARY_START = /^This session is being continued from a previous conversation/

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
  timeline = buildTimeline(main, agentId => subagents.get(agentId), id => facts[id])
  const memory = await loadMemory($)
  earlier = { reads: memory.earlierReads, reattached: memory.reattached }
  compactionCount = memory.compactions.length
  summaryText = main.find(row => row.role === 'user' && SUMMARY_START.test(row.text.trimStart()))?.text ?? null
  const latest = timeline[timeline.length - 1]
  latestSettled = latest?.isSettled ?? true
  findings = (latest && judge(latest, timeline)) || []
  await readUsage($)
  $.ui.invalidate('ui.render')
}

async function readUsage($: EngineInterface): Promise<void> {
  try {
    const usage = await $.session.usage()
    const percent = usage.context?.percent
    contextPercent = typeof percent === 'number' ? Math.round(percent) : null
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

// What "Tell Claude" puts in the prompt box: the developer edits it and sends it as their own.
function handOff(finding: Finding): string {
  const ids = finding.testIds?.length ? ` Tests: ${finding.testIds.map(stripParams).join(', ')}.` : ''
  return `Field Guide flagged Turn ${timeline.length}: ${finding.title}. ${finding.reason}${ids} Please check this before going on.`
}

// The latest turn's findings that a view explains, each with its reason and a Tell Claude button.
function findingList($: EngineInterface, e: Parameters<EngineInterface['ui']['resolve']>[0], view: string): RenderChildren[] {
  const { Box, Button, Text } = $.ui.resolve(e)
  return findings
    .filter(finding => finding.view === view)
    .map(finding => (
      <Box key={`finding:${finding.kind}`} flexDirection="column">
        <Text color={finding.level === 'flag' ? 'yellow' : undefined}>{`⚑ ${finding.title}: ${finding.reason}`}</Text>
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
    return { text: `⚑ ${flag.title} · Turn ${timeline.length} · /guide ${flag.view}`, isFlag: true }
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
  if (verified === 'tested') return 'Tested after the last edit'
  if (verified === 'checked') return 'Checked after the last edit (lint, type check, or build; no test run)'
  return flatSteps(turn).some(step => step.kind === 'edit') ? 'Not verified after the last edit' : null
}

function entryLine(entry: ReadingEntry): string {
  const by = entry.agent ? ` (by ${entry.agent})` : ''
  if (entry.kind === 'search') return `  searched  ${entry.query}${by}`
  const mark = entry.compaction === 're-attached' ? ' · re-attached after compaction' : entry.compaction ? ' · read before compaction' : ''
  return `  read      ${entry.path}${by}${mark}`
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
  return ` · via shell, ${how}: ${step.shellEdit.paths.join(', ')} · not in the diff views`
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

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    try {
      await $.command.register({ name: 'guide', description: 'Field Guide: open a view', argumentHint: 'trace | ledger | autopsy' })
      await rebuild($)
    } catch (err) {
      fail($, 'session.start', err)
    }
    return result
  })

  // The Live Probe: watch-only, the call and its result pass through untouched.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
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
        {verificationLine(turn) && <Text dimColor>{verificationLine(turn)}</Text>}
        {turn.index === timeline.length - 1 && findingList($, e, 'trace')}
        {readingLists(turn, timeline, earlier).flatMap(list => [
          <Text key={`list:${list.file}`} bold>{`Reading List · ${list.file}`}</Text>,
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
      </Box>
    )
  })
}
