# PRD: visual-jj-webview UI 리디자인

## 목표

커밋 행 레이아웃을 간결하게 정리하여, 핵심 정보(상태 뱃지, description, 상대시간)만 한눈에 보이도록 개선한다.

## 변경 사항

### 1. CommitRow 레이아웃 재구성

현재: `changeId → badges → commitId → description → author → timestamp`
변경: `[Editing] [workspace] [bookmarks] [empty] description [상대시간]`

제거 항목:
- changeId — 완전히 제거
- commitId — 완전히 제거
- author — 완전히 제거
- '(no description)' 이탤릭 텍스트 — empty 뱃지로 대체
- 더블클릭 jj edit 기능 및 confirm dialog — 제거

### 2. Editing 뱃지 추가

- `isWorkingCopy === true`인 커밋에 초록 배경의 'Editing' 뱃지 표시
- 기존 workspace 뱃지와 함께 둘 다 표시

### 3. 상대시간 변환 (클라이언트)

- 서버에서 오는 절대시간(`2024-01-01 12:00:00`)을 클라이언트에서 상대시간으로 변환
- 형식: `3m`, `54m`, `2h`, `1d`, `3w`, `2mo` 등
- 유틸 함수 `formatRelativeTime(timestamp: string): string` 신규 작성

### 4. 파일 목록 — 파일명만 표시

- 전체 경로 대신 파일명만 표시
- 예: `src/components/MenuDetail.tsx` → `MenuDetail.tsx`

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `packages/client/src/components/CommitRow.tsx` | 레이아웃 재구성, ID/author 제거, 더블클릭 제거, Editing 뱃지 추가, 상대시간 적용 |
| `packages/client/src/components/Badge.tsx` | `editing` variant 추가 |
| `packages/client/src/components/FileList.tsx` | 파일명만 표시 |
| `packages/client/src/components/styles.css` | `.badge--editing` 스타일 추가 |
| `packages/client/src/components/LogView.tsx` | 더블클릭 핸들러 및 confirm dialog 제거 |
| `packages/client/src/utils/format.ts` | (신규) `formatRelativeTime()` 유틸 |

## 변경하지 않는 것

- 파일 상태 아이콘: 현재 A/M/D 텍스트 유지
- bookmark 뱃지: 현재 보라색 배경 스타일 유지
- workspace 뱃지: 유지
- 파일 토글: 행 전체 클릭 방식 유지 (chevron 아이콘 추가 안 함)
- 서버 코드: 변경 없음
