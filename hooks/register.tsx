import type { EngineInterface, Register } from 'claude-code'

import { debugLine } from '../lib/metadata'
import { buildTimeline, flatSteps, startedAgents, verificationOf } from '../lib/transcript'
import type { Step, TranscriptMessage, Turn } from '../lib/transcript'
import type { TestRun } from '../lib/testrun'

const TRACE = 'field-guide-trace'
const LEDGER = 'field-guide-ledger'
const VIEWS: Readonly<Record<string, { id: string; title: string }>> = {
  trace: { id: TRACE, title: 'Loop Trace' },
  ledger: { id: LEDGER, title: 'Red/Green Ledger' },
}

// Rebuilt from the transcript at every session start (which a resume and a hot reload both raise)
// and after every main-loop turn, so nothing here needs to survive a reload (ADR 0002).
let timeline: Turn[] = []

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
  timeline = buildTimeline(main, agentId => subagents.get(agentId))
  $.ui.invalidate('ui.render')
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

function stepLine(step: Step): string {
  return `${step.isError ? '✗ ' : ''}${step.kind.padEnd(8)} ${step.tool}  ${step.summary}`.trimEnd()
}

async function logDebug($: EngineInterface): Promise<void> {
  if ((await $.env.get('FIELD_GUIDE_DEBUG')) !== '1') return
  $.ui.log(`field-guide: ${debugLine(timeline)}`, { to: 'debug' })
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
      await $.command.register({ name: 'guide', description: 'Field Guide: open a view', argumentHint: 'trace | ledger' })
      await rebuild($)
    } catch (err) {
      fail($, 'session.start', err)
    }
    return result
  })

  // A subagent can finish after the main loop stops, so its own turn end rebuilds too.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    try {
      await rebuild($)
      if (!e.agentId) await logDebug($)
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
    return { text: `Field Guide: opened ${view.title}.` }
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
    return (
      <Box flexDirection="column">
        {runs.flatMap(({ turn, step, run }) => [
          <Text key={step.id} color={run.failed + run.errors > 0 ? 'red' : 'green'}>
            {`Turn ${turn.index + 1} · ${run.runner} · ${runCounts(run)}`}
          </Text>,
          ...run.failingIds.map(id => (
            <Text key={`${step.id}:${id}`} dimColor>
              {`  ${id}`}
            </Text>
          )),
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
