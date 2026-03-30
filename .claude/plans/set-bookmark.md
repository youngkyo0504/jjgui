# Set Bookmark 구현 계획

GitHub Issue #2: "Create bookmark"과 "Move bookmark"을 하나의 "Set bookmark" cmdk 모달로 통합

## 변경 요약

context menu에서 "Set bookmark" 선택 → cmdk 자동완성 모달 → 기존 bookmark 선택(move) 또는 새 이름 입력(create) → `jj bookmark set` 단일 명령으로 처리. 기존 BookmarkMoveBanner 멀티스텝 워크플로우 제거.

## 구현 단계

### 1. cmdk 설치
- `bun add cmdk --cwd packages/client`

### 2. Server: `jj.ts`에 함수 추가
- `bookmarkList(cwd)`: `jj bookmark list --template 'name ++ "\n"'` 실행 → 이름 배열 반환
- `bookmarkSet(cwd, name, changeId)`: `jj bookmark set ${name} -r ${changeId}` 실행

### 3. Server: `routes.ts`에 엔드포인트 추가
- `GET /api/bookmarks?cwd=...` → `bookmarkList()` 호출, `{ bookmarks: string[] }` 반환
- `POST /api/bookmark/set?cwd=...` → `bookmarkSet()` 호출, `{ ok: true }` 반환
- import에 `bookmarkList`, `bookmarkSet` 추가

### 4. Client: `SetBookmarkModal` 컴포넌트 생성
- cmdk의 `Command` 컴포넌트 사용
- Props: `changeId`, `cwd`, `onSuccess`, `onCancel`, `onError`
- 모달 오픈 시 `/api/bookmarks` fetch → bookmark 목록 표시
- cmdk 내장 fuzzy 검색으로 필터링
- 입력값이 기존 목록에 없으면 "Create new bookmark: {입력값}" 옵션 동적 추가
- 선택 시 `/api/bookmark/set` 호출 → 성공하면 `onSuccess()` → 모달 닫기
- ESC로 닫기, Enter로 선택
- 기존 modal-overlay/modal CSS 재사용 + cmdk 스타일 추가

### 5. Client: `App.tsx` 수정
- `BookmarkMoveBanner` import 및 렌더링 제거
- `BookmarkMoveState` 타입, `bookmarkMove` state 제거
- `handleBookmarkMoveStart`, `handleBookmarkMoveDestinationSelect`, `handleBookmarkMoveCancel`, `handleBookmarkMoveConfirm`, `handleBookmarkMoveUndo` 핸들러 제거
- ESC 키 리스너에서 bookmarkMove 관련 코드 제거
- `bookmarkModal` state를 `setBookmarkModal`로 변경: `{ changeId: string } | { mode: 'rename', bookmarkName: string } | null`
  - "Set bookmark" → `{ changeId }` (SetBookmarkModal 렌더)
  - "Rename bookmark" → `{ mode: 'rename', bookmarkName }` (기존 BookmarkModal 렌더)
- `handleBookmarkCreate` 핸들러 제거 (SetBookmarkModal이 직접 API 호출)
- `SetBookmarkModal` 렌더링 추가
- LogView에 전달하는 props에서 bookmark move 관련 제거, `onBookmarkCreate` → `onSetBookmark`로 변경

### 6. Client: `LogView.tsx` 수정
- props에서 `bookmarkMove`, `onBookmarkMoveDestinationSelect`, `onBookmarkMoveStart` 제거
- `onBookmarkCreate` → `onSetBookmark`로 변경
- CommitRow에 전달하는 props 동일하게 수정

### 7. Client: `CommitRow.tsx` 수정
- props에서 `bookmarkMove`, `onBookmarkMoveDestinationSelect`, `onBookmarkMoveStart` 제거
- `isBookmarkMoveMode`, `isBookmarkMoveDestination` 관련 로직 제거
- `handleClick`에서 bookmarkMove 분기 제거
- context menu: "Create bookmark" → "Set bookmark"으로 변경, immutable일 때 disabled
- bookmark context menu: "Move bookmark" 항목 제거
- `onBookmarkCreate` → `onSetBookmark`로 변경

### 8. `BookmarkMoveBanner.tsx` 파일 삭제

### 9. `styles.css`에 cmdk 스타일 추가
- cmdk 기본 스타일 + 기존 테마 변수 활용

## 파일 변경 목록
- `packages/client/package.json` — cmdk 의존성 추가
- `packages/server/src/jj.ts` — `bookmarkList`, `bookmarkSet` 함수 추가
- `packages/server/src/routes.ts` — 2개 엔드포인트 추가
- `packages/client/src/components/SetBookmarkModal.tsx` — 신규 생성
- `packages/client/src/App.tsx` — bookmark move 제거, set bookmark 통합
- `packages/client/src/components/LogView.tsx` — props 정리
- `packages/client/src/components/CommitRow.tsx` — context menu 변경, props 정리
- `packages/client/src/components/BookmarkMoveBanner.tsx` — 삭제
- `packages/client/src/components/styles.css` — cmdk 스타일 추가
