# Issue #1: UI 리디자인 — 커밋 행 레이아웃 간결화

## 변경 요약

**현재:** `changeId → badges → commitId → description → author → timestamp`
**변경:** `[Editing] [workspace] [bookmarks] [empty] description [상대시간]`

## 구현 단계

### 1. `utils/format.ts` 신규 생성
- `formatRelativeTime(timestamp: string): string` 유틸 함수
- 형식: `3m`, `54m`, `2h`, `1d`, `3w`, `2mo`

### 2. `Badge.tsx` — `editing` variant 추가
- variant union에 `'editing'` 추가

### 3. `styles.css` 수정
- `.badge--editing` 스타일 추가 (초록 배경)
- `.commit-change-id`, `.commit-id`, `.commit-author`, `.commit-description--empty` 제거
- `.dialog-*` 관련 스타일 전체 제거

### 4. `CommitRow.tsx` — 레이아웃 재구성
- 제거: `changeId`, `commitId`, `author` 렌더링
- 제거: `onDoubleClick` prop 및 더블클릭 핸들러
- 제거: `(no description)` 이탤릭 텍스트
- 추가: `isWorkingCopy === true`일 때 `Editing` 뱃지
- 변경: timestamp → `formatRelativeTime()` 상대시간

### 5. `LogView.tsx` — 더블클릭/다이얼로그 제거
- `confirmEdit`, `editing` state 제거
- `handleDoubleClick`, `handleConfirmEdit` 함수 제거
- confirm dialog JSX 전체 제거
- `CommitRow`에 `onDoubleClick` prop 전달 제거

### 6. `FileList.tsx` — 파일명만 표시
- `f.path`에서 파일명만 추출 (예: `src/Foo.tsx` → `Foo.tsx`)

## 변경하지 않는 것
- A/M/D 파일 상태 아이콘, bookmark/workspace 뱃지 스타일, 파일 토글, 서버 코드
