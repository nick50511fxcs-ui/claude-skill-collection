---
name: task
description: Shortcut that turns on task-observer. Type /task, or /task <request> to also run a request.
disable-model-invocation: true
argument-hint: "[request to run after activation (optional)]"
---

Invoke the `task-observer` skill now and execute its Session Start Protocol
(loading the skill alone is not activation). Keep observing for the rest of
this session.

If text follows the command, treat it as the user's actual request and carry
it out after the protocol:

$ARGUMENTS
