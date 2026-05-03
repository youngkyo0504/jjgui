---
active: true
iteration: 1
max_iterations: 30
topic: "operation을 갔다가 오면 ui 레이아웃이 깨져요. 왜그런가요"
started_at: "2026-05-03T23:16:23Z"
---

당신은 interview-ralph 루프 안에 있다. 목적은 단 하나: 아래 주제를 `interview` 스킬로 grilling 하고, 모든 리스크가 진짜 해소될 때까지 멈추지 않는 것이다.

주제: operation을 갔다가 오면 ui 레이아웃이 깨져요. 왜그런가요

[절차]

0. **선결조건 — AskUserQuestion schema 로드**: 이 환경에서 `AskUserQuestion` 은 deferred 툴이다. 직접 `/interview` 호출 경로에서는 자동 로드되지만, Skill 툴을 통해 부르는 ralph 경로에서는 로드되지 않는다. 이 세션에서 아직 로드한 적이 없으면 다음을 한 번 호출한다 (이미 로드됐으면 생략):

   ```
   ToolSearch(query="select:AskUserQuestion", max_results=1)
   ```

1. Skill 툴로 `skill="interview"` 를 호출한다. args 는 다음을 그대로 넘긴다:

   ```
   주제: operation을 갔다가 오면 ui 레이아웃이 깨져요. 왜그런가요

   [interview-ralph 컨텍스트]
   이전 iteration 의 결과는 이 conversation 의 직전 turn 들에 그대로 남아 있다. 누적된 리스크를 우선 grilling 한다.

   지시:
   - Phase 1~4 를 건너뛰지 않는다.
   - 누적된 리스크를 mitigated / decided / out-of-scope 중 하나로 처리한다.
   - 새 가정 · 반례 · 엣지케이스를 최소 2개 발굴한다.
   - 코드 변경은 하지 않는다.
   ```

2. **종료 판정**: 다음 모두 진짜 만족할 때만 종료할 수 있다.
   - 모든 리스크가 (mitigated) / (decided) / (out of scope) 중 하나로 명시 레이블링.
   - (carried over) 가 단 하나도 없음.
   - 직전 iteration 누적 리스크 중 이번에 다뤄지지 않고 사라진 항목 없음.
   - 이번 iteration 에서 새 가정 · 반례 ≥ 1개 발굴됨.

   판정이 모호하면 보수적으로 "남아 있음" 으로 본다.

3. **출력**:
   - **종료 가능**: 답변의 마지막 줄에 정확히 `RISKS_CLEARED` 를 단독으로 출력 (앞뒤 다른 문자 없이). 거짓말 금지.
   - **종료 불가**: 답변을 그냥 끝낸다. Stop hook 이 같은 프롬프트를 자동 재주입한다.

4. **금지**:
   - 거짓 RISKS_CLEARED 출력 금지.
   - max_iterations 우회 위해 `.claude/interview-ralph.local.md` 직접 수정 금지.
   - 사용자가 `/cancel-interview-ralph` 실행 전까지 임의로 멈추지 않는다.

지금 시작한다.
