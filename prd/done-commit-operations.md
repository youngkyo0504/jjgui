# PRD: 커밋 조작 기능 (Split / Squash / Move Changes)

## Problem Statement

현재 jj GUI에서는 edit, new, rebase 같은 기본 커밋 조작만 가능하다. 커밋을 분할(split)하거나 합치기(squash), 변경사항을 다른 커밋으로 이동(move changes)하려면 CLI로 전환해야 한다. 특히 split과 move changes는 파일을 선택하는 인터랙티브 작업이라 CLI에서도 번거로운데, GUI에서 시각적으로 파일을 선택할 수 있다면 훨씬 직관적이다.

## Solution

커밋 컨텍스트 메뉴에 Split, Squash into parent, Move changes from here 세 가지 항목을 추가한다.

- **Split**: 커밋 우클릭 → "Split" → 파일 체크박스 모달에서 분리할 파일 선택 → 선택한 파일들이 새 커밋으로 빠짐
- **Squash**: 커밋 우클릭 → "Squash into parent" → 확인 모달에서 소스/대상 정보 확인 → 부모 커밋으로 합침
- **Move changes**: 커밋 우클릭 → "Move changes from here" → 파일 체크박스 모달에서 이동할 파일 선택 → 대상 커밋 클릭 → 확인 → 선택한 파일들이 대상 커밋으로 이동

세 조작 모두 실행 후 Undo 버튼을 제공한다. immutable 커밋에서는 세 메뉴 항목 모두 비활성화된다.

## User Stories

1. As a jj 사용자, I want to 커밋을 우클릭하여 "Split"을 선택하면 파일 선택 모달이 나타나, so that 하나의 커밋을 파일 단위로 두 개의 커밋으로 분할할 수 있다.
2. As a jj 사용자, I want to split 모달에서 체크박스로 파일을 선택하면 선택한 파일들이 새 커밋으로 분리되어, so that CLI의 인터랙티브 모드 없이 시각적으로 파일을 골라 split할 수 있다.
3. As a jj 사용자, I want to split 후 Undo 버튼이 표시되어, so that 잘못된 분할을 즉시 되돌릴 수 있다.
4. As a jj 사용자, I want to 커밋을 우클릭하여 "Squash into parent"를 선택하면 확인 모달이 나타나, so that 실수로 합치는 것을 방지할 수 있다.
5. As a jj 사용자, I want to squash 확인 모달에서 소스 커밋과 부모 커밋 정보를 볼 수 있어, so that 어떤 커밋이 어디로 합쳐지는지 명확히 확인할 수 있다.
6. As a jj 사용자, I want to squash 후 Undo 버튼이 표시되어, so that 잘못된 합치기를 즉시 되돌릴 수 있다.
7. As a jj 사용자, I want to 커밋을 우클릭하여 "Move changes from here"를 선택하면 파일 선택 모달이 나타나, so that 이동할 파일을 시각적으로 선택할 수 있다.
8. As a jj 사용자, I want to move changes에서 파일 선택 후 대상 커밋을 클릭으로 지정할 수 있어, so that change ID를 타이핑하지 않고 시각적으로 대상을 선택할 수 있다.
9. As a jj 사용자, I want to move changes 시 확인 단계를 거쳐, so that 잘못된 커밋으로 변경사항을 이동하는 것을 방지할 수 있다.
10. As a jj 사용자, I want to move changes 후 Undo 버튼이 표시되어, so that 잘못된 이동을 즉시 되돌릴 수 있다.
11. As a jj 사용자, I want to immutable 커밋에서는 Split/Squash/Move changes 메뉴가 비활성화되어, so that 변경 불가능한 커밋에 대한 잘못된 조작을 시도하지 않게 된다.
12. As a jj 사용자, I want to move changes 모드에서 ESC를 누르거나 취소 버튼을 클릭하면 조작이 취소되어, so that 원치 않는 조작을 중단할 수 있다.
13. As a jj 사용자, I want to move changes 모드와 rebase/bookmark-move 모드가 동시에 활성화되지 않아, so that 여러 조작이 충돌하지 않는다.
14. As a jj 사용자, I want to split/move changes 모달에서 변경된 파일 목록과 각 파일의 상태(A/M/D)를 볼 수 있어, so that 어떤 파일을 선택할지 판단할 수 있다.
15. As a jj 사용자, I want to split 모달에서 전체 선택/해제 기능이 있어, so that 많은 파일 중 일부만 제외하고 싶을 때 편리하게 선택할 수 있다.

## Implementation Decisions

### 서버 모듈

- `jj.ts`에 3개의 CLI 래퍼 함수 추가:
  - `split(cwd, changeId, paths)` → `jj split -r <changeId> <paths...>` (선택한 파일들이 첫 번째 커밋에 남고, 나머지가 두 번째 커밋이 됨. GUI에서는 "선택한 파일 → 새 커밋"으로 표현하므로, 선택하지 않은 파일들을 paths로 전달)
  - `squash(cwd, changeId)` → `jj squash -r <changeId>` (부모로 합침)
  - `moveChanges(cwd, fromChangeId, toChangeId, paths)` → `jj squash --from <fromChangeId> --into <toChangeId> <paths...>`
- `routes.ts`에 3개의 POST 엔드포인트 추가:
  - `POST /api/split` — body: `{ changeId, paths }`
  - `POST /api/squash` — body: `{ changeId }`
  - `POST /api/move-changes` — body: `{ fromChangeId, toChangeId, paths }`
- 모든 엔드포인트는 기존 패턴대로 `?cwd=` 쿼리 파라미터 필수

### 클라이언트 모듈

- **FileSelectModal** 컴포넌트 (신규)
  - split과 move changes에서 공용으로 사용하는 파일 체크박스 모달
  - props: `title`, `files: ChangedFile[]`, `onSubmit(selectedPaths)`, `onCancel`
  - 파일별 체크박스 + 상태(A/M/D) 표시
  - 전체 선택/해제 토글
  - 최소 1개 파일 선택 필수 (split에서는 전체 선택 불가 — 최소 1개는 원래 커밋에 남아야 함)
- **ConfirmModal** 컴포넌트 (신규)
  - squash 확인용 모달
  - 소스 커밋과 부모 커밋의 changeId, description 표시
  - 확인/취소 버튼
- **MoveChangesState** 타입 (신규)
  - move changes 전용 상태머신
  - phase: `'idle' | 'selecting-destination' | 'confirming' | 'executing'`
  - `fromChangeId`, `selectedPaths`, `toChangeId`, `toDescription` 등
  - RebaseState, BookmarkMoveState와 배타적 제약: 셋 중 하나만 idle이 아닌 상태 가능
- **MoveChangesBanner** 컴포넌트 (신규)
  - move changes 진행 상태 표시 배너
  - 각 phase별 UI: 대상 선택 안내 → 확인 → 실행 중 → 완료(Undo 포함)
- **CommitRow** 컴포넌트 수정
  - 기존 컨텍스트 메뉴에 "Split", "Squash into parent", "Move changes from here" 항목 추가
  - immutable 커밋에서는 세 항목 모두 비활성화
- **App.tsx** 수정
  - MoveChangesState 상태 관리 추가
  - RebaseState, BookmarkMoveState와의 배타적 제약 로직 확장
  - split/squash/moveChanges API 호출 함수들
  - 세 조작 모두 Undo 지원 (기존 Undo 인프라 재사용)

### Split 동작 상세

- jj split은 "선택한 파일이 첫 번째(원래) 커밋에 남고, 나머지가 두 번째(새) 커밋이 되는" 방식
- GUI에서는 사용자가 "새 커밋으로 빼낼 파일"을 선택하는 것이 직관적이므로, 내부적으로 선택하지 않은 파일들을 jj split의 paths 인자로 전달하여 원래 커밋에 남김
- description 입력 없이 split만 수행 (새 커밋은 빈 description)

### API 계약

- 성공 시: `{ ok: true }`
- 실패 시: `{ ok: false, error: string }` (jj CLI의 stderr 메시지 전달)
- 모든 조작 후 SSE refresh 이벤트가 자동 발생 (fs.watch에 의해)

### 상태머신 배타적 제약

- RebaseState, BookmarkMoveState, MoveChangesState 세 개의 상태머신이 존재
- 셋 중 하나라도 idle이 아니면 나머지 두 개의 조작 시작 불가
- 이 제약은 App.tsx에서 중앙 관리

## Testing Decisions

- 현재 프로젝트에 테스트 프레임워크가 없으므로 이번 PRD에서는 테스트를 scope 밖으로 둔다.
- 추후 테스트 프레임워크 도입 시:
  - 좋은 테스트란 구현 세부사항이 아닌 외부 동작만 검증하는 것
  - 서버의 jj CLI 래퍼 함수 (split/squash/moveChanges)가 우선 테스트 대상
  - FileSelectModal의 선택 로직 (전체 선택, 최소 1개 제약 등)이 클라이언트 테스트 대상

## Out of Scope

- Hunk 단위 split (파일 내 부분 변경사항 선택)
- 임의의 두 커밋 squash (부모가 아닌 커밋으로 합치기)
- Diff 뷰어 (파일의 변경 내용을 보여주는 기능)
- 커밋 description 편집 기능
- Remote 관련 기능 (push, fetch)
- 테스트 프레임워크 세팅 및 테스트 작성
- 북마크 관리 기능 (별도 PRD로 분리됨)

## Further Notes

- FileSelectModal은 split과 move changes에서 공용으로 사용하여 UI 일관성을 유지한다.
- Split의 "선택한 파일 → 새 커밋" UX와 jj split의 "선택한 파일 → 원래 커밋에 유지" 동작 사이의 변환은 서버 또는 클라이언트에서 paths를 반전시켜 처리한다.
- Move changes는 내부적으로 `jj squash --from --into`를 사용한다. jj에서 squash와 move는 같은 명령의 다른 옵션이지만, GUI에서는 사용자 관점에서 "합치기"와 "변경사항 이동"을 별도 메뉴로 분리한다.
- 세 조작 모두 Undo를 지원하며, 기존 `jj op restore` 기반 Undo 인프라를 재사용한다.
- 상태머신 배타적 제약이 3개로 늘어나므로, 추후 이를 하나의 통합 상태머신으로 리팩토링하는 것을 고려할 수 있다 (이번 scope 밖).
