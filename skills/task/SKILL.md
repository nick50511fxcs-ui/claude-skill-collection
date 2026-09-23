---
name: task
description: task-observer 단축 명령. /task 로 태스크 옵저버를 켭니다.
disable-model-invocation: true
argument-hint: "[이어서 할 작업 (선택)]"
---

Invoke the `task-observer` skill now and execute its Session Start Protocol
(loading the skill alone is not activation). Keep observing for the rest of
this session.

If text follows the command, treat it as the user's actual request and carry
it out after the protocol:

$ARGUMENTS
