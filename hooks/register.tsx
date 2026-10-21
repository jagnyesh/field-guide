import type { EngineInterface, Register } from 'claude-code'

import { debugLine } from '../lib/metadata'
import { buildTimeline } from '../lib/transcript'
import type { TranscriptMessage, Turn } from '../lib/transcript'

const TRACE = 'field-guide-trace'

// Rebuilt from the transcript at every session start (which a resume and a hot reload both raise)
// and after every main-loop turn, so nothing here needs to survive a reload (ADR 0002).
let timeline: Turn[] = []

async function rebuild($: EngineInterface): Promise<void> {
  const rows = await $.session.messages()
  timeline = Array.isArray(rows) ? buildTimeline(rows as TranscriptMessage[]) : []
  $.ui.invalidate('ui.render')
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
      await $.command.register({ name: 'guide', description: 'Field Guide: open a view (trace)', argumentHint: 'trace' })
      await rebuild($)
    } catch (err) {
      fail($, 'session.start', err)
    }
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    try {
      await rebuild($)
      await logDebug($)
    } catch (err) {
      fail($, 'turn.complete', err)
    }
    return result
  })

  on('command.run', { command: 'guide' }, async $ => {
    await $.ui.open({ id: TRACE, title: 'Loop Trace' })
    return { text: 'Field Guide: opened Loop Trace.' }
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
        {turn.steps.map(step => (
          <Text key={step.id} color={step.isError ? 'red' : undefined}>
            {step.tool}  {step.summary}
          </Text>
        ))}
      </Box>
    )
  })
}
