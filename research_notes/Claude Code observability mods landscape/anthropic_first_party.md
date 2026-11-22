# Anthropic first-party: what shows a developer what the Claude Code agent is doing (state as of 22 Nov 2026)

Scope: Anthropic-shipped items only. All docs were fetched on 2026-11-22 from code.claude.com (Markdown versions of the pages). Version numbers are quoted from the docs; the docs rarely give calendar dates, so most items carry a version and no date.

Short forms used in the "differs" lines: a **passive teaching observer** = a mod that only watches, never blocks a tool call, never feeds findings to the model, and explains what it sees to a newcomer.

## Q1. What is in Anthropic's official plugin marketplaces that relates to observability, learning, explanation, verification, code review or security review?

### Takeaway
Anthropic's own plugins cluster around review and after-the-fact reports (code-review, pr-review-toolkit, security-guidance, claude-security, session-report, receipts) and around making Claude itself explain more (explanatory-output-style, learning-output-style). None of them is a live, passive view of the loop, the test state, or a compaction; the nearest are session-report (post-hoc HTML from transcripts) and security-guidance (hook-based, but it deliberately feeds findings back to Claude).

### Cited Findings

**Marketplaces**
- Anthropic publishes two general-purpose marketplaces: official (`anthropics/claude-plugins-official`, marketplace name `claude-plugins-official`, added automatically on first interactive terminal session) and community (`anthropics/claude-plugins-community`, name `claude-community`, added by hand). Topic marketplaces also exist: `anthropics/skills`, `anthropics/knowledge-work-plugins`. — [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md)
- "Most of what it lists comes from partners and other authors rather than from Anthropic ... Anthropic maintains a smaller set of its own, such as `commit-commands`, `code-review`, `feature-dev`, and the language server plugins. The catalog changes often, so this page doesn't list it." Browse via the **Discover** tab of `/plugin` or the web catalog at claude.com/marketplace/plugins, which "shows install counts and marks some plugins **Anthropic verified**". — [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md)
- **Deprecated:** "The `claude-code-plugins` marketplace in `anthropics/claude-code` is deprecated." Installs now come from `claude-plugins-official`. `ralph-wiggum` was renamed `ralph-loop`; `claude-opus-4-5-migration` is retired. — [Anthropic's marketplaces](https://code.claude.com/docs/en/plugins/anthropic-marketplaces.md); the `plugins/` directory of `anthropics/claude-code` now holds only a README that points to the official repo — [anthropics/claude-code plugins](https://github.com/anthropics/claude-code/tree/main/plugins)
- There is no separate "mods marketplace" in the docs: a mod "installs as a plugin, from a marketplace". The sample mods live in their own marketplace named `claude-code-playground-mods` (see Q2). — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)

**Anthropic-authored plugins in `claude-plugins-official` relevant to this topic** (names exact, from `marketplace.json`; descriptions are the catalog's, some truncated by the fetch tool) — [marketplace.json](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json)

| Plugin | What it does | Delivery / surface | Differs from a passive teaching observer |
|---|---|---|---|
| `explanatory-output-style` | "Adds educational insights about implementation choices and codebase patterns" | Plugin; SessionStart hook that injects instructions; any surface that loads plugins | Changes what the model is told and writes; it is Claude explaining itself, not an outside view |
| `learning-output-style` | "Interactive learning mode that requests code contributions at decision points"; asks the user to write 5-10 lines at decision points; includes everything in explanatory-output-style. README warns: "Do not install this plugin unless you are fine with incurring the token cost." — [README](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/learning-output-style/README.md) | Plugin; SessionStart hook | Teaches coding by making the user code; alters the session and costs tokens on every turn |
| `security-guidance` | "Security review for Claude-generated code. Pattern-based warnings on edits, LLM-powered diff review on Stop, ..." | Plugin built entirely on settings hooks (details below) | Feeds findings to Claude by design |
| `claude-security` | Deep multi-agent vulnerability scan of your code, "each finding challenged before reporting" — docs: [Scan your codebase](https://code.claude.com/docs/en/claude-security.md) | Plugin, on demand | A scan you run, not a watcher |
| `code-review` | "Automated PR review using multiple specialized agents with confidence-based scoring" | Plugin (overlaps with the bundled `/code-review` skill) | Reviews a diff after the work; does not show the loop |
| `pr-review-toolkit` | "Comprehensive PR review agents specializing in comments, tests, error handling, type design, code quality, and..." | Plugin with subagents | Same: review agents, including a test-coverage reviewer, run on request |
| `feature-dev` | Feature workflow with agents for codebase exploration, architecture design and quality review | Plugin | A workflow Claude follows, not observation |
| `code-simplifier` | Agent that simplifies recently modified code | Plugin | Edits code |
| `hookify` | "Creates custom hooks to prevent unwanted behaviors, with rules defined in markdown" | Plugin that generates settings hooks | Its purpose is to block or warn the model |
| `session-report` | "Generate an explorable HTML report of Claude Code session usage — tokens, cache efficiency, subagents, skills, ..." Reads transcripts in `~/.claude/projects` with a bundled analyzer, default window 7 days, writes a self-contained HTML file plus findings on anomalies and "the most expensive prompts". — [SKILL.md](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/session-report/skills/session-report/SKILL.md) | Plugin skill, on demand | Post-hoc and cost-focused; nothing live, nothing about tests or compaction content |
| `receipts` | "A personal Claude Code impact report for justifying your usage to a manager or a self-review: what you shipped, ..." | Plugin, on demand | Outcome report for a manager, not a teaching view |
| `claude-md-management` | "Tools to maintain and improve CLAUDE.md files - audit quality, capture session learnings, and keep project memory current." | Plugin | Edits memory files |
| `claude-code-setup` | "Analyze codebases and recommend tailored Claude Code automations such as hooks, skills, MCP servers, and subagents." | Plugin | Setup advice |
| `champion-kit` | Helps internal champions run hackathons and office hours and write an AI maturity report | Plugin | Adoption material for people, not session insight |
| `plugin-dev`, `skill-creator` | Toolkits for building plugins and skills | Plugin | Authoring aids |
| `theme-examples` | "An example plugin to read, copy and change: thirty-eight animated backdrops behind the chat in the Claude desktop app, ..." | Plugin that is a mod (uses `$.theme`) | Decorative; an official example of a mod shipped through the marketplace |
| `ralph-loop` (was `ralph-wiggum`) | "Interactive self-referential AI loops for iterative development" | Plugin with a Stop hook | Drives the agent |
| `playground`, `project-artifact` | Interactive HTML explorers; a "living project status page" | Plugin | Output pages, not session telemetry |
| LSP plugins (`typescript-lsp`, `pyright-lsp`, `gopls-lsp`, `rust-analyzer-lsp`, etc.) | Language servers so "Claude sees type errors after edits" — [Code intelligence plugins](https://code.claude.com/docs/en/plugins/code-intelligence.md) | Plugin | Verification signal that goes to the model |

**security-guidance in detail** (the closest first-party analogue to "watch edits and the end of a turn") — [Catch security issues as Claude writes code](https://code.claude.com/docs/en/security-guidance.md)
- Three layers: "On each file edit: a fast pattern match for risky calls, with no model call"; "At the end of each turn: a background model review of everything that turn changed"; "On each commit or push Claude makes: a deeper agentic review".
- Hooks registered: `SessionStart` (bootstrap), `UserPromptSubmit` ("Capture the working-tree baseline that the end-of-turn review diffs against"), `PostToolUse` on `Edit`/`Write`/`NotebookEdit`, `Stop`, and `PostToolUse` on `Bash` filtered to `git commit` and `git push`.
- "None of the layers block writes or commits. Findings reach the writing Claude as instructions, Claude addresses them in the conversation."
- Dedup and rate limits worth copying: "Each warning fires once per pattern per file per session"; end-of-turn review "covers up to 30 changed files per turn and fires at most three times in a row before yielding back to you"; commit reviews "capped at 20 per rolling hour".
- Independence: "The plugin does not ask the same Claude instance that wrote the code to grade itself."
- Diagnostics go to `~/.claude/security/log.txt`. The source is offered as "a working example of running a separate model call from a hook".

### Inferences
- Among Anthropic's own marketplace plugins, nothing shows a per-turn loop trace, a test ledger, a context breakdown beyond `/context`, or what a compaction kept. The gap the requester's mod fills is not occupied by a first-party plugin.
- Anthropic's review plugins all route findings to the model so it fixes them. A mod that keeps findings away from the model is a different design stance, and the security-guidance page states the trade-off plainly (never blocks, but does instruct Claude).
- Ideas to borrow: security-guidance's "once per pattern per file per session" dedup and its `UserPromptSubmit` baseline + `Stop` diff (which catches changes made by Bash and subagents, not only edit tools); session-report's "most expensive prompts" and anomaly findings; a plain-text log file for diagnostics.

### Gaps
- I could not get an exact total plugin count for `claude-plugins-official`; the 191 KB `marketplace.json` was read in two halves and the fetch summarizer truncated some descriptions. Entries between "mattpocock-skills" and "mcp-server-dev" alphabetically may have been skipped at the boundary.
- The learning-output-style README still says it merges "the unshipped 'Learning' output style" with a "deprecated" Explanatory style, while the current docs list both Explanatory and Learning as built-in styles (see Q3). The README looks stale; I found no statement saying the two plugins are deprecated.
- `anthropics/claude-plugins-community` and `anthropics/skills` were not inspected (community is third-party by definition).

## Q2. What does the mods / plugin UI extension system allow, and what do Anthropic's own example mods show?

### Takeaway
Mods are plugins whose JavaScript/TypeScript handlers run inside Claude Code and can observe, rewrite or answer events and draw panes, a band above the prompt, toasts, transcript rows and commands. Anthropic's own docs use a context-usage chart as the canonical mod example, ship a sample (`token-weather`) that puts a context "forecast" in the band, and ship a built-in mod (`cc-plugin-you-should-know`) that shows the user notes about things they may have missed.

### Cited Findings

**What a mod is and where it runs**
- "A mod is a plugin that changes how Claude Code looks and behaves. It's made of JavaScript or TypeScript event handlers ... the handler can watch the event, change it, or take it over. Use a mod to add a feature of your own to Claude Code, such as a pane that charts how full your context is after each request." — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- A hook can "**Observe**: note what's happening and let it continue unchanged", "**Rewrite**", or "**Answer**". — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- Versions: "Mods are on by default. In the terminal, use Claude Code v2.1.287 or later. The Desktop app ... from v2.1.286." VS Code chat panel draws mods from extension 2.1.299 (2.1.304 where feature flags aren't fetched). The early-access env var `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is now ignored. — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- Surfaces: hooks run and draw in the terminal CLI (including JetBrains' terminal), the Desktop Code tab (not WSL or SSH sessions), and the VS Code panel; hooks run but nothing is drawn in `claude -p` and the Agent SDK; cloud sessions run hooks for plugins that reach them but draw "Not in every session". — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- Comparison table: only a mod "Can ... draw in the interface"; "Pick it when: You want a pane, a band above the prompt, a custom command, or to rewrite an event". — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)

**Events useful to an observer** — [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference.md)
- Tools: `tool.call`, `tool.check`, `tool.judge` (v2.1.326+), `tool.run` (v2.1.326+), `tool.describe`.
- Turns: `turn.start`, `turn.step` ("One request is about to go to the model"), `turn.complete` (may return `{ text }` "to show a line under the answer").
- Session: `session.start`, `session.end`, `session.compact` ("The conversation is about to be compacted"; can return `{ skip: reason }`), `session.append` ("Once for each row the conversation keeps, such as a prompt, a response block, a tool result, or a notice, before it's stored"), `session.measure` ("After each turn, and when a plan limit's percent used changes"), `session.stop` (user pressed Esc; v2.1.326+).
- Prompts: `prompt.submit`, `prompt.compose`, `prompt.section`, `prompt.context`, `prompt.attachment` (Claude Code's own reminders to the model), `skill.prompt`.
- Subagents: `agent.offer`, `agent.spawn`.
- Every settings hook event is also available as `classic.<Event>`, e.g. `classic.Stop`, `classic.PostToolUse`.
- `telemetry.log` / `telemetry.mark` exist but an installed mod must filter `{ to: 'collector' }`.

**API useful to an observer** — [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference.md)
- `$.ui`: `open`, `close`, `panes`, `place` (row in the transcript, v2.1.314+, terminal only, max 500 rows per mod), `toast` ("Shown for 4 seconds unless you pass `{ timeoutMs }`"), `notify`, `status`, `log`, `notice`, `ask`, `view` (v2.1.300+).
- `$.session`: `messages` (newest 4,096 entries), `usage()` which "returns `{ startedAt, context, rateLimits, cost }`: `context` has `tokens`, `window`, and `percent`", `turns`, `compact`, `info`.
- `$.agent.list()` returns subagents and teammates with status `pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`.
- `$.store` (4 MiB JSON shared by sessions), `$.state`, `$.clock`, `$.fs`, `$.model.complete`.
- Render sites: `Pane` (terminal, Desktop, VS Code), `AbovePrompt` (terminal, Desktop; not VS Code), `AbovePromptList` (v2.1.323+), `Placed` (terminal), `Backdrop` (desktop, mobile), `UserMessage`, plus Claude Code's own rows such as the `Spinner`.
- Limits: a hook gets 10 s per event; redraws throttled to 10/s (30/s in the terminal for the visible pane and band); a pane opened unprompted needs 144 terminal columns (110 after the user has opened it once).

**Trust model**
- "A mod is code that runs with your permissions ... Mods aren't sandboxed." A mod can "See your session: every prompt you send and every tool call Claude makes" and can approve tool calls unless the built-in guard `cc-plugin-sec-default` stops it. — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- `claude plugin validate ./some-mod` lists "the events the mod handles and what it asks Claude Code to do" (`hooks:` and `calls:` lines) without running it; this is the official way for a user to confirm a mod only observes. — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- Testing: `claude plugin test` runs automated mod tests "with no session, sign-in, or network" (5 s per test by default). — [Test a mod](https://code.claude.com/docs/en/plugins/mods/test.md); [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference.md)

**Official sample mods** (`anthropics/claude-code-playground`, directory `claude-code/mods`, marketplace name `claude-code-playground-mods`; "shares them as they are, without support") — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md); [repo directory](https://github.com/anthropics/claude-code-playground/tree/main/claude-code/mods)

| Sample mod | What it shows | Surface | Differs from a passive teaching observer |
|---|---|---|---|
| `token-weather` | "Draws a live forecast of the context window above the prompt." | Band (`AbovePrompt`) | Closest first-party analogue to a context band; one number as a metaphor, no breakdown of what fills the window |
| `replay-theater` | "Lets you step through the file edits Claude made in the last turn, one diff at a time." Adds `/replay`. | Command + pane | Replays edits only; no reads, searches, runs or verification steps |
| `blast-radius` | "Holds a risky shell command (`rm -rf`, `git reset --hard`, a force push, a migration) and shows what it would change, with Proceed and Cancel buttons." | Tool-call interception | Blocks a tool call, the opposite of "only watches" |

**Mods built into Claude Code** (listed under **Built-in** on the Installed tab of `/plugin`) — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)

| Built-in mod | What it does | Differs |
|---|---|---|
| `cc-plugin-you-should-know` | "a side agent shows a note above the prompt when it finds something you might have missed". Off by default; needs v2.1.287+. The side agent "has no tools, so it can't read files, run commands, or change what Claude does"; it "looks for one thing you should know but might have missed, such as a tradeoff Claude chose without calling it out or a result that may be off". Each check is a billed background model request. Debug with `CLAUDE_CODE_YOU_SHOULD_KNOW_DEBUG=1`. — [Interactive mode: You should know](https://code.claude.com/docs/en/interactive-mode.md) | Nearest first-party thing to a passive observer with a band. It is model-judged (costs tokens) rather than rule-based, gives one note at a time, and offers "Learn more / Knew this already / Dismiss" |
| `cc-plugin-diff` | "Takes over `/diff` and draws its pane"; in fullscreen the panel "stays open and updates while you keep working", with per-turn views of Claude's edits — [Interactive mode: /diff](https://code.claude.com/docs/en/interactive-mode.md) | Shows what changed, not how or whether it was verified. Notes that "a change Claude makes through a shell command appears only under `Current`" |
| `cc-plugin-easel` | Gives Claude a chart-drawing tool and auto-charts time-series MCP results; v2.1.321+ (Team/Enterprise v2.1.326+) | Charts data, not the session |
| `cc-plugin-telemetry` | "Sends the analytics records that Claude Code and its built-in mods log" | Vendor telemetry |
| `cc-plugin-sec-default` | Guard that protects managed policy from user mods | Policy |
| `cc-plugin-agents-md`, `cc-plugin-plugin-authoring` | Loads `AGENTS.md`; gives Claude the `plugin-authoring` skill for writing mods | Not views |

- Public source of some built-ins, "each ... a complete plugin with its hooks module and tests": `diff`, `agents-md`, `sec-default`, `telemetry` in [anthropics/claude-code/mods](https://github.com/anthropics/claude-code/tree/main/mods); the TypeScript declarations for every event, method and element are at [mods/types/claude-code.d.ts](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts). — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md); [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference.md)
- "Interface gallery for mods" is a docs page of interface elements (text, buttons, fields, Markdown, code, diffs) "with sample code and terminal screenshots". It is an element gallery, not a gallery of mods. — [docs index](https://code.claude.com/docs/llms.txt)
- The docs' own tutorial mod counts tool calls and shows the count beside the spinner ("Thinking · tool calls: 3…"), and the overview repeatedly uses "read each request's token usage while another charts it in a pane" and a plugin named `token-chart` as examples. — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)

### Inferences
- Anthropic treats context and token visibility as the canonical mod use case (overview example, `token-chart`, `token-weather`). A context band alone will not look novel next to these; a breakdown of what fills the window, and what a compaction kept, goes beyond what the samples show.
- `session.compact` fires before compaction and the settings hook `PostCompact` (reachable as `classic.PostCompact`) fires after it, so a compaction autopsy has first-party events on both sides. `session.append` gives a row-by-row feed for a loop trace without reading the JSONL file.
- "You should know" establishes a first-party interaction pattern for an above-prompt note (numbered actions: learn more, knew this already, dismiss) and a first-party precedent for a side observer with no tools. "Knew this already" is a cheap signal for muting a lesson the user has learned.
- `replay-theater` covers edits only; the `/diff` mod notes shell-made changes are missing from turn views. A loop trace that includes Bash-made changes and verification runs fills a gap that Anthropic's docs acknowledge.
- `AbovePrompt` is not rendered in the VS Code panel, so a band-first mod needs a pane or transcript-row fallback there; the docs say a mod "can check which app it's running in, and fall back".

### Gaps
- No calendar date for the mods launch was found in the docs; only versions (v2.1.286/287 general availability, reference current to v2.1.290/2.1.299). The changelog was not fetched. Third-party coverage (The New Stack and others) appeared in search results but was out of scope and not read.
- READMEs of the three sample mods were not read, so how each is built (which events and API calls) is not recorded here.
- Whether claude.com/marketplace has a "mods" filter or category was not checked.

## Q3. Built-in commands and features: what does each reveal about what the agent is doing?

### Takeaway
Claude Code already exposes most raw facts a newcomer needs (context grid, usage and cache stats, transcript viewer, task checklist, background tasks, diffs, checkpoints, session recap, an HTML insights report), but each is pull-based, scattered across commands and shortcuts, and none interprets the loop or tracks test state over a turn. Several items in the brief have been renamed: `/cost` and `/stats` are now aliases of `/usage`, and `/review` is an alias of `/code-review`.

### Cited Findings

All command rows are from the [Commands reference](https://code.claude.com/docs/en/commands.md) unless another source is given. Surface is the terminal CLI unless stated.

| Item | What it shows / does | Delivery | Differs from a passive teaching observer |
|---|---|---|---|
| `/context [all]` | "Visualize current context usage as a colored grid. Shows optimization suggestions for context-heavy tools, memory bloat, and capacity warnings." In fullscreen it collapses the per-item breakdown; `all` expands it. Also lists "which CLAUDE.md and auto memory files loaded" — [context window](https://code.claude.com/docs/en/context-window.md) | Built-in command | A snapshot you must ask for; no history across turns and nothing about what compaction kept |
| `/usage` (aliases `/cost`, `/stats`) | "Show session cost, plan usage limits, and activity stats." Session block: total cost, API and wall duration, lines changed, usage by model. `Prompt cache (main)` line with requests, share from cache, misses, likely cause of last miss (v2.1.251, cause text v2.1.260). Plan breakdown attributes usage to "skills, subagents, plugins, and individual MCP servers" with recommendations such as `25%  Trim ~/code/api/CLAUDE.md · 49k tokens per request`; `f` applies fixes (v2.1.305); `d`/`w` toggles 24 h / 7 days. — [costs](https://code.claude.com/docs/en/costs.md) | Built-in command; VS Code shows attribution in "Account & usage" | Cost and limits, not behavior; recommendations are about spend |
| `/insights` | "Generate an HTML report analyzing your recent sessions on this machine: which projects you work in, how you use Claude Code, where things go wrong, and features to try." Up to 200 unseen sessions per run; covers "friction points such as misunderstood requests or buggy code"; written to `~/.claude/usage-data/report.html`; uses model tokens; not in cloud sessions. — [costs](https://code.claude.com/docs/en/costs.md) | Built-in command | Retrospective and model-written across many sessions; nothing live |
| `/statusline` + status line | Runs a user script with JSON on stdin. Fields include `context_window.used_percentage`, `context_window.current_usage`, `cost.total_cost_usd`, `cost.total_lines_added`, `rate_limits.five_hour.used_percentage`, the `prompt_cache` object (`hit_ratio`, `misses`, `expected_rebuilds` "that followed a compaction or a clearing of old tool results", `last_miss_cause`), `transcript_path`, `prompt_id`, `output_style.name`. Official examples: context bar, git status, cost and duration, rate limits. — [status line](https://code.claude.com/docs/en/statusline.md) | Built-in, user-scripted row above the footer | One always-on line of numbers; the user writes the script and the meaning |
| Spinner token count | "`Deciphering… (10m 27s · ↓ 5.5k tokens)`", a live approximate count of the turn's output. — [costs](https://code.claude.com/docs/en/costs.md) | Built-in | A single number |
| Verbose mode | "adds a token counter ... showing the size of your context as the last API response reported it". — [status line](https://code.claude.com/docs/en/statusline.md) | Setting | Raw detail, no explanation |
| Transcript viewer, `Ctrl+O` | "Shows detailed tool usage and execution, with a timestamp and the model used on each assistant message. Also expands lines that collapse by default, such as MCP calls". `Ctrl+E` toggles show-all in the classic renderer only. Note `Ctrl+R` is reverse history search, not a transcript toggle. — [interactive mode](https://code.claude.com/docs/en/interactive-mode.md) | Built-in view | The full raw log; no grouping into loop steps and no flags |
| `/focus` | Focus view "shows only your last prompt, a one-line tool-call summary with edit diffstats, and the final response"; counts subagents launched; fullscreen only (VS Code has its own Focus view). | Built-in command | Hides the loop rather than explaining it |
| Task list, `Ctrl+T` | "Claude's to-do checklist: items Claude created to plan multi-step work, with indicators showing what's pending, in progress, or complete." Shows up to five; "Tasks persist across context compactions". Only filled where the model has task tools: default on "Opus 4.7, Sonnet 4.6, Haiku 4.5, and earlier models", otherwise opt in with `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. — [interactive mode](https://code.claude.com/docs/en/interactive-mode.md) | Built-in view | Claude's own plan, self-reported; empty by default on newer models |
| `/tasks` (alias `/bashes`), `Ctrl+B` | "View and manage background work in the current session, including subagents that have finished." | Built-in | Lists background shells and subagents, not foreground steps |
| `/agents`, agent view (`claude agents`) | Agent view (research preview) is "one screen for all your background sessions: what's running, what needs your input, and what's done", grouped as Needs input / Working / Ready for review / Completed; the row summary is "generated by a Haiku-class model"; `Space` peeks, `Enter` attaches, `claude logs <id>` prints output. `/agents` itself now only prints a reminder (it was an interactive UI up to v2.1.197). — [agent view](https://code.claude.com/docs/en/agent-view.md) | Built-in screen and shell commands | Cross-session triage for experienced users |
| `/workflows` | "Open the workflow progress view to watch, pause, resume, or save running and completed workflows" | Built-in | Orchestration progress |
| `/diff` | "Review the changes in your working tree, including the edits Claude has made so far", with per-turn views (built-in mod `cc-plugin-diff`). — [interactive mode](https://code.claude.com/docs/en/interactive-mode.md) | Built-in mod, pane | Output of the work, not the process |
| `/rewind` (aliases `/checkpoint`, `/undo`), `Esc` twice | "Rewind the conversation and/or code to a previous point, or summarize from a selected message." Limitation: "a file that only a Bash command touched isn't restored". — [best practices](https://code.claude.com/docs/en/best-practices.md) | Built-in | A control, not a view |
| `/compact [instructions]`, `/autocompact` | "Free up context by summarizing the conversation so far." What survives is documented as a table (see Q5). — [context window](https://code.claude.com/docs/en/context-window.md) | Built-in | The product documents the rules but shows no per-compaction account of what was kept |
| `/recap`, session recap | One-line summary on demand; an automatic recap appears after 3+ minutes away with the terminal unfocused; capped at 400 characters. — [interactive mode](https://code.claude.com/docs/en/interactive-mode.md) | Built-in, on by default | Says what happened, in one line, written by the model |
| `/btw` | "Ask a side question about the current session without adding to the conversation"; can be asked about a subagent. | Built-in | The user has to know what to ask |
| `/export` | "Export the current conversation as plain text." | Built-in | Raw data out |
| `/doctor` (alias `/checkup`) | Bundled skill: "setup checkup that diagnoses installation, settings, extension, and `CLAUDE.md` problems and proposes fixes"; `prompt-audit` needs v2.1.283. | Bundled skill | Configuration health, not session behavior |
| `/debug`, `/hooks`, `/status` | Session debug log analysis; view hook configuration; version, model, account, connectivity. `/context`, `/doctor`, `/hooks`, `/mcp` are the documented way "to see what actually loaded". — [docs index](https://code.claude.com/docs/llms.txt) | Built-in | Troubleshooting |
| `/output-style` | Built-in styles are Proactive, Concise (v2.1.237+), Explanatory and Learning. Explanatory "adds short `Insight` blocks that explain the choices behind the code it writes"; Learning adds the same blocks and "leaves small pieces of code for you to write yourself", marking the spot with `TODO(human)` and a "Learn by Doing" request. Command needs v2.1.269; applies from the next message since v2.1.251. "The built-in Explanatory and Learning styles produce longer responses than Default by design, which increases output tokens." — [output styles](https://code.claude.com/docs/en/output-styles.md) | Built-in setting; terminal, VS Code, Desktop via settings | The model narrates its own choices inside the conversation; it explains the code, not the agent's process, and it changes the system prompt |
| `/plan`, plan mode | "Claude explores the codebase and proposes an approach for your approval". — [costs](https://code.claude.com/docs/en/costs.md) | Built-in mode | Shows intent before work, not what happened |
| `/code-review` (alias `/review`; `/ultrareview` = `/code-review ultra`) | Bundled skill: "Review the current diff, or a PR number, branch, or path you pass, for correctness bugs"; effort levels low to max; `--fix`, `--comment`; `ultra` is a multi-agent cloud review. It "reviews the diff in a fresh subagent that never saw your conversation". — [best practices](https://code.claude.com/docs/en/best-practices.md) | Bundled skill; separate managed Code Review product on GitHub PRs for Team/Enterprise — [Code Review](https://code.claude.com/docs/en/code-review.md) | Findings go back into the session for Claude to fix |
| `/security-review` | "Analyze the changes on your current branch for security vulnerabilities." | Built-in | On-demand review |
| `/verify`, `/run`, `/run-skill-generator` | `/verify`: "Confirm a code change does what it should by building your project's app, running it, and observing the result, rather than relying on tests or type checks." | Bundled skills | Claude does the verifying; nothing records whether verification happened |
| `/goal [condition]` | "Claude keeps working across turns until the condition is met"; "a separate model checks against the conversation after every turn". — [goal](https://code.claude.com/docs/en/goal.md); [best practices](https://code.claude.com/docs/en/best-practices.md) | Built-in | An enforcement loop that sends Claude back to work |
| `/simplify` | Four parallel review agents for cleanup; "doesn't look for correctness bugs". | Bundled skill | Edits code |
| `/powerup` | "Discover Claude Code features through quick interactive lessons with animated demos" | Built-in | The only in-product teaching feature found; it teaches features in the abstract, not from the user's live session |
| `/team-onboarding` | "Generate a team onboarding guide from your Claude Code usage history" (past 30 days) | Built-in | Onboarding text from history |
| `/fewer-permission-prompts` | Bundled skill that scans transcripts for common read-only calls and proposes an allowlist | Bundled skill | Shows transcripts being mined by a first-party skill |
| `/release-notes` | Changelog in a version picker; "The notes appear in your transcript without entering the conversation Claude sees" | Built-in | Precedent for content the user sees and the model does not |
| Prompt suggestions | A short request after each response suggests the next prompt. — [costs](https://code.claude.com/docs/en/costs.md) | Built-in | Nudges the next step |
| "Explore the context window" docs page | "An interactive simulation of how Claude Code's context window fills during a session", from startup to compaction, with example token counts per step (e.g. system prompt 4,200; project CLAUDE.md 1,800; `npm test` output 1,200; 22,225 tokens before `/compact`, 17,095 after). — [context window](https://code.claude.com/docs/en/context-window.md) | Docs page (web) | The first-party teaching artifact for context, but with canned numbers; it tells readers to run `/context` for real ones |

- No `/todos`, `/learn`, `/explain`, `/transcript` or `/trace` command appeared in the command reference rows I extracted. — [Commands reference](https://code.claude.com/docs/en/commands.md)

### Inferences
- The first-party surface is a set of separate pull-based views. What none of them does: (a) classify steps of a turn into read/search/edit/run/verify/delegate, (b) track red/green test state across a turn or flag "edit never verified" or "turn ended red", (c) show what a specific compaction kept or dropped.
- The task list is empty by default on current models (it needs task tools that newer models don't get unless opted in), so a mod cannot rely on TodoWrite/TaskCreate events as its outline of the loop.
- Useful conventions to match so the mod feels native: the `★ Insight ───` block shape from Explanatory style; the `/usage` recommendation row shape (share, action, size); `/release-notes`-style content that never enters the model's context.
- The docs' simulated context timeline is a ready-made vocabulary for a context X-ray ("Before you type", "As Claude works", what re-injects after compaction) and gives example magnitudes for teaching copy.
- Anthropic has pulled `/cost` and `/stats` into `/usage`; references to them as separate commands in third-party material are out of date.

### Gaps
- I did not read the full checkpointing, fullscreen, sessions, sub-agents, workflows or VS Code/Desktop pages, so Desktop- and IDE-specific views (visual diff review, side chats, plan review, PR monitoring) are known only from page descriptions in the docs index.
- The `/context` output format beyond the one-row description (category names, exact suggestions) was not captured.
- Whether thinking summaries/"thinking display" have a dedicated toggle was not checked.

## Q4. Monitoring: OpenTelemetry, analytics dashboards, Agent SDK hooks and tracing, transcripts as data

### Takeaway
Anthropic's monitoring stack is aimed at organizations and backends: OpenTelemetry metrics, events and beta traces exported to your own collector, plus adoption/ROI dashboards. The same raw signals (tool results, API requests, hook events, the JSONL transcript) are available locally, but Anthropic ships no local viewer for them.

### Cited Findings

**OpenTelemetry** — [Monitoring](https://code.claude.com/docs/en/monitoring-usage.md)
- Enable with `CLAUDE_CODE_ENABLE_TELEMETRY=1` plus `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` (otlp, prometheus, console).
- Metrics: `claude_code.session.count`, `claude_code.lines_of_code.count`, `claude_code.pull_request.count`, `claude_code.commit.count`, `claude_code.cost.usage`, `claude_code.token.usage`, `claude_code.code_edit_tool.decision`, `claude_code.active_time.total`.
- Events: `claude_code.user_prompt`, `claude_code.assistant_response`, `claude_code.api_request` (model, cost_usd, duration_ms, input/output/cache tokens, effort), `claude_code.api_error`, `claude_code.api_refusal`, `claude_code.tool_decision`, `claude_code.tool_result` (tool_name, success, duration_ms, error_type, input and result sizes), plus `plugin_loaded`, `mcp_server_connection`, `subagent_completed`, `safety_event`, `managed_settings_resolved`.
- Traces (beta, off by default): `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` and `OTEL_TRACES_EXPORTER=otlp`. Spans: `claude_code.interaction` (root, one per user prompt), `claude_code.llm_request`, `claude_code.tool`, `claude_code.tool.blocked_on_user`, `claude_code.tool.execution`, `claude_code.hook`. `TRACEPARENT` propagates to Bash subprocesses.
- Redacted by default; opt-ins: `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_ASSISTANT_RESPONSES=1`, `OTEL_LOG_TOOL_DETAILS=1` (Bash commands, file paths, tool input), `OTEL_LOG_TOOL_CONTENT=1` (tool output, needs tracing), `OTEL_LOG_RAW_API_BODIES=1`. Content truncated at 60 KB.
- The status line's `prompt_id` "Matches the `prompt.id` attribute on OpenTelemetry events". — [status line](https://code.claude.com/docs/en/statusline.md)
- Differs: fleet telemetry for an admin's observability stack; needs a collector and a dashboard; teaches nothing.

**Monitoring guide repo**
- `anthropics/claude-code-monitoring-guide`: a guide to measuring Claude Code ROI with `docker-compose.yml`, `prometheus.yml`, `otel-collector-config.yaml`, a `grafana/` directory, a report-generation prompt and a sample report; 394 stars, one commit on `main`. — [repo](https://github.com/anthropics/claude-code-monitoring-guide)
- Differs: an ROI reporting recipe for managers.

**Analytics dashboards** — [Analytics](https://code.claude.com/docs/en/analytics.md)
- Team/Enterprise: claude.ai/analytics/claude-code shows "lines of code accepted, suggestion accept rate, daily active users and sessions", contribution metrics via GitHub (PRs and LOC "with Claude Code", public beta), a leaderboard and CSV export. Merged PRs with assisted lines are labeled `claude-code-assisted`.
- API customers: platform.claude.com/claude-code shows lines accepted, accept rate, active users, sessions, spend, and a per-member table; the Claude Code Analytics API returns daily per-user metrics; Enterprise has the Enterprise Analytics API.
- "Code Review has its own dashboard."
- Differs: organization adoption and ROI; no per-session behavior.

**Settings hooks as an observation channel** — [Hooks reference](https://code.claude.com/docs/en/hooks.md)
- Events include `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `StopFailure`, `SubagentStart`, `SubagentStop`, `TaskCreated`, `TaskCompleted`, `InstructionsLoaded` ("A CLAUDE.md or `.claude/rules/*.md` file is loaded into context"), `PreCompact`, `PostCompact`, `Notification`, `MessageDisplay`, `PreModelSwitch`, `PostModelSwitch`, `SessionEnd`.
- Observe-only events (exit 2 cannot stop them) include `PostToolUse`, `PostToolUseFailure`, `PostCompact`, `InstructionsLoaded`, `SessionStart`, `SubagentStart`, `Notification`. `PreCompact` can block, and its stdout "becomes instructions for the compaction summary"; compaction matchers are `manual` or `auto`.
- "Every event receives `transcript_path` ... The file is written asynchronously and can lag the in-memory conversation, so it may not include the current turn's latest messages when a hook fires." Use `last_assistant_message` on `Stop` and `SubagentStop` for the final text.
- `"async": true` runs a command hook in the background; "Async command hooks can't block the action".
- Caution from another page: "Context that hooks added earlier" is summarized at compaction, and `PostToolUse` output can be appended "to Claude's context" (as security-guidance does). — [context window](https://code.claude.com/docs/en/context-window.md); [security-guidance](https://code.claude.com/docs/en/security-guidance.md)

**Transcripts (JSONL) as a data source**
- First-party tools already mine local transcripts: `/insights` (sessions on this machine), `/usage` breakdown ("computed from local session history on this machine"), `/fewer-permission-prompts`, `/team-onboarding`, and the `session-report` plugin (reads `~/.claude/projects`). — [costs](https://code.claude.com/docs/en/costs.md); [Commands](https://code.claude.com/docs/en/commands.md); [session-report SKILL.md](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/session-report/skills/session-report/SKILL.md)
- Session data is cleaned up after `cleanupPeriodDays`, "30 days by default". — [costs](https://code.claude.com/docs/en/costs.md)
- For background sessions the docs recommend `claude agents --json` "over reading the files under `~/.claude/jobs/`". — [agent view](https://code.claude.com/docs/en/agent-view.md)

**Agent SDK**
- The SDK docs have a "Control and observability" group: hooks ("Intercept and customize agent behavior at key execution points"), file checkpointing, cost tracking, "Observability with OpenTelemetry" ("Export traces, metrics, and events from the Agent SDK to your observability backend"), and todo tracking ("render Claude's progress in your application from structured tool calls"); plus streaming output of text and tool calls and session-transcript mirroring to external storage. — [docs index](https://code.claude.com/docs/llms.txt)
- Mods' hooks run under `claude -p` and the Agent SDK but nothing is drawn. — [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md)
- Differs: building blocks for someone writing their own agent UI.

### Inferences
- Anthropic's trace span model (`interaction` → `llm_request` / `tool` → `tool.blocked_on_user` / `tool.execution`, plus `hook`) is a first-party schema for a loop trace; aligning step names and `prompt.id` with it would let the mod's trace line up with OTel exports.
- `tool.blocked_on_user` is a step type the requester's list (read, search, edit, run, verify, delegate) lacks: time spent waiting for the human.
- The docs' warning that `transcript_path` lags the live conversation matters for anything that computes flags at `Stop`; in a mod, `session.append` or `$.session.messages()` avoids the lag.
- `InstructionsLoaded` and `PostCompact` are observe-only events that map directly onto a context X-ray and a compaction autopsy.
- OTel's default redaction (no prompts, no tool details unless opted in) is a first-party precedent for a "metadata only leaves the transcript" stance.

### Gaps
- The second half of the monitoring page (remaining events, any hook/skill/compaction-specific events, dashboards examples) and of the hooks reference (exact `PreCompact`/`PostCompact` input fields such as `trigger`, `custom_instructions`, `compact_summary`) were not read; the field names are unconfirmed.
- The Agent SDK observability, hooks and todo-tracking pages were not opened; statements above rest on their index descriptions.
- The Grafana dashboards in the monitoring guide and its last-updated date were not confirmed.

## Q5. Has Anthropic published guidance on supervising an agent: verifying tests, context management, compaction?

### Takeaway
Yes. The current best-practices page is built around "give Claude a check to run" and "ask Claude for evidence", and it has explicitly retired the older "manage context aggressively" advice now that most models have a 1M-token window with automatic compaction. Compaction rules are documented precisely in a "What survives compaction" table.

### Cited Findings

**Verification** — [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices.md)
- "Claude stops when the work looks done. If it has nothing to run that tells it whether the work actually *is* done, 'looks done' is all it has to go on. In practice that makes you the test suite, and every mistake sits there until you happen to notice it."
- "Give Claude something it can run that comes back pass or fail. Once it has that, it can keep going on its own and you don't have to watch."
- "If your repo already has one of these, the single most useful line in your `CLAUDE.md` is the command that runs it."
- Four levels of strictness: in the prompt ("run the auth tests after, and keep going until they pass"), `/goal`, a `Stop` hook ("enforced by Claude Code (the harness), so the turn doesn't end until the typecheck passes"), and review "by someone who didn't write the code" (`/code-review` in "a fresh subagent that never saw your conversation").
- "Whichever option you use, ask Claude for *evidence*: the command it ran and its output, or the screenshot. 'All tests pass' on its own tells you very little, and reading the output is faster than rerunning the check yourself. For a session you weren't watching, it's also the only evidence you have."
- `/verify` "catches the kind of problem that tests and typechecks miss."
- Stop-hook example: `pnpm tsc --noEmit 1>&2 || exit 2`; "If the hook blocks eight stops in a row with no tool call between them, Claude Code overrides the next block and ends the turn."
- On reviewers: "A reviewer that's asked to find problems will always find *something*. If you fix every finding, you end up with extra abstraction layers and tests for cases that can't happen."
- Prompting for tests first: "write a failing test that reproduces it, then fix it" is the page's model of a specific prompt.
- Readiness check for unattended runs: "Does it know what done looks like? A goal condition, a spec file, or a failing test it has to turn green." and "Can it check its own work? The test suite, a `Stop` hook, some kind of review step."
- Cost page, same theme: "Give verification targets: Include test cases, paste screenshots, or define expected output in your prompt. When Claude can verify its own work, it catches issues before you need to request fixes." and "Test incrementally: Write one file, test it, then continue." — [costs](https://code.claude.com/docs/en/costs.md)

**Steering** — [Best practices](https://code.claude.com/docs/en/best-practices.md)
- "Watch the first minute, press `Esc` the moment Claude drifts, and after two failed corrections run `/clear` and write a better prompt instead of a third."
- "No amount of configuration replaces watching the first minute and stepping in when Claude heads somewhere you didn't intend."
- "Checkpoints cover the files Claude edited with its own file tools in your main conversation, so a file that only a Bash command touched isn't restored."

**Context management** (current position)
- "With a 1M-token window on most current models and compaction near the top of it, you'll rarely run out of context. You can still *pay* for context you don't need, though. Every request sends the whole conversation". — [Best practices](https://code.claude.com/docs/en/best-practices.md)
- Retired advice, under "What you can stop doing": "The context window is your main constraint, manage it aggressively" is gone because "Most current models have a 1M-token window and compaction happens on its own, so running out is rare. `/clear` between tasks is still worth doing, because a focused context gets you better answers and costs less." Also retired: "Use subagents to protect your context window". — [Best practices](https://code.claude.com/docs/en/best-practices.md)
- "Clear between tasks: run `/clear` when switching to unrelated work. Old conversation crowds out the files you need next and costs tokens on every message." and "Delegate large reads: send research to a subagent so the file contents stay in its context window, not yours." — [context window](https://code.claude.com/docs/en/context-window.md)
- "Aim to keep CLAUDE.md under 200 lines". — [costs](https://code.claude.com/docs/en/costs.md)

**Compaction**
- What survives (selected rows): system prompt and output style "still apply"; project-root CLAUDE.md, unscoped rules and auto memory are "Re-injected from disk"; "Files Claude read or edited: Claude Code re-reads up to five, most recently modified first" (a file over 5,000 tokens returns as a path reference shown as `Referenced file`); invoked skill bodies are re-injected, "capped at 5,000 tokens per skill and 25,000 tokens total; oldest dropped first"; path-scoped rules and nested CLAUDE.md reload only on demand; "Context that hooks added earlier: Summarized with the rest of the conversation"; background commands and subagents keep running. — [context window](https://code.claude.com/docs/en/context-window.md)
- "Compact with a focus: run `/compact` with instructions, like `/compact focus on the auth bug fix` ... The summary keeps what you choose instead of what the automatic pass guesses is important." — [context window](https://code.claude.com/docs/en/context-window.md)
- CLAUDE.md can carry a "# Compact instructions" section, e.g. "When you are using compact, please focus on test output and code changes". — [costs](https://code.claude.com/docs/en/costs.md)
- "On a long session `/compact` is itself a big request, since it reads the whole conversation to summarize it"; "On the one-hour cache, a session past about 200K tokens that sits idle is compacted shortly before the cache expires, so after lunch you continue from a summary." — [Best practices](https://code.claude.com/docs/en/best-practices.md)
- An instruction given in conversation "can get lost when the conversation compacts, so anything that matters belongs in a deny rule." — [Best practices](https://code.claude.com/docs/en/best-practices.md)
- "Tasks persist across context compactions". — [interactive mode](https://code.claude.com/docs/en/interactive-mode.md)

**Other first-party teaching material**
- `/powerup`: "Discover Claude Code features through quick interactive lessons with animated demos". — [Commands](https://code.claude.com/docs/en/commands.md)
- Docs pages aimed at understanding the agent: "How Claude Code works" ("Understand the agentic loop, built-in tools, and how Claude Code interacts with your project"), "Explore the context window", a Glossary ("agentic loop, compaction, CLAUDE.md, hooks, subagents, MCP"), a Prompt library, and adoption kits (Communications kit, Champion kit). — [docs index](https://code.claude.com/docs/llms.txt)
- Engineering/blog posts surfaced by search: "Effective context engineering for AI agents" (anthropic.com/engineering), "Harness design for long-running apps" (anthropic.com/research), "Building agents with the Claude Agent SDK", and a claude.com article "Using Claude Code: session management and 1M context". The old URL anthropic.com/engineering/claude-code-best-practices now resolves to a page titled "Best practices for Claude Code - Claude Code Docs". — [search result: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents); [Harness design](https://www.anthropic.com/research/harness-design-long-running-apps); [session management article](https://claude.com/resources/articles/using-claude-code-session-management-and-1m-context); [old best-practices URL](https://www.anthropic.com/engineering/claude-code-best-practices)
- Anthropic Academy (anthropic.skilljar.com) lists a "Claude Code 101" course and "Introduction to agent skills"; these two URLs appeared in search results. — [Claude Code 101](https://anthropic.skilljar.com/claude-code-101); [Introduction to agent skills](https://anthropic.skilljar.com/introduction-to-agent-skills)

### Inferences
- The mod's flags line up with first-party guidance almost one for one: "edit never verified" and "turn ended red" are what "you become the test suite" warns about; "ask for evidence: the command it ran and its output" is exactly what a test ledger displays without the user asking. Quoting these lines in the mod's teaching copy would anchor its lessons in Anthropic's own wording.
- "Test changed to pass" has no direct first-party sentence in the pages read; the closest is the reviewer caution about "tests for cases that can't happen" and the fresh-reviewer principle. This flag is the mod's own contribution.
- Anthropic's context message has shifted from scarcity to cost and focus. A context X-ray that teaches "you are about to run out" is behind the current guidance; one that teaches "what you are paying to re-send every turn, and what a compaction will keep" matches it. The prompt-cache statistics (misses, expected rebuilds after compaction) are the first-party framing of that cost.
- The "What survives compaction" table is effectively a specification a compaction autopsy can check an actual compaction against (five most recent files, 5,000-token file cap, skill caps, hook-added context summarized away, path-scoped rules gone until re-triggered).
- "Watch the first minute" suggests a newcomer-facing mod is most useful early in a turn; it is an argument for a band that is informative from the first tool call rather than only at `Stop`.

### Gaps
- The Anthropic Academy catalog returned HTTP 403, so the current course list is unverified. Third-party pages give conflicting counts (13 at a March 2026 launch, 17 in May 2026, 21 undated) and mention "Claude Code in Action"; none of that is confirmed from Anthropic's own site, and I found no course specifically about supervising an agent, verifying tests or compaction.
- The engineering and research posts above were identified by search only and not read, so no quotes are taken from them and their dates are unknown.
- I did not read "How Claude Code works", the glossary, the champion kit or the goal page in full.
- No Anthropic statement was found that describes a product aimed at teaching newcomers by observing their live session (beyond `/powerup` lessons, the Learning/Explanatory styles and "You should know"). Absence in the pages read is not proof that none exists.
