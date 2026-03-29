# PRD: 북마크(Bookmark) 관리 기능

## Problem Statement

현재 jj GUI에서는 커밋 그래프를 시각화하고 edit/new/rebase 같은 기본 커밋 조작은 가능하지만, 북마크(bookmark) 관리는 전혀 지원하지 않는다. 사용자는 북마크를 생성, 이동, 삭제, 이름 변경하려면 매번 CLI로 전환해야 하며, 특히 북마크를 다른 커밋으로 이동하는 작업은 change ID를 직접 타이핑해야 해서 번거롭다.

## Solution

커밋 그래프 UI 위에서 북마크를 직접 관리할 수 있는 기능을 추가한다.

- 커밋 행의 컨텍스트 메뉴에 "Create bookmark" 항목을 추가하여 모달로 이름을 입력받아 북마크를 생성한다.
- 기존 북마크 뱃지를 우클릭하면 전용 컨텍스트 메뉴가 나타나 move/delete/rename을 수행할 수 있다.
- 북마크 이동(move)은 rebase UX와 유사한 2단계 클릭 기반 워크플로우(소스 선택 → 대상 커밋 클릭 → 확인 → 실행)를 따른다.
- 이름 변경(rename)은 create와 동일한 모달 UI를 재사용한다.
- 에러(이름 중복 등)는 기존 ErrorBanner를 통해 표시한다.

## User Stories

1. As a jj 사용자, I want to 커밋 행에서 우클릭하여 "Create bookmark"을 선택하고 이름을 입력해 북마크를 생성, so that CLI 없이 GUI에서 바로 북마크를 만들 수 있다.
2. As a jj 사용자, I want to 북마크 뱃지를 우클릭하면 전용 컨텍스트 메뉴가 나타나, so that 해당 북마크에 대한 조작을 직관적으로 시작할 수 있다.
3. As a jj 사용자, I want to 북마크 컨텍스트 메뉴에서 "Move bookmark"을 선택하면 대상 커밋을 클릭으로 지정할 수 있어, so that change ID를 타이핑하지 않고 시각적으로 북마크를 이동할 수 있다.
4. As a jj 사용자, I want to 북마크 이동 시 확인(confirming) 단계를 거쳐, so that 실수로 잘못된 커밋에 북마크를 이동하는 것을 방지할 수 있다.
5. As a jj 사용자, I want to 북마크 이동 후 Undo 버튼이 표시되어, so that 잘못된 이동을 즉시 되돌릴 수 있다.
6. As a jj 사용자, I want to 북마크 컨텍스트 메뉴에서 "Delete bookmark"을 선택하면 해당 북마크가 삭제되어, so that 불필요한 북마크를 GUI에서 바로 정리할 수 있다.
7. As a jj 사용자, I want to 북마크 컨텍스트 메뉴에서 "Rename bookmark"을 선택하면 모달에서 새 이름을 입력할 수 있어, so that CLI 없이 북마크 이름을 변경할 수 있다.
8. As a jj 사용자, I want to 북마크 생성/이름변경 모달에서 빈 이름이나 중복 이름을 입력하면 에러가 표시되어, so that 잘못된 입력을 사전에 방지할 수 있다.
9. As a jj 사용자, I want to 북마크 이동 모드에서 ESC를 누르거나 취소 버튼을 클릭하면 이동이 취소되어, so that 원치 않는 조작을 중단할 수 있다.
10. As a jj 사용자, I want to 북마크 이동 모드와 rebase 모드가 동시에 활성화되지 않아, so that 두 조작이 충돌하지 않는다.
11. As a jj 사용자, I want to immutable 커밋에도 북마크를 생성할 수 있어, so that 릴리스 태그처럼 고정된 커밋에 북마크를 붙일 수 있다.
12. As a jj 사용자, I want to 북마크 조작 후 그래프가 자동으로 갱신되어, so that 항상 최신 상태를 볼 수 있다.
13. As a jj 사용자, I want to 북마크 이동 중 이동 대상이 아닌 커밋(예: 현재 북마크가 이미 있는 커밋)도 클릭할 수 있어, so that 자유롭게 대상을 선택할 수 있다.
14. As a jj 사용자, I want to 북마크 이동 배너에 현재 북마크 이름과 소스/대상 커밋 정보가 표시되어, so that 어떤 조작을 하고 있는지 명확히 알 수 있다.

## Implementation Decisions

### 서버 모듈

- `jj.ts`에 4개의 CLI 래퍼 함수 추가:
  - `bookmarkCreate(cwd, name, changeId)` → `jj bookmark create <name> -r <changeId>`
  - `bookmarkMove(cwd, name, destinationChangeId)` → `jj bookmark move <name> --to <changeId>`
  - `bookmarkDelete(cwd, name)` → `jj bookmark delete <name>`
  - `bookmarkRename(cwd, oldName, newName)` → `jj bookmark rename <oldName> <newName>`
- `routes.ts`에 4개의 POST 엔드포인트 추가:
  - `POST /api/bookmark/create` — body: `{ name, changeId }`
  - `POST /api/bookmark/move` — body: `{ name, destinationChangeId }`
  - `POST /api/bookmark/delete` — body: `{ name }`
  - `POST /api/bookmark/rename` — body: `{ oldName, newName }`
- 모든 엔드포인트는 기존 패턴대로 `?cwd=` 쿼리 파라미터 필수

### 클라이언트 모듈

- **BookmarkModal** 컴포넌트 (신규)
  - create/rename 공용 모달
  - props: `mode ('create' | 'rename')`, `initialName?`, `onSubmit`, `onCancel`
  - 이름 입력 input + 확인/취소 버튼
- **BookmarkContextMenu** 컴포넌트 (신규)
  - 북마크 뱃지 우클릭 시 표시되는 전용 메뉴
  - 항목: "Move bookmark", "Rename bookmark", "Delete bookmark"
  - 기존 ContextMenu 컴포넌트의 스타일/패턴 재사용
- **BookmarkMoveState** 타입 (신규)
  - RebaseState와 별도의 상태머신
  - phase: `'idle' | 'selecting-destination' | 'confirming' | 'executing'`
  - `bookmarkName`, `sourceChangeId`, `destinationChangeId`, `destinationDescription` 등
  - RebaseState와 배타적 제약: 둘 중 하나만 idle이 아닌 상태 가능
- **BookmarkMoveBanner** 컴포넌트 (신규)
  - RebaseBanner와 유사한 구조
  - 각 phase별 UI: 대상 선택 안내 → 확인 → 실행 중 → 완료(Undo 포함)
- **Badge** 컴포넌트 수정
  - 북마크 뱃지에 `onContextMenu` 핸들러 추가
  - 우클릭 시 BookmarkContextMenu 표시
- **CommitRow** 컴포넌트 수정
  - 기존 컨텍스트 메뉴에 "Create bookmark" 항목 추가
  - 클릭 시 BookmarkModal을 create 모드로 표시
- **App.tsx** 수정
  - BookmarkMoveState 상태 관리 추가
  - RebaseState와의 배타적 제약 로직
  - 북마크 API 호출 함수들

### API 계약

- 성공 시: `{ ok: true }`
- 실패 시: `{ ok: false, error: string }` (jj CLI의 stderr 메시지 전달)
- 모든 북마크 조작 후 SSE refresh 이벤트가 자동 발생 (fs.watch에 의해)

### 상태머신 배타적 제약

- `bookmarkMoveState.phase !== 'idle'`이면 rebase 시작 불가
- `rebaseState.phase !== 'idle'`이면 bookmark move 시작 불가
- 두 상태 모두 idle일 때만 새로운 조작 시작 가능

## Testing Decisions

- 현재 프로젝트에 테스트 프레임워크가 없으므로 이번 PRD에서는 테스트를 scope 밖으로 둔다.
- 추후 테스트 프레임워크 도입 시, 서버의 jj CLI 래퍼 함수와 클라이언트의 상태머신 로직이 우선 테스트 대상이 된다.

## Out of Scope

- Remote 북마크(tracking branch) 관련 기능 (push, fetch, remote 상태 표시)
- 북마크 목록 전체를 보여주는 별도 패널/뷰
- 드래그 앤 드롭 기반 북마크 이동
- 북마크 필터링/검색
- Split/Squash 등 다른 커밋 조작 기능
- 테스트 프레임워크 세팅 및 테스트 작성
- 커밋 description 인라인 편집

## Further Notes

- 북마크 이동(move)의 UX는 기존 rebase 워크플로우와 의도적으로 유사하게 설계하여 학습 비용을 줄인다.
- move만 Undo를 지원하고, create/delete/rename은 Undo를 지원하지 않는다. (move는 `jj op restore`로 되돌릴 수 있으며, 기존 Undo 인프라를 재사용한다.)
- BookmarkModal은 create와 rename에서 공용으로 사용하여 UI 일관성을 유지한다.
- 이 기능은 로컬 북마크만 다루며, remote 연동은 별도 PRD로 진행한다.
