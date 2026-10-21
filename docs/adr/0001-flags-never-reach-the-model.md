---
status: accepted
---

# Flags never reach the model

Field Guide shows its flags (Unverified edit, Ended red, Test changed to pass) only to the developer and never adds them to the model's context, even though telling Claude would often get the problem fixed at once. A detector the agent can see stops being independent: an agent told about Ended red learns that not running the tests avoids it, and the flag turns into Unverified edit. The new developer would also never see what the agent would have shipped, which is the lesson. A turn-end flag instead shows as a toast and stays in the band until acknowledged, and the developer can send it to the agent as their own visible prompt.

## Considered Options

- Add flags to the model's context after the tool result, so the agent corrects itself. Rejected for the reasons above, and because it makes a teaching tool into a guardrail.
- Add them only on opt-in. Deferred to v2 as an open question; if it is added, it must stay off by default.
