# Founder's Playbook, systems design and DuckDB: what an in-session observer could show about WHAT is built and HOW

Researched 2026-11-22. Conventions used throughout: "The playbook says" marks text taken from the PDF; **[Inference]** marks my own proposed mapping or reading. Anything I could not source in this session is in a Gaps list, not in Cited Findings.

Retrieval note for the playbook: the landing page is not gated. It links a direct PDF ("Download now"), which I downloaded and read in full with `pdftotext` (36 pages, created 2026-05-05, InDesign). All playbook quotes below are from that PDF text. The web version is split into chapter pages under the same URL path; I did not fetch those individually, and did not fetch the claude.com blog post that announces it.

## 1. What does the Founder's Playbook say: stages, practices, artifacts, checklists, roles, metrics?

### Takeaway
The playbook is a 36-page, four-stage guide (Idea, MVP, Launch, Scale). Each chapter has the same shape: goal, exit criteria, challenges (failure modes), then "How Claude can help" with named exercises. It is strong on validation discipline, written context (CLAUDE.md, scope document, session log), security review before users, and a measurement framework set before launch. It says very little about evals, CI/CD, code review process, deployment mechanics or testing technique; those words barely appear.

### Cited Findings

**Structure and framing**
- Contents: "The startup lifecycle, rebooted for 2026" (p3), "What it means to be a founder is changing" (p5), "Idea Stage" (p8), "MVP stage" (p15), "Launch stage" (p21), "Scale stage" (p25), "Same job, new rules" (p31), "Resources" (p33) — [Playbook PDF](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- The landing page describes the guide as an 85-minute read, with a "Start reading" link to the first chapter page and an ungated "Download now" PDF link — [Landing page](https://claude.com/resources/guides/the-founders-playbook-building-an-ai-native-startup)
- "This playbook remaps the four core stages of the startup journey (Idea, MVP, Launch, and Scale) according to these new realities." — [Playbook PDF, p4](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- On the founder's role: "the founder role becomes much less individual contributor and much more orchestrator of agents—specialized AI assistants that can read files, run commands, execute code, and even browse the web." — [Playbook PDF, p6](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Three capability areas, each with a tagline: "Conversational intelligence and research" ("on-call expert for every domain"), "Agentic coding" ("the engineer who's always available, never blocked"), "Workflow automation" ("on-demand, automated ops team") — [Playbook PDF, pp6-7](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Closing claim: "The bottlenecks are no longer what you can build, but what you choose to build." — [Playbook PDF, p32](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Named roles of Claude surfaces (the "which surface" table, p11)**
- Chat: "A question, a rewrite, a quick brainstorm" — "Fast, conversational, no setup". Claude Cowork: "Research, analysis, or a finished document built from your files and systems" — "Folder access, connectors, skills, scheduled runs". Claude Code: "Writing, testing, or shipping software" — "Codebase access, diffs, git, dev environments". "The three share the same Claude underneath; what changes is the workspace around it." — [Playbook PDF, p11](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Claude Code is described as "the agentic coding environment for the engineers on your team: direct codebase access, Plan Mode, git integration, and local, IDE, or sandboxed cloud environments." — [Playbook PDF, p11](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Role shift between stages: "AI's primary role shifts from research partner to construction crew." (Idea to MVP) — [Playbook PDF, p14](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Recurring role: "Using Claude as structured devil's advocate is a core use case at every stage of the AI startup life cycle." — [Playbook PDF, p12](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Launch-stage division of labour: "When Claude Code builds the product, Claude Cowork builds the company around it, and Claude helps operationalize this product and organizational knowledge, a small team can run like a company nx its size." — [Playbook PDF, p23](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Idea stage (pp8-14)**
- Goal: "research-oriented validation: assembling solid evidence that a real problem exists (and that your proposed solution effectively addresses it) before committing resources to building." The stage "requires the discipline of not building until the evidence justifies it." — [Playbook PDF, p9](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Exit criterion: "finding problem-solution fit", as three yes/no questions: "Is the problem real and specific?", "Does your solution address the actual problem?", "Do you have enough signal to justify building?" — [Playbook PDF, p9](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Challenges: "Mistaking building for validating", "Premature scaling", "Loss of objectivity". Key quotes: "A working prototype is easy to mistake as concrete evidence that you're solving a real problem, but it's not."; "It will generate, test, debug, and refactor a codebase around a fundamentally flawed premise with exactly the same enthusiasm it brings to a great idea. The intelligence in the system is yours."; "Confirmation bias now comes with a research engine." — [Playbook PDF, p10](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Statistic: "42% of startups failed because they built something nobody wanted." The PDF gives no source for this figure — [Playbook PDF, p10](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Practices and exercises: sharpen the problem statement into a testable hypothesis; ask Claude to argue against the idea; map competitors by tier; synthesize competitor reviews; build TAM/SAM/SOM models; identify three external trends; audit interview questions (flag "leading, future-facing, too broad" ones); "After every five interviews" produce two lists of supporting and challenging evidence; build a prospect list and tracking sheet; identify "the three assumptions your design depends on most heavily" — [Playbook PDF, pp11-14](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Prototype, last step of the stage: "Define the single core interaction your solution depends on. Direct Claude Code to build only that. When you have it, put it in front of five people from your validated target profile". The prototype is "the minimum surface area needed to put your idea in front of a real human". — [Playbook PDF, p14](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**MVP stage (pp15-20)**
- Framing: "the MVP stage is still fundamentally an evidence-gathering exercise." Exit criterion: "genuine evidence of product-market fit: proof that a specific, identifiable group of users has found the product valuable enough to return to it (retention), pay for it (revenue), or tell others about it (referral)." — [Playbook PDF, p16](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Three goals: a working product real users use; "moving fast without accruing the type of technical debt that compounds"; and "investing in persistent context from day one". Quote: "Founders who skip specs, architectural decisions, and context files (like CLAUDE.md) hit a predictable wall where every new session requires re-explaining the codebase and AI-generated changes drift from the original vision." — [Playbook PDF, p16](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Challenges: "Agentic technical debt", "Falling for false product-market fit", "Zero-friction scope creep", "Insecure by inexperience". Quotes: "AI technical debt, however, compounds. Without specs and architectural constraints written down somewhere the AI can read, each session re-derives foundational decisions from scratch, and those decisions drift."; "agentic coding tools generate code that works, not code that is inherently secure."; "A security review before any user touches your app or solution is the minimum responsible threshold". — [Playbook PDF, pp16-17](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Artifact 1, architecture context: "Before Claude Code writes a line of production code, use Claude to define and document the architectural decisions that will govern everything built in this stage: the patterns to follow, the dependencies to avoid, the tradeoffs being made and why." Saved as CLAUDE.md: "This is your architectural context document: the first artifact of your build, and the one every subsequent session depends on." — [Playbook PDF, pp17-18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Artifact 2, scope document: "a scope document that describes what your MVP product does, what it deliberately does not do, and feature amendment criteria: what specific evidence from real users would justify adding something new at this point." — [Playbook PDF, p18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Session ritual: "Start each Claude Code session by (1) revisiting your scope document and (2) providing the model with your CLAUDE.md architectural context document. End each session by updating it with any decisions the session surfaced. The goal is a codebase whose structure you can explain, not just a codebase that runs." — [Playbook PDF, p18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Artifact 3, session template and log: "Create a simple session template for your Claude Code work that includes the architectural context document, the specific task for this session, and any constraints or patterns to observe. At the end of each session, add a brief log entry to the context document that details what was built, what decisions were made, and what assumptions the session introduced. Five minutes of documentation per session is cheap insurance against architectural drift". — [Playbook PDF, p18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Build stance: "treat each session as an execution of product decisions you have already made, not as an opportunity to throw in some new ones." — [Playbook PDF, p18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Security checklist (the only itemised technical checklist in the guide): "review for authentication and session handling, data exposure in API responses, input validation and injection risks, and dependencies with known vulnerabilities", "with human review for anything that touches authentication, secrets, or data handling." Claude's review "is not a substitute for security tooling, however, or, at higher stakes, a human reviewer". Claude Code Security is described as "a limited beta release" at publication. — [Playbook PDF, p18](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Metrics: "establish your measurement framework before the first user shows up"; "set your retention benchmarks, your activation criteria, and your Day 7 and Day 30 targets before releasing your MVP." False positives named: "signups without activation, revenue without retention, or initial enthusiasm without repeat usage". — [Playbook PDF, p19](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- PMF litmus tests: "The Sean Ellis test: Ask your active users: 'How would you feel if you could no longer use this product?' If more than 40% answer 'very disappointed,' that's a meaningful PMF indicator."; and "The effort test" (retention stops needing founder intervention). — [Playbook PDF, p19](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Feedback loop: Cowork drafts outreach, schedules sessions, runs "structured intake process for bug reports and feature requests", writes "a weekly synthesis"; "Keep a human in the collection loop". — [Playbook PDF, p19](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Pivot rule: "If you've completed three or more iteration cycles without meaningful movement toward your product-market fit benchmarks", run a three-question diagnostic; "Let the answers determine whether you adjust, pivot, or return to the Idea stage." — [Playbook PDF, p20](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Launch stage (pp21-24)**
- Exit criteria, three elements: "Growth is repeatable and channel-driven" with "CAC, LTV, and payback period"; "The product can handle production workloads. Infrastructure is hardened, security and compliance are in order, and reliability holds under real production conditions (not just the conditions you tested for)"; "Operations run without founder bottlenecks." — [Playbook PDF, p22](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Challenges: "Technical debt comes due", "The founder becomes the bottleneck", "Security and compliance are no longer deferrable", "Expansion before you're ready". — [Playbook PDF, pp22-23](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Tech-debt remedy: "a systematic architectural audit to identify structural weaknesses, targeted refactoring to address the worst of them, and a meaningful expansion of test coverage so that the next round of feature work doesn't reintroduce the same problems." Exercise: "Direct Claude Code to audit your MVP codebase and produce a prioritized list of structural weaknesses, test coverage gaps, and refactoring candidates." — [Playbook PDF, pp22-24](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Decision capture: "This is also the moment to document the architectural decisions you made during the MVP stage (the ones that lived in your head because there was no time to write them down). Getting them into a CLAUDE.md now ensures that every future Claude Code session starts from a shared understanding of how the system was designed and why." — [Playbook PDF, p24](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Compliance: "Use Claude Code to surface code-level issues that frequently come up in SOC 2, GDPR, or HIPAA audits"; design "the controls, audit logging, and access management that enterprise buyers will ask for"; "AI scans are an aid but not a substitute for qualified compliance review." — [Playbook PDF, p24](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Product process artifacts: "a lightweight product management operating system: a defined sprint cadence, a minimum spec template, a bug triage decision tree, and a weekly metrics brief"; and Claude should define "what a spec needs to include before Claude Code touches a feature". — [Playbook PDF, p24](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Scale stage (pp25-30)**
- Exit condition: "the company is sustainable even as the founder is, increasingly, not directly running day-to-day operations", taking the form of "sustainable profitability at a scale that no longer requires external capital, IPO-readiness, or acquisition." Moat question: "If a well-funded incumbent copied your product today, would your users stay?" — [Playbook PDF, p26](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Challenges: "Delegating the operational layer", "Scaling technical operations", "Scaling organizational functions", "Building a GTM function". — [Playbook PDF, pp26-27](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Observability and reliability (the only place they appear): "direct Claude Code to audit and harden the codebase against the specific reliability and security standards that enterprise contracts require, and to build out the technical support infrastructure ... logging, monitoring, incident response tooling, and the observability layer that makes SLAs actually enforceable." — [Playbook PDF, p28](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Tests as moat: "Identify one edge case a generic competitor would definitely get wrong in your vertical. Work with Claude Code to build a dedicated test case for it (not a unit test) based on a scenario you've actually seen. Every time a similar edge case surfaces, add it. Your test suite becomes a map of your moat." — [Playbook PDF, p29](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- Other Scale practices: bottleneck map ("what happens to each one when you're unavailable for a week"); enterprise gap analysis (documentation, SLAs, support infrastructure); GTM assets built by Claude Code ("interactive demo environments, integration documentation, sandbox tenants, API references, technical one-pagers"); skills that "codify recurring workflows"; a data feedback loop from "which outputs they accept and which they reject"; workflow lock-in via "APIs, webhooks, and SDKs". — [Playbook PDF, pp28-30](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Resources chapter**
- Links named (titles only in the text extraction): "Building AI Agents for Startups", "Claude Code docs", "Claude Code best practices", "Using CLAUDE.md files", "Claude Code power user tips" (parallel sessions and verification loops), "Get started with Claude Cowork", tutorials, founder stories (HumanLayer, Ambral, Vulcan Technologies, GC AI, Carta Healthcare, Anything, Cogent, Airtree, Duvo, Zingage, Kindora, Wordsmith), and the Anthropic Startups Program. — [Playbook PDF, pp34-35](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

**Secondary coverage**
- Search results list an Anthropic blog post with the same title at claude.com/blog/the-founders-playbook and a SuperDataScience podcast episode (SDS 1008) summarising it; a search summary reported secondary sources giving "about 35 pages" and a 14 May release date. I did not open these pages, so treat the date as unverified. — [Blog post](https://claude.com/blog/the-founders-playbook); [SDS 1008](https://superdatascience.com/1008)

### Inferences
- What the playbook covers per topic asked (my reading of the full text):
  - Specs/PRDs: yes, lightly. PRDs appear once as a document Claude can draft (p6); the concrete artifacts are the scope document (MVP) and the "minimum spec template" (Launch).
  - Prototyping: yes, explicitly bounded to "the single core interaction" and five users.
  - Evals: absent. The word does not appear. The nearest items are the Scale-stage "dedicated test case ... (not a unit test)" and the accept/reject behavioural feedback loop.
  - Testing: mentioned as something Claude Code does ("generate, test, debug, and iterate") and as "expansion of test coverage" at Launch. No TDD, no test pyramid, no CI.
  - Code review: absent as a team practice. Only security review, with human review for auth, secrets and data handling.
  - Deployment: no mechanics. "Before deploying to any real users" is a gate for the security review, nothing more.
  - Observability: one sentence at Scale (logging, monitoring, incident response, observability for SLAs).
  - Customer feedback loops: extensive, at Idea and MVP.
  - Team/agent workflows: surface selection (Chat, Cowork, Claude Code), session template, start/end-of-session ritual, skills. Parallel sessions appear only as a linked resource title.
- The playbook's stage gates are business evidence (interviews, retention, CAC/LTV), not code events. A coding-session observer can only see the build-side habits the playbook prescribes, not whether a stage has truly been exited.
- The playbook's most observer-friendly instruction is the session ritual: read scope doc and CLAUDE.md at the start, update the context document at the end. Both ends are file-path events.

### Gaps
- I did not read the web chapter pages or the blog post, so I cannot say whether they differ from the PDF.
- The PDF's hyperlink targets in the Resources chapter were not extracted (text only).
- The source of the "42%" statistic is not given in the PDF and I did not trace it.
- Exact publication date not confirmed from a primary page (PDF metadata says created 2026-05-05).

## 2. Which playbook artifacts and stage transitions are detectable from session metadata?

### Takeaway
Everything in this section is **[Inference]**: a proposed mapping from playbook practice to evidence visible in paths, tool names, command categories, test results and git operations. The playbook supplies the practices (cited in section 1); the detection rules are mine. Stage can be suggested as "build-side evidence consistent with stage X", never asserted, because the real exit criteria are off-repo.

### Cited Findings
- The playbook practices being mapped are those cited in section 1: CLAUDE.md as "the first artifact of your build"; a scope document with "feature amendment criteria"; start-of-session and end-of-session ritual; prototype limited to "the single core interaction"; security review "before deploying to any real users" covering four named areas; measurement framework "before the first user shows up"; Launch-stage audit, refactoring and "expansion of test coverage"; "minimum spec template"; Scale-stage "logging, monitoring, incident response tooling"; scenario test cases as "a map of your moat"; "APIs, webhooks, and SDKs". — [Playbook PDF](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)

### Inferences

**Proposed stage-to-evidence map (all inference).** "Needs content" means it cannot be decided from paths, counts and timings alone.

| Playbook stage | Playbook practice | Detectable evidence (metadata) | Needs content? |
|---|---|---|---|
| Idea | Research and validation before code | Sessions touching only docs paths (`docs/research/**`, `interviews/**`, `*.md`, `*.csv`), no source edits, no test runs | No (paths). Whether the docs are research needs content or a path convention |
| Idea | Lightweight prototype, "single core interaction" | Small file count, single entry point, no tests dir, no CI, no migrations, no auth/payment dependency | No |
| Idea to MVP | "first artifact of your build" | `CLAUDE.md` created or first edited; ordering relative to first source file (was context written before code?) | No |
| MVP | Scope document | A file matching `SCOPE.md`, `docs/scope*`, `PRD*`, `docs/prd/**`, `specs/**` created; read (Read tool on that path) early in a session | No for existence. Whether it has "does not do" and amendment criteria needs content |
| MVP | Architectural decisions written down | `docs/adr/**`, `docs/decisions/**`, `ARCHITECTURE.md` created or edited; count per week | No |
| MVP | Start-of-session ritual | First N tool calls of a session include Read of scope doc / CLAUDE.md (CLAUDE.md is auto-loaded, so the scope-doc read is the informative part) | No |
| MVP | End-of-session log entry | Last edits of a session include CLAUDE.md or a `docs/log*`/`CHANGELOG*`/decision file | No |
| MVP | "execution of product decisions you have already made" (scope creep) | Files touched outside the directories touched in the first third of the session; new top-level directories or new dependencies added mid-session; new route/page files not present at session start | Paths only gives a proxy. True scope-vs-task comparison needs the task text |
| MVP | Security review before users | Invocation of a security-review skill/command, or a session that only reads auth/session/API paths with no edits; dependency audit command category (`npm audit`, `pip-audit`, `cargo audit`); edits to auth/secrets paths flagged "playbook says human review" | Command category needs the command string classified in memory; store only the category |
| MVP | Measurement framework before launch | Analytics/telemetry dependency added to a manifest (name-level diff of `package.json`, `pyproject.toml`); events/metrics module created; this happening before the first deploy-category command | Manifest diff needs file content (dependency names only) |
| MVP to Launch | First real users | First deploy-category command (`vercel`, `fly deploy`, `wrangler deploy`, `git push` to a deploy remote), first `Dockerfile`/IaC file, first env/secret config, first migration against a non-local target | Command classification as above |
| Launch | Architectural audit and remediation | Read-heavy sessions spanning many directories with few edits (audit), followed by sessions with high edit count and zero new feature paths (refactor); test file count and test id count rising faster than source file count | No |
| Launch | "expansion of test coverage" | Test ids added per session; ratio of sessions that touch a source file and also run a test that plausibly covers it; coverage command run | Coverage percent needs tool output |
| Launch | "minimum spec template" before a feature | A spec file created/edited before the first source edit on a branch; branch name or commit trailer referencing a spec id | Commit message text needed for trailers |
| Launch | Hardened infrastructure, compliance | CI config added (`.github/workflows/**`), lint/type-check commands run, lockfile committed, rate-limit/audit-log modules, `SECURITY.md`, policy docs | No |
| Scale | Logging, monitoring, incident response | Observability dependency added (OpenTelemetry, Sentry and similar), `runbooks/**`, alert config, SLO files | Manifest names |
| Scale | Scenario tests as moat | Tests under `e2e/`, `scenarios/`, `regression/` growing; test ids that persist and stay green across many sessions | No |
| Scale | APIs, webhooks, SDKs | `openapi.*`, `*.proto`, `sdk/**`, webhook handler paths; API schema file diffs | Surface diff needs file content |

**Proposed views built on this map (inference).**
- "Playbook habits" checklist per session: context read at start, scope doc consulted, decisions written at end, security-sensitive paths touched, tests run after last edit. Each item is a yes/no derived from path and ordering.
- "Stage evidence" strip per repo: which of the rows above have ever been observed, with first-seen date. Label it evidence, not stage.
- "Scope drift" meter: new directories, new dependencies and new entry points introduced after the session's first third. It teaches the playbook's "zero-friction scope creep" point without reading the prompt.
- "Context legibility" trend: edits to CLAUDE.md, ADRs and scope docs per N source edits. It teaches the "agentic technical debt" argument.

**Limits.**
- A passive observer that stores no message text cannot tell what the stated task was, so "scope of change vs stated task" is only a proxy unless the user supplies a path-level scope (for example a scope file listing directories) or the observer keeps a hash or category only.
- Bash command strings are tool input. Classifying them (deploy, migrate, test, audit, git) in memory and storing only the category and timing keeps to the metadata-only rule; storing the string would not.

### Gaps
- No published source maps playbook stages to repository signals; I found none and did not search specifically for one beyond the playbook itself.
- Path conventions for scope docs and specs vary by team; the patterns above are illustrative, not from a standard.

## 3. Systems design: which established frameworks give a learner a map of a system from repo and session metadata?

### Takeaway
Behavioural code analysis (hotspots, change coupling, sum of coupling, code age) is the best fit for a metadata-only observer because its only input is who-changed-what-when, which a session already has per turn. C4, ADRs, DORA and the test pyramid give the vocabulary for the views; import graphs and API diffs need file contents.

### Cited Findings

**C4 model**
- C4 is "an easy to learn, developer friendly approach to software architecture diagramming"; it has four hierarchical abstractions (software systems, containers, components, code) with matching diagrams (system context, container, component, code), plus supporting diagrams (system landscape, dynamic, deployment). It is notation and tooling independent. — [c4model.com](https://c4model.com/)
- "A container is essentially a runtime boundary around some code that is being executed or some data that is being stored." Examples include server-side web apps, client-side web apps, console apps, serverless functions, databases, blob stores, file systems and "single shell scripts". A container is a runtime construct, distinct from code-organising units such as JARs or modules, and the term does not mean Docker. — [c4model.com, Container](https://c4model.com/abstractions/container)

**Architecture decision records**
- An architectural decision is "a justified design choice that addresses a functional or non-functional requirement that is architecturally significant." An ADR captures one decision with its rationale, trade-offs and consequences; the set of ADRs in a project "constitute its decision log". Michael Nygard's 2011 post "Documenting Architecture Decisions" popularised the concept. — [adr.github.io](https://adr.github.io/)

**Behavioural code analysis (Tornhill): hotspots, change coupling, sum of coupling, age**
- code-maat analyses, selected with `-a`: `abs-churn`, `age`, `author-churn`, `authors` (default), `communication`, `coupling`, `entity-churn`, `entity-effort`, `entity-ownership`, `fragmentation`, `identity`, `main-dev`, `main-dev-by-revs`, `messages`, `refactoring-main-dev`, `revisions`, `soc`, `summary`. — [code-maat README](https://raw.githubusercontent.com/adamtornhill/code-maat/master/README.md)
- Input is a git log. Recommended format: `git log --all --numstat --date=short --pretty=format:'--%h--%ad--%aN' --no-renames --after=YYYY-MM-DD`. Output columns: coupling gives `entity, coupled, degree, average-revs`; age gives `entity, age-months`; abs-churn gives `date, added, deleted`; authors gives `entity, n-authors, n-revs`. — [code-maat README](https://raw.githubusercontent.com/adamtornhill/code-maat/master/README.md)
- Sum of coupling: a count of how many times a module has been coupled to another in a commit; its purpose is to identify architecturally significant modules. — [CodeScene change coupling docs](https://codescene.io/docs/guides/technical/change-coupling.html); [Your Code as a Crime Scene, "Use Sum of Coupling to Determine Architectural Significance"](https://www.oreilly.com/library/view/your-code-as/9798888650837/f_0066.xhtml)
- Hotspots: "Most development activity tends to be located in relatively few modules." CodeScene looks for "files with high change frequency and low Code Health". Its dashboard example shows prioritised hotspots at 1.2% of the codebase, 12.5% of development effort and 45% of detected bugs (a vendor example, not a general law). — [CodeScene hotspots docs](https://codescene.io/docs/guides/technical/hotspots.html)
- A worked walkthrough runs code-maat with `-a soc` and then `-a coupling` on a git log. — [Stefan Boos, Applied Forensics: Temporal Coupling](https://wonderbird.github.io/2022/04/01/applied-forensics-temporal-coupling.html)

**DORA**
- DORA now has five software delivery metrics. Throughput: change lead time ("The amount of time it takes for a change to go from committed to version control to deployed in production"), deployment frequency, failed deployment recovery time. Instability: change fail rate ("The ratio of deployments that require immediate intervention following a deployment") and deployment rework rate ("The ratio of deployments that are unplanned but happen as a result of an incident in production"). Failed deployment recovery time replaced MTTR. — [dora.dev metrics guide](https://dora.dev/guides/dora-metrics/)

**Test pyramid**
- "The 'Test Pyramid' is a metaphor that tells us to group software tests into buckets of different granularity." Cohn's layers are unit, service, UI. Two rules: "Write tests with different granularity" and "The more high-level you get the fewer tests you should have". The inverse is a "test ice-cream cone". — [Ham Vocke, The Practical Test Pyramid, martinfowler.com, 2018](https://martinfowler.com/articles/practical-test-pyramid.html)

**Dependency graphs**
- dependency-cruiser analyses JS/TS source files, validates dependencies against rules (including a predefined no-circular rule) and outputs html, json, dot or text. — [dependency-cruiser README](https://raw.githubusercontent.com/sverweij/dependency-cruiser/main/README.md)

### Inferences

**Framework to observer view (all inference).**

| Framework | Inputs it needs | From session metadata alone? | What a view would teach |
|---|---|---|---|
| Change coupling | Sets of files changed together | Yes. A turn or a session is a finer "commit" than git: files edited in the same turn are co-changed | "These two files always move together": hidden dependencies, where an abstraction is missing |
| Sum of coupling | Same | Yes | Which file is the architectural hub of this session or repo |
| Hotspots | Change frequency per file; a complexity proxy | Frequency: yes. Complexity proxy: line count from `wc -l` is content-derived but is a number, not text | Where the agent (and the learner's attention) keeps returning |
| Code age | Last-change time per file | Yes | Stable core vs volatile edge |
| Read/edit ratio per file | Read and Edit tool events by path | Yes, and unique to agent sessions (git cannot see reads) | What the agent had to understand to change X: a de facto dependency list |
| C4 container sketch | Runtime units and data stores | Partly. Candidates from paths and manifests: `Dockerfile`, `docker-compose.yml` service count, `apps/*`, `packages/*`, `*.duckdb`, `migrations/`, serverless function dirs | "What runs, and what stores data" as a list of candidate containers, labelled as guesses |
| C4 component level | Modules and their relationships | Needs import parsing (content) | Skip, or delegate to dependency-cruiser/madge output if the agent runs them |
| ADR timeline | ADR files with dates | Yes (paths, timestamps); status and titles need content (filename slug gives a title) | Decisions in order, next to the code churn that followed each |
| DORA, session-scale analogue | Commit, deploy and failure events | Partly: commit time and deploy-category command time give a local "lead time"; failures after deploy are off-session | The idea of lead time and rework, without pretending to be org-level DORA |
| Test pyramid shape | Test counts by level | Yes if level is inferred from path (`unit/`, `integration/`, `e2e/`) or runner (vitest vs playwright) | Whether the suite is a pyramid or an ice-cream cone, and which level the agent adds to |
| Twelve-factor checks | Config, deps, logs, processes | Partly: `.env*` presence and whether tracked, lockfile present, config in env vs files | Presence checks only |
| API surface diff | Schema files | Path-level "API surface touched" yes (`openapi.*`, `*.proto`, `schema.graphql`, route dirs); the diff needs content | When a change crosses a public boundary |
| Boundary crossing | Directory to layer mapping | Yes with a user-supplied or guessed layer map | Each turn drawn as which layers it touched (UI, API, domain, data) |

- The session gives a signal git history cannot: read-before-write sets. A "blast radius" view (files read vs files edited per turn) is a cheap learner-facing approximation of a dependency graph and needs no parsing.
- Change coupling at turn granularity will be noisier than at commit granularity (code-maat's README has options for thresholds such as minimum revisions; I did not confirm their names). A view should require a minimum co-change count before drawing an edge.
- CodeScene's 1.2% / 12.5% / 45% figures are a product-dashboard example; cite them as illustration only.

### Gaps
- Structurizr, madge, pydeps, git-of-theseus, CodeScene pricing/licensing and the twelve-factor text were not fetched this session; my search returned nothing citable for them. From background knowledge only (unverified here): Structurizr is the C4 author's diagrams-as-code tooling; madge builds JS module graphs with circular-dependency detection; pydeps draws Python import graphs; git-of-theseus plots code survival and cohort composition from git history; twelve-factor is at 12factor.net.
- The c4model.com pages fetched do not say anything about generating diagrams from code or repositories.
- adr.github.io as fetched did not give file naming or directory conventions (MADR, adr-tools, log4brains were not described on the page returned).
- I did not find the exact "churn × complexity" formula in a primary source this session; the CodeScene docs describe change frequency combined with Code Health instead of lines of code. Tornhill's book (lines of code as the complexity proxy) was not opened.
- No source found on applying change coupling to agent turns specifically.

## 4. Database systems / DuckDB: what would a learner want surfaced on a DuckDB-backed project?

### Takeaway
DuckDB's profiling output is structured and stable enough to be a teaching surface: per-operator timing, rows scanned and row groups scanned vs available come out as JSON, and plans can be emitted as text, JSON, Graphviz, HTML or Mermaid. The documented concurrency model (one read-write process, or many read-only) is the single most useful "fact card" for a learner, and current docs (labelled 2.0) add a client-server path for multi-process writes. Most of the valuable signals here need tool output, which a metadata-only observer does not keep; what is reachable from metadata is the timeline of schema, migration, extension and file-format events.

### Cited Findings

**Version context**
- duckdb.org "stable" documentation URLs redirect to `/docs/2.0/` as of this research date, so the current documented release line is 2.0. — [DuckDB profiling docs](https://duckdb.org/docs/2.0/dev/profiling.html)

**EXPLAIN and profiling**
- Settings: `enable_profiling` (alias `enable_profile`) with options `query_tree`, `json`, `query_tree_optimizer`, `no_output`; `profiling_coverage` (`SELECT` or `ALL`); `profiling_output` (file path); `profiling_mode` is deprecated and "has no effect"; `tracked_metrics` (default `['*']`, glob patterns such as `['query.*', 'optimizer.*']`) replaces the older `custom_profiling_settings` PRAGMA. An `enable_profiling()` table function exists from DuckDB 1.5.0 with `metrics`, `mode`, `save_location`, `coverage`, `format`. — [DuckDB profiling docs](https://duckdb.org/docs/2.0/dev/profiling.html)
- Plan formats: `EXPLAIN (FORMAT ...)` supports `text`, `graphviz`, `html`, `json`, `mermaid`, and `web` (CLI only). `EXPLAIN ANALYZE (FORMAT WEB)` opens the query graph in a browser. `python -m duckdb.query_graph file.json` renders a JSON profile to HTML: "The query plan must be output in the `json` format and stored in a file." The docs also recommend the University of Tübingen execution plan visualizer. — [DuckDB profiling docs](https://duckdb.org/docs/2.0/dev/profiling.html)
- Metric names (2.0 naming, grouped by prefix). Query: `query.cpu_time`, `query.sql`, `query.total_intermediate_rows`, `query.total_intermediate_size_bytes`, `query.total_row_groups_scanned`, `query.total_row_groups_to_scan`, `query.total_rows_scanned`, `query.total_time`. System: `system.blocked_thread_time`, `system.peak_buffer_memory`, `system.peak_streaming_buffer_size`, `system.peak_temp_dir_size`, `system.total_memory_allocated`. IO: `io.total_bytes_read`, `io.total_bytes_written`. Storage: `storage.attach_load_storage_latency`, `storage.attach_replay_wal_latency`, `storage.checkpoint_latency`, `storage.commit_local_storage_latency`, `storage.total_vacuum_time`, `storage.waiting_to_attach_latency`, `storage.wal_replay_entry_count`, `storage.write_to_wal_latency`. Operator: `operator.cpu_time`, `operator.extra_info`, `operator.intermediate_rows`, `operator.intermediate_size_bytes`, `operator.row_groups_scanned`, `operator.rows_scanned`, `operator.timing`, `operator.total_row_groups_to_scan`, `operator.type`. Optimizer: `optimizer.total_time` and one per optimizer (for example `optimizer.filter_pushdown`, `optimizer.join_order`). Parser: `parser.total_time`. Planner: `planner.binding_time`, `planner.total_time`. Physical planner: `physical_planner.column_binding`, `physical_planner.create_plan`, `physical_planner.resolve_types`, `physical_planner.total_time`. — [DuckDB metrics docs](https://duckdb.org/docs/2.0/dev/metrics.html)
- The available metrics for an installed build can be listed with `SELECT metric_name, metric_type, unit FROM duckdb_available_metrics();`. — [DuckDB profiling docs](https://duckdb.org/docs/2.0/dev/profiling.html)
- Earlier versions (1.4 and before) used different, upper-case metric names such as `LATENCY`, `ROWS_RETURNED` and `OPERATOR_TIMING`; the 1.5 `enable_profiling()` examples still list 'QUERY_NAME', 'LATENCY', 'OPERATOR_TIMING'. Names are version-dependent. — [DuckDB 1.4 profiling docs](https://duckdb.org/docs/1.4/dev/profiling); [DuckDB 1.5 profiling docs](https://duckdb.org/docs/1.5/dev/profiling)

**Concurrency**
- Two modes: "Read-write mode: one process can both read and write to the database." and "Read-only mode: multiple processes can read from the database, but no processes can write." — [DuckDB concurrency docs](https://duckdb.org/docs/2.0/connect/concurrency.html)
- Within the one writer process, multiple writer threads are supported using MVCC and optimistic concurrency control. "Appends will never conflict, even on the same table." "Multiple threads can also simultaneously update separate tables or separate subsets of the same table." When two threads edit the same row, "the second thread to attempt the edit will fail with a conflict error." Documented workaround: "rerun the transaction." — [DuckDB concurrency docs](https://duckdb.org/docs/2.0/connect/concurrency.html)
- Multi-process writes: "Writing to DuckDB's native database format from multiple processes is supported through the Quack remote protocol", which makes DuckDB a client-server database; the alternative named is DuckLake with PostgreSQL as the catalog. — [DuckDB concurrency docs](https://duckdb.org/docs/2.0/connect/concurrency.html)

**Node client**
- The current Node client is "Node.js (Neo)", package `@duckdb/node-api`; the older `duckdb` npm package is deprecated and will not be released for DuckDB 1.5+. Supported platforms listed: linux_amd64, linux_arm64, osx_amd64, osx_arm64, windows_amd64. — [DuckDB Node.js (Neo) docs](https://duckdb.org/docs/2.0/clients/node_neo/overview)

### Inferences

**Learner-facing signals, with the metadata question answered for each (all inference).**

| Signal | Source | Metadata-only? | Teaches |
|---|---|---|---|
| Schema and migration timeline | Paths: `migrations/**`, `*.sql`, `schema.sql`, `models/**` (dbt/SQLMesh), `atlas.hcl`; create/edit timestamps | Yes | How the data model evolved, and which code edits followed each migration |
| "Who touched the database file" | Bash command category (`duckdb <file>`), `.duckdb`/`.db`/`.wal` paths appearing | Yes (category and path) | Single-writer model: flag two processes opening the same file read-write, or a `.wal` file left behind |
| Lock/conflict incidents | Tool-result error class ("Transaction conflict", "Could not set lock on file") | Needs output matching; store only an error-class enum and count | Why a second process cannot write; optimistic concurrency |
| Plan capture count | Command classification: contains `EXPLAIN` / `EXPLAIN ANALYZE` | Category only | Whether the agent measured before optimising |
| Plan content: operator tree, `operator.timing`, `operator.rows_scanned`, `operator.row_groups_scanned` vs `operator.total_row_groups_to_scan` | Profiling JSON written to a file via `profiling_output` | No. Needs the file. But the numbers are metadata-like (operator types and counts, not row data); `query.sql` would have to be dropped | Filter/projection pushdown, zone-map skipping (row groups scanned vs available), join order |
| Query count and timings | Bash/MCP tool call durations for duckdb-category commands | Yes (wall-clock per call, not per query) | Rough cost of each query step |
| Storage/format choices | Paths and extensions: `*.parquet`, `*.csv`, `*.json`, `*.duckdb`, `ducklake:` attach, Iceberg metadata dirs | Yes for files; attach strings need command content | Native file vs Parquet vs lakehouse catalog trade-offs |
| Extensions loaded | `INSTALL x` / `LOAD x` in commands or SQL files | Needs command or file content, reducible to a name list | What each extension adds (httpfs, json, spatial, ui, community extensions) |
| Index and constraint changes | DDL in migration files | Needs content, reducible to counts by DDL kind | When DuckDB indexes help (point lookups, constraints) vs zone maps |
| Memory/spill | `system.peak_buffer_memory`, `system.peak_temp_dir_size` from profile JSON | Needs the file | Out-of-core execution |

- A "plan card" could be produced without reading SQL text by keeping only `operator.type`, `operator.timing`, rows and row-group counts from the profile JSON and discarding `query.sql` and `operator.extra_info` (which can contain filter expressions and table names). Whether that fits the metadata-only rule is a decision for the maintainer.
- Because metric names changed between 1.4 (`LATENCY`, `OPERATOR_TIMING`) and 2.0 (`query.total_time`, `operator.timing`), any parser should key on `duckdb_available_metrics()` or accept both.
- The concurrency page gives a ready-made "fact card": one read-write process or many read-only; appends never conflict; same-row edits raise a conflict; multi-process writes need the remote protocol or DuckLake.

### Gaps
- Not fetched or verified this session, so no claims made: DuckDB UI features (the stable URL redirects to `https://duckdb.org/docs/2.0/core_extensions/ui.html`, which I did not open), Harlequin, dbt docs/lineage, sqlglot lineage, SQLMesh, Atlas schema diffs, the Tübingen plan visualizer's URL and features, DuckLake and Iceberg specifics, DuckDB index/constraint documentation, and a list of documented common pitfalls.
- "Quack remote protocol" appears in the 2.0 concurrency page as summarised by the fetch tool; I did not open a dedicated page for it, so its maturity and release status are unconfirmed.
- I did not retrieve an example of the JSON profile document itself (its nesting, `children` arrays), only the metric names.
- DuckDB 2.0's release date and changelog were not checked.

## 5. How well does DuckDB suit analysing agent session logs themselves?

### Takeaway
Well, and it is already an established pattern: there is a DuckDB community extension for agent history, at least three packaged tools that put DuckDB over `~/.claude/projects/*/*.jsonl`, and a published article with cost queries. The recurring technical point is that transcript records are heterogeneous, so tools either load raw JSON objects per line or keep nested content as JSON and flatten at query time.

### Cited Findings
- `read_json(filename)` infers columns and types and accepts a file, a list or a glob (`read_json_auto` is an alias). `read_ndjson` is `read_json` with `format` set to `newline_delimited`. `read_json_objects` returns each top-level object as a single `json` column; `read_ndjson_objects` is its newline-delimited form. — [DuckDB JSON loading docs](https://duckdb.org/docs/2.0/data/json/loading_json.html)
- Parameters relevant to heterogeneous logs: `union_by_name` ("Whether the schemas of multiple JSON files should be unified", default false); `ignore_errors` (only with newline-delimited format); `maximum_object_size` (default 16777216 bytes); `sample_size` (default 20480, "Set to -1 to scan the entire input file"); `columns` (listing only some keys excludes the rest); `records`; `maximum_depth`; `filename` is a virtual column since DuckDB 1.3.0. — [DuckDB JSON loading docs](https://duckdb.org/docs/2.0/data/json/loading_json.html)
- `agent_data` is a DuckDB community extension (Rust) for querying AI coding agent history. Table functions: `read_conversations`, `read_plans`, `read_todos`, `read_history`, `read_stats`, `read_events`. Supported sources listed: Claude Code (`~/.claude`), Claude Desktop, GitHub Copilot CLI, Cursor, OpenAI Codex, Gemini CLI, xAI Grok. Install: `INSTALL agent_data FROM community; LOAD agent_data;`. Repo: github.com/axsaucedo/agent_data_duckdb. — [agent_data extension page](https://duckdb.org/community_extensions/extensions/agent_data.html)
- Published example queries from that page:
  ```sql
  SELECT COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS total_messages
  FROM read_conversations();

  SELECT tool_name, COUNT(*) AS uses
  FROM read_conversations('~/.copilot')
  WHERE tool_name IS NOT NULL
  GROUP BY tool_name ORDER BY uses DESC LIMIT 10;

  SELECT date, message_count, tool_call_count
  FROM read_stats() ORDER BY date DESC LIMIT 7;
  ```
  — [agent_data extension page](https://duckdb.org/community_extensions/extensions/agent_data.html)
- `claude-sql` (PyPI, version 2.1.1 released 2026-08-20, Python 3.13+, Apache-2.0): "Zero-copy SQL + semantic search + LLM analytics over ~/.claude/ transcripts." DuckDB reads the JSONL in place with `read_json`; raw views, then business views, then macros; nested message content stays JSON and is flattened at query time. Views include `sessions`, `messages`, `content_blocks`, `tool_calls`, `tool_results`, `todo_events`, `subagent_spawns`, `skill_invocations`, `user_friction`. Example: `claude-sql query "SELECT * FROM friction_counts(14)"`. — [claude-sql on PyPI](https://pypi.org/project/claude-sql/)
- `ccq` (PyPI) runs DuckDB over the same path but, per a search summary, loads each line as a raw JSON value with `read_ndjson_objects` because the records are heterogeneous, and treats transcripts as read-only. The PyPI page itself failed to load for me, so this is from the search result summary only. — [ccq on PyPI](https://pypi.org/project/ccq/)
- `ccql` is a Rust crate offering SQL over Claude Code data (versions 0.1.2 to 0.5.0 on docs.rs, with a `datasources/transcript.rs` module). I did not open its README. — [ccql on docs.rs](https://docs.rs/crate/ccql/0.5.0)
- A Zenn article by "trysmr" (published 2025-05-31, updated 2025-06-03) queries `read_json('~/.claude/projects/*/*.jsonl')` directly: six queries totalling `costUSD` and input/output tokens overall, by project (last segment of `cwd`) and `message.model`, and by date (timestamp shifted to JST), using `ROLLUP` and grouping sets, excluding the `<synthetic>` model. It also pipes `duckdb -c "..."` output into `claude -p`. The article notes `costUSD` stopped appearing in the JSONL after Claude Code 1.0.6, so cost queries no longer work as written. — [Zenn: claude-max-duckdb](https://zenn.dev/trysmr/articles/claude-max-duckdb)
- For a Node-based plugin, the supported native binding is `@duckdb/node-api` on linux/macOS/windows amd64 and arm64 (no windows_arm64 listed). — [DuckDB Node.js (Neo) docs](https://duckdb.org/docs/2.0/clients/node_neo/overview)

### Inferences
- A query shape that fits the documented reader functions and a metadata-only rule: read lines as raw objects, then extract only the fields wanted, so message text never becomes a column.
  ```sql
  -- [Inference] illustrative, not from a published source; field names must be checked against real transcripts
  SELECT json_extract_string(json, '$.sessionId')  AS session_id,
         json_extract_string(json, '$.type')       AS record_type,
         json_extract_string(json, '$.timestamp')  AS ts
  FROM read_ndjson_objects('~/.claude/projects/*/*.jsonl');
  ```
- For this kind of plugin DuckDB is better as an optional offline "notebook" over the plugin's own metadata store (or exported Parquet) than as an in-session dependency: a native binding adds install weight and platform limits, and the plugin's live views do not need an analytical engine.
- It doubles as a learning exercise for the requester's DuckDB study: run `EXPLAIN ANALYZE` on a query over one's own session metadata and read the operator metrics from section 4.
- Existing tools (claude-sql, agent_data) read message content. A metadata-only variant is a differentiator, not a duplicate.
- The Zenn article's `costUSD` breakage is a concrete precedent that transcript fields are not a stable interface.

### Gaps
- DuckDB-WASM: I found no primary-source detail this session on its threading, memory limits or suitability inside a plugin pane. Not assessed.
- The ccq PyPI page did not load; details come from a search summary and should be re-checked.
- I did not verify that any of these tools handle the current Claude Code transcript format, or the column lists of `agent_data` (the page shows only some columns).
- No benchmark found for DuckDB over large transcript directories.

## 6. End-to-end product development: which lightweight measures of "how it is getting built" could be tracked per session or repo?

### Takeaway
DORA's five metrics and SPACE's five dimensions supply the vocabulary; both are team and deployment scale, so a session observer should present session-scale analogues and say so. The measures that fall out of session metadata with no content are time-to-green, rework (re-edits of the same file, red-after-green), test-after-last-edit, and commit hygiene.

### Cited Findings
- DORA's five metrics and definitions (change lead time, deployment frequency, failed deployment recovery time, change fail rate, deployment rework rate), grouped as throughput and instability. — [dora.dev metrics guide](https://dora.dev/guides/dora-metrics/)
- SPACE (Forsgren, Storey, Maddila, Zimmermann, Houck, Butler; ACM Queue 2021) names five dimensions: satisfaction and well-being, performance, activity, communication and collaboration, efficiency and flow. Its premise is that productivity cannot be reduced to one number; GitHub's summary recommends using at least three dimensions, and calls activity the most ubiquitous and most misused measure. — [ACM Queue: The SPACE of Developer Productivity](https://queue.acm.org/detail.cfm?id=3454124); [GitHub blog summary](https://github.blog/news-insights/research/measuring-enterprise-developer-productivity/)
- A 2025 arXiv paper using SPACE on GenAI adoption notes that high activity without matching performance gains may indicate redistributed, not reduced, effort. I saw this only in a search summary. — [arXiv 2510.24265](https://arxiv.org/pdf/2510.24265)
- The playbook's own build-process measures are qualitative: "a codebase whose structure you can explain, not just a codebase that runs"; "Five minutes of documentation per session"; "expansion of test coverage"; "what a spec needs to include before Claude Code touches a feature". It gives no engineering throughput metric. — [Playbook PDF, pp18, 22, 24](https://assets.claude.com/503ee04b4aa55a4db49a69b993463b6fa8dad6d8.pdf)
- The test pyramid's rule "The more high-level you get the fewer tests you should have" gives a shape check for a test ledger. — [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

### Inferences

**Proposed per-session and per-repo measures (all inference).**

| Measure | Definition from session metadata | Framework it echoes | Needs content? |
|---|---|---|---|
| Time to green | First edit timestamp to first all-green test run after the last edit | DORA change lead time, at session scale | No |
| Red-to-green cycles | Count of fail-then-pass transitions per test id | TDD loop; SPACE efficiency and flow | No |
| Rework rate | Share of edits that re-edit a file already edited in the session after a test run; or files edited in 3+ separate turns | DORA deployment rework rate (analogue only) | No |
| Regression count | Test ids that go green to red within a session | DORA change fail rate (analogue only) | No |
| Verified-change proportion | Share of edited source files with a test run after their last edit; stricter: with a test file in the same module touched or run | Test coverage hygiene | No (path heuristics) |
| Unverified tail | Edits made after the final test run of the session | Same | No |
| Change footprint | Files and directories touched, new files, new dependencies, new top-level dirs | Scope control (playbook "zero-friction scope creep") | No |
| Scope vs stated task | Footprint compared with the task | Spec-to-code traceability | Yes: needs task text, or a user-declared path scope |
| Commit hygiene | Commits per session, files per commit, time between last green and commit, commits made while red, branch-before-edit | Review and commit practice | No. Conventional-commit check needs the message's first token |
| Spec-to-code traceability | Spec/ADR path edited or read in the same session or branch as the source change; branch name carries an issue id | Playbook "minimum spec template" | Branch name is metadata; commit trailers need message text |
| Context upkeep | CLAUDE.md, ADR, scope-doc edits per session; "decision written at end" yes/no | Playbook session log | No |
| Deploy cadence | Deploy-category commands over time; time from commit to deploy command | DORA deployment frequency and lead time | Command category |
| Activity | Tool calls, edits, turns | SPACE activity (flag as the easiest to misread) | No |
| Flow | Longest uninterrupted run, number of human interruptions, compactions | SPACE efficiency and flow | No |

- SPACE's warning applies directly: showing activity counts alone would mislead a learner. Pair each activity number with a performance one (for example edits alongside time-to-green or regression count).
- Satisfaction and communication dimensions are not observable passively; a view should say so instead of inventing a proxy.
- Session-scale analogues of DORA are teaching devices. DORA's definitions are about production deployments, so the labels should read "session lead time" and similar, not "DORA lead time".

### Gaps
- I found no published, validated definition of "rework rate" or "cycle time to green" for agent coding sessions; the definitions above are mine.
- The ACM Queue article and the arXiv paper were not opened; SPACE details come from search summaries of those pages and GitHub's blog.
- No source checked on how commercial tools (for example engineering-analytics products) define rework or churn; vendor definitions vary and were out of budget.
