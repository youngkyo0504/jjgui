# PRD: Git Push 기능 추가

## Problem Statement

현재 visual-jj-webview에서 bookmark을 git remote에 push하려면 터미널에서 `jj git push -b <bookmark>` 명령을 직접 실행해야 한다. 웹 GUI에서 bookmark을 보면서 바로 push할 수 없어, 워크플로우가 끊기고 컨텍스트 스위칭이 발생한다.

## Solution

커밋 그래프에서 bookmark badge를 우클릭하면 컨텍스트 메뉴가 나타나고, "Push this bookmark" 또는 "Push with children" 항목을 선택하여 push할 수 있다. remote가 1개면 바로 push가 실행되고, 여러 개면 드롭다운으로 remote를 선택한다. push 진행 중에는 해당 bookmark badge에 스피너가 표시되며, 성공/실패 피드백이 제공된다. non-fast-forward 실패 시 force push 확인 다이얼로그가 뜬다.

## User Stories

1. As a developer, I want to right-click a bookmark badge and select "Push this bookmark", so that I can push a specific bookmark to the remote without leaving the web GUI.
2. As a developer, I want to select "Push with children" from the bookmark context menu, so that I can push the selected bookmark and all descendant bookmarks in one action.
3. As a developer, I want the push to execute immediately when there is only one remote, so that I don't have to go through unnecessary selection steps.
4. As a developer, I want to see a dropdown to select a remote when multiple remotes exist, so that I can choose which remote to push to.
5. As a developer, I want to see a spinner on the bookmark badge while push is in progress, so that I know the operation is running.
6. As a developer, I want to see a success message after a successful push, so that I have confirmation the operation completed.
7. As a developer, I want to see an error message when push fails, so that I can understand what went wrong.
8. As a developer, I want to see a "Force push?" confirmation dialog when push fails due to non-fast-forward, so that I can decide whether to force push.
9. As a developer, I want other commit operations (edit, new, rebase) to be blocked while push is in progress, so that I don't cause conflicts during the push.
10. As a developer, I want the commit graph to automatically refresh after a successful push, so that I can see the updated state.
11. As a developer, I want the push context menu to only appear on bookmark badges, so that the UI is intuitive and contextually appropriate.
12. As a developer, I want "Push with children" to find all descendant commits with bookmarks and push them all, so that I can push an entire branch hierarchy at once.
13. As a developer, I want to see an "already up to date" message when pushing a bookmark that is already synced, so that I know no action was needed.
14. As a developer, I want authentication errors to be displayed clearly, so that I can troubleshoot SSH key or token issues.

## Implementation Decisions

- **Bookmark Badge 컨텍스트 메뉴**: 기존 Badge 컴포넌트에 우클릭 이벤트를 추가하여 bookmark 전용 컨텍스트 메뉴를 표시한다. 메뉴 항목: "Push this bookmark", "Push with children".
- **Server - jj CLI 래퍼 모듈**: `pushBookmark(cwd, bookmark, remote, force?)` 함수를 추가하여 `jj git push -b <bookmark> --remote <remote>` (force 시 `--allow-new`)를 실행한다. `getRemotes(cwd)` 함수를 추가하여 `jj git remote list`로 remote 목록을 조회한다.
- **Server - 라우팅 모듈**: `POST /api/push?cwd=` 엔드포인트 (body: `{ bookmark, remote, force? }`)와 `GET /api/remotes?cwd=` 엔드포인트를 추가한다.
- **Push with children 로직**: 클라이언트에서 기존 그래프 데이터를 활용하여 해당 bookmark 커밋의 descendant 중 bookmark이 있는 커밋들을 찾고, 각 bookmark에 대해 순차적으로 push를 실행한다.
- **Remote 선택 UI**: remote가 1개면 바로 push 실행. 여러 개면 드롭다운 UI를 표시하여 선택 후 push.
- **로딩 상태**: push 진행 중인 bookmark의 changeId를 상태로 관리하여 해당 Badge에 스피너를 표시한다.
- **작업 차단**: push 진행 중에는 다른 커밋 조작 (edit, new, rebase, describe)을 비활성화한다.
- **Force push 흐름**: push 실패 시 에러 메시지를 파싱하여 non-fast-forward인 경우 "Force push 하시겠습니까?" 확인 다이얼로그를 표시하고, 확인 시 force 옵션으로 재시도한다.
- **피드백**: 성공 시 성공 토스트, 실패 시 에러 토스트, 이미 동기화된 경우 "already up to date" 토스트를 표시한다.

## Testing Decisions

현재 테스트 프레임워크가 없으므로 테스트 작성은 이번 스코프에서 제외한다.

## Out of Scope

- `jj git push --all` (모든 bookmark 일괄 push)
- `jj git fetch` / `jj git pull` 기능
- Remote 추가/삭제/수정 관리
- Push 히스토리 또는 되돌리기
- Bookmark 생성/삭제 기능
- Push 전 diff 미리보기

## Further Notes

- `jj git push -b`는 해당 bookmark이 가리키는 커밋을 remote에 push한다. bookmark이 없는 커밋은 push할 수 없다.
- force push는 `--allow-new` 또는 관련 플래그를 사용하며, 정확한 플래그는 구현 시 jj 버전에 맞게 확인한다.
- "Push with children"에서 descendant bookmark을 찾는 로직은 기존 `utils/graph.ts`의 BFS descendants 계산을 활용할 수 있다.
- push는 네트워크 작업이므로 타임아웃 처리를 고려한다.
- 기존 rebase, describe 워크플로우와 충돌하지 않도록, 해당 작업 진행 중에는 push 메뉴를 비활성화하는 것을 고려한다.
