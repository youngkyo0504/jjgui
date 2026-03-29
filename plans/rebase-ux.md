# Plan: Rebase UX

> Source PRD: `docs/PRD-rebase-ux.md`

## Architectural decisions

- **API 패턴**: 기존 `POST /api/edit` 패턴을 따른다. `cwd` query param + JSON body
- **새 엔드포인트**:
  - `POST /api/rebase?cwd=...` — body: `{ sourceChangeId, destinationChangeId, mode }`
  - `POST /api/undo?cwd=...` — body 없음
- **Rebase 모드**: 백엔드의 `mode` 파라미터는 `'source' | 'revision' | 'branch'`를 지원하되, UI는 Phase 1에서 `'source'`만 사용
- **데이터 모델**: 기존 `CommitInfo.parents` 필드를 활용하여 클라이언트에서 children 맵을 계산. 서버 응답 형태는 변경하지 않음
- **상태 관리**: App.tsx에서 rebase 상태를 관리하고 props로 하위 컴포넌트에 전달 (기존 패턴 유지)

---

## Phase 1: 백엔드 API + descendants 유틸리티

**User stories**: rebase 실행, undo 실행

### What to build

서버에 rebase/undo jj 명령 실행 함수와 API 엔드포인트를 추가한다. 클라이언트에 parent→children 역방향 맵을 구축하고 특정 커밋의 모든 descendants를 계산하는 유틸리티를 구현한다. 이 phase가 끝나면 curl로 rebase/undo API를 호출할 수 있고, 유틸리티 함수의 정확성을 단위 테스트로 검증할 수 있다.

### Acceptance criteria

- [ ] `POST /api/rebase?cwd=...`에 `{ sourceChangeId, destinationChangeId, mode: "source" }`를 보내면 `jj rebase -s <source> -d <dest>`가 실행되고 `{ ok: true }`를 반환한다
- [ ] `POST /api/undo?cwd=...`를 호출하면 `jj undo`가 실행되고 `{ ok: true }`를 반환한다
- [ ] jj 명령 실패 시 HTTP 500 + `{ error: string }`을 반환한다
- [ ] `buildChildrenMap(rows)` — GraphRow 배열에서 parent→children 맵을 반환한다
- [ ] `getDescendants(changeId, childrenMap)` — 특정 커밋의 모든 descendants changeId Set을 반환한다

---

## Phase 2: 소스 선택 + 서브트리 하이라이트

**User stories**: rebase 모드 진입, 이동 범위 시각적 확인, 모드 취소

### What to build

커밋 행에 rebase 모드 진입 버튼을 추가한다. 클릭하면 해당 커밋이 source로 선택되고, source + 모든 descendants가 하이라이트된다. ESC 키 또는 Cancel 버튼으로 모드를 취소할 수 있다. 이 phase가 끝나면 사용자가 커밋을 선택하고 이동될 범위를 시각적으로 확인할 수 있다.

### Acceptance criteria

- [ ] 커밋 행에 rebase 진입 수단이 있다 (버튼 또는 컨텍스트 메뉴)
- [ ] 클릭 시 source 커밋 + descendants 전체가 시각적으로 구분되는 스타일로 하이라이트된다
- [ ] 하이라이트 상태에서 "이 커밋들이 이동됩니다"라는 맥락이 사용자에게 전달된다 (상단 배너 또는 인라인 안내)
- [ ] ESC 키로 rebase 모드를 취소하면 하이라이트가 해제되고 일반 모드로 돌아간다
- [ ] Cancel 버튼으로도 동일하게 취소할 수 있다
- [ ] immutable 커밋에서는 rebase 진입이 비활성화되어 있다

---

## Phase 3: Destination 선택 + 확인 + 실행

**User stories**: destination 선택, rebase 실행, 그래프 새로고침

### What to build

서브트리 하이라이트 상태에서 다른 커밋을 클릭하면 destination으로 선택된다. source 서브트리 내부의 커밋은 destination으로 선택할 수 없다. destination 선택 시 확인 다이얼로그가 표시되고, 확인하면 rebase API를 호출한 뒤 그래프를 새로고침한다. 이 phase가 끝나면 GUI에서 실제 rebase를 수행할 수 있다.

### Acceptance criteria

- [ ] 하이라이트 상태에서 서브트리 외부의 커밋을 클릭하면 destination으로 선택된다
- [ ] source 서브트리 내부의 커밋은 클릭해도 destination으로 선택되지 않는다 (비활성화 스타일)
- [ ] destination 선택 시 확인 다이얼로그가 표시된다: source/destination 정보, 이동 커밋 수, Rebase/Cancel 버튼
- [ ] Rebase 확인 시 `/api/rebase`를 호출하고 성공하면 그래프가 새로고침된다
- [ ] 실행 중 로딩 상태가 표시된다
- [ ] API 에러 시 에러 메시지가 표시되고 모드가 초기화된다

---

## Phase 4: Undo + 에러 처리 강화

**User stories**: undo, conflict 안내, immutable 에러 처리

### What to build

rebase 성공 직후 undo 버튼이 포함된 toast를 표시한다. 클릭 시 `/api/undo`를 호출하고 그래프를 새로고침한다. rebase 후 conflict가 발생한 커밋이 있으면 안내 메시지를 표시한다. 이 phase가 끝나면 rebase UX의 전체 흐름이 완성된다.

### Acceptance criteria

- [ ] rebase 성공 후 "Undo" 버튼이 포함된 toast가 표시된다
- [ ] Undo 클릭 시 `jj undo`가 실행되고 그래프가 새로고침된다
- [ ] 다른 작업(다시 rebase, edit 등)을 수행하면 undo toast가 사라진다
- [ ] rebase 후 conflict 뱃지가 있는 커밋이 존재하면 "터미널에서 conflict를 해결하세요" 안내가 표시된다
- [ ] undo 실패 시 에러 메시지가 표시된다
