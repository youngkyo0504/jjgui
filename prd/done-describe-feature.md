# PRD: Describe 기능 추가

## Problem Statement

현재 visual-jj-webview에서 커밋의 description(메시지)을 변경하려면 터미널에서 `jj describe` 명령을 직접 실행해야 한다. 웹 GUI에서 커밋을 보면서 바로 description을 수정할 수 없어, 워크플로우가 끊기고 컨텍스트 스위칭이 발생한다.

## Solution

커밋 그래프에서 우클릭 컨텍스트 메뉴에 "Describe" 항목을 추가하고, 클릭 시 해당 커밋 row 아래에 인라인 textarea가 펼쳐져 description을 편집할 수 있도록 한다. 기존 description이 textarea에 미리 채워지며, Save/Cancel 버튼으로 저장하거나 취소할 수 있다. 저장 시 `jj describe` 명령이 실행되고, SSE를 통해 그래프가 자동 갱신된다.

## User Stories

1. As a developer, I want to right-click a commit and select "Describe" from the context menu, so that I can edit the commit message without leaving the web GUI.
2. As a developer, I want to see the current full description pre-filled in the textarea, so that I can modify the existing message rather than rewriting from scratch.
3. As a developer, I want to write multi-line descriptions in the textarea, so that I can add detailed commit messages with summary and body.
4. As a developer, I want to click "Save" to apply my description change, so that the commit message is updated via `jj describe`.
5. As a developer, I want to click "Cancel" to discard my changes, so that I can abort the edit without side effects.
6. As a developer, I want the commit graph to automatically refresh after saving a description, so that I can see the updated message immediately.
7. As a developer, I want the "Describe" menu item to be disabled for immutable commits, so that I don't accidentally try to modify protected commits.
8. As a developer, I want the textarea to appear inline below the commit row, so that I maintain visual context of which commit I'm editing.
9. As a developer, I want empty descriptions (`(no description set)`) to show as an empty textarea, so that I can write a fresh message without clearing placeholder text.
10. As a developer, I want only one describe editor open at a time, so that the UI doesn't become cluttered with multiple open editors.

## Implementation Decisions

- **Server - jj CLI 래퍼 모듈**: `describeCommit(cwd, changeId, message)` 함수를 추가하여 `jj describe -m <message> <changeId>`를 실행한다. 또한 `getFullDescription(cwd, changeId)` 함수를 추가하여 커밋의 전체 description을 조회한다 (현재는 `first_line()`만 가져오고 있으므로).
- **Server - 라우팅 모듈**: `POST /api/describe?cwd=` 엔드포인트 (body: `{ changeId, message }`)와 `GET /api/description/:changeId?cwd=` 엔드포인트를 추가한다.
- **Client - CommitRow 컴포넌트**: 컨텍스트 메뉴에 "Describe" 항목을 추가한다. immutable 커밋이면 비활성화한다.
- **Client - 인라인 편집 UI**: CommitRow 아래에 textarea + Save/Cancel 버튼이 펼쳐지는 형태로 구현한다. "Describe" 클릭 시 서버에서 전체 description을 가져와 textarea에 채운다.
- **Client - App 상태 관리**: 현재 describe 편집 중인 커밋의 changeId를 상태로 관리한다. 한 번에 하나의 커밋만 편집 가능하다.
- **빈 description 처리**: `(no description set)` 등의 placeholder 텍스트는 빈 문자열로 변환하여 textarea에 표시한다.
- **저장 후 갱신**: 별도의 성공/실패 토스트 없이, 기존 SSE refresh 메커니즘을 통해 그래프가 자동 갱신된다.

## Testing Decisions

현재 테스트 프레임워크가 없으므로 테스트 작성은 이번 스코프에서 제외한다.

## Out of Scope

- 키보드 단축키 (Ctrl+Enter 저장, Esc 취소 등)
- 성공/실패 토스트 알림
- `jj new` 후 자동으로 describe UI 열기
- description 히스토리 또는 되돌리기
- 마크다운 미리보기

## Further Notes

- `jj describe`는 immutable이 아닌 모든 커밋에 대해 사용 가능하다.
- 전체 description 조회를 위해 `jj log` template을 수정하거나 `jj show` 등 별도 명령을 활용할 수 있다. 구현 시 가장 간단한 방법을 선택한다.
- 기존 rebase 워크플로우와 충돌하지 않도록, rebase 진행 중에는 describe 메뉴를 비활성화하는 것을 고려한다.
