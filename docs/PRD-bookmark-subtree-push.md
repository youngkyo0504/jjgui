# PRD: Bookmark Subtree Push

## 배경

visual-jj-webview는 현재 bookmark badge 우클릭 메뉴에서 단일 bookmark push를 지원한다. 하지만 jj의 stacked workflow에서는 특정 bookmark만 push하는 대신, 그 bookmark를 루트로 하는 하위 스택 전체를 함께 push하고 싶은 경우가 자주 있다.

현재 이 작업은 터미널에서 `jj git push -r '<bookmark>::'`를 직접 실행해야 한다. 사용자는 그래프에서 이미 스택 구조를 보고 있음에도, 하위 bookmark까지 한 번에 push하려면 다시 CLI로 전환해야 한다.

## 문제

단일 bookmark push만 제공하면 다음 문제가 남는다.

- 스택 단위 작업에서 여러 bookmark를 반복해서 push해야 한다.
- 사용자가 "이 bookmark 아래도 같이 올려야 하는데"라는 판단을 UI에서 바로 실행으로 연결할 수 없다.
- subtree 범위가 넓을수록 실수 가능성이 커지는데, 현재 GUI에는 이를 위한 전용 액션과 확인 단계가 없다.

## 목표

- bookmark badge 컨텍스트 메뉴에서 subtree push를 직접 시작할 수 있다.
- subtree push는 jj의 revset 기반 동작을 그대로 사용한다: `jj git push -r '<bookmark>::'`.
- 실수 방지를 위해 실행 전에 명시적인 확인 단계를 둔다.
- remote 선택 UX는 기존 push 흐름과 최대한 일관되게 유지한다.
- 하위 bookmark가 실제로 없더라도 동일한 메뉴를 제공하고, 자연스럽게 단건 push와 같은 결과를 낸다.

## 비목표

- 임의 revset 입력 UI 제공
- 여러 remote에 동시에 push
- subtree에 포함될 bookmark 목록을 별도 패널로 미리 보여주기
- push 전 diff/preview 화면 제공
- `Push this bookmark` 기존 동작 제거 또는 대체

---

## 기능 명세

### 1. 진입점

- bookmark badge 우클릭 메뉴에 새 항목을 추가한다.
- 작업용 라벨은 `Push with descendants`로 둔다.
- 기존 `Push this bookmark`는 유지한다.

### 2. 실행 의미

- 새 메뉴는 선택한 bookmark 이름을 기준으로 `jj git push -r '<bookmark>::'`를 실행한다.
- 이 명령은 기준 bookmark가 가리키는 커밋과 그 descendants를 revset으로 지정하고, 그 커밋들을 가리키는 bookmark들을 함께 push한다.
- 하위 bookmark가 추가로 없으면 결과적으로 기존 단건 push와 유사하게 동작한다.

### 3. 확인 단계

- 사용자가 `Push with descendants`를 누르면 즉시 push하지 않는다.
- 먼저 확인 모달을 띄운다.
- 확인 문구는 최소한 다음 의미를 전달해야 한다.
  - 선택한 bookmark를 포함해 하위 bookmark들도 함께 push된다.
  - 취소할 수 있다.
- 버튼은 `Continue` / `Cancel`로 구성한다.

### 4. Remote 선택

- 사용자가 확인 모달에서 계속 진행을 선택한 뒤 기존 remote 선택 흐름으로 들어간다.
- remote가 0개면 에러를 보여주고 종료한다.
- remote가 1개면 해당 remote로 즉시 push를 시작한다.
- remote가 여러 개면 기존 remote 선택 모달을 재사용한다.

### 5. 실행 중 상태

- subtree push가 실행 중이면, 액션을 시작한 기준 bookmark badge에 pushing 상태를 표시한다.
- 동일 bookmark에 대한 중복 push 액션은 비활성화한다.
- 완료 후 pushing 상태를 해제한다.

### 6. 결과 피드백

- 성공 시 성공 토스트를 표시한다.
- 변경 사항이 없으면 `already up to date` 성격의 정보 토스트를 표시한다.
- 실패 시 에러 토스트를 표시한다.
- 성공 후에는 기존과 같이 그래프를 새로고침한다.

### 7. 실패 후 재확인

- push가 safety check 또는 non-fast-forward/rejected 계열 문제로 실패하면, 자동 재시도하지 않는다.
- 사용자가 명시적으로 다시 확인할 수 있는 추가 확인 단계가 필요하다.
- 단, 실제 재시도 방식은 배포 대상 jj 버전이 지원하는 override 옵션을 확인한 뒤 확정한다.

---

## 사용자 스토리

1. As a jj 사용자, I want to right-click a bookmark badge and choose `Push with descendants`, so that I can push a bookmark stack without leaving the GUI.
2. As a jj 사용자, I want the action to run with jj revset semantics, so that subtree 범위가 CLI와 일치한다.
3. As a jj 사용자, I want a confirmation step before subtree push starts, so that 대상을 넓게 push하는 실수를 줄일 수 있다.
4. As a jj 사용자, I want the existing remote selection flow to be reused, so that 새 기능도 익숙한 방식으로 사용할 수 있다.
5. As a jj 사용자, I want the menu item to remain visible even when there are no descendant bookmarks, so that 동작 규칙을 따로 기억하지 않아도 된다.
6. As a jj 사용자, I want clear success, info, and error feedback, so that 결과를 바로 이해할 수 있다.
7. As a jj 사용자, I want destructive retry가 필요할 때 자동으로 진행되지 않고 먼저 질문받기를 원한다, so that 원치 않는 remote update를 막을 수 있다.

---

## UX 흐름

### 기본 흐름

1. bookmark badge 우클릭
2. `Push with descendants` 선택
3. 확인 모달 표시
4. `Continue` 선택
5. remote 개수에 따라:
   - 0개: 에러 표시 후 종료
   - 1개: 즉시 subtree push 실행
   - 여러 개: remote 선택 모달 표시
6. push 결과 토스트 표시
7. 그래프 새로고침

### 실패 흐름

1. subtree push 실행
2. safety check / rejected 계열 실패 발생
3. 에러 내용을 보여준다
4. 자동 재시도 대신 확인 모달로 다시 묻는다
5. 사용자가 동의한 경우에만 지원되는 재시도 경로를 실행한다

---

## 기술 설계

### 프론트엔드

- [CommitRow.tsx](/Users/keumky/Desktop/side-project/visual-jj-webview/packages/client/src/components/CommitRow.tsx)
  - bookmark 컨텍스트 메뉴에 `Push with descendants` 항목 추가
- [App.tsx](/Users/keumky/Desktop/side-project/visual-jj-webview/packages/client/src/App.tsx)
  - subtree push 확인 모달 상태 추가
  - 기존 push 실행 로직에 `scope` 또는 동등한 구분값 추가
  - 결과 토스트와 pushing 상태 관리를 기존 단건 push 흐름과 재사용
- 기존 remote 선택 모달과 force-confirm 계열 모달을 최대한 재사용하되, subtree 모드임을 구분할 수 있어야 한다

### 백엔드

- [jj.ts](/Users/keumky/Desktop/side-project/visual-jj-webview/packages/server/src/jj.ts)
  - 단건 bookmark push 외에 subtree push를 수행하는 래퍼를 추가하거나 기존 함수를 일반화한다
  - subtree push 명령은 `jj git push -r '<bookmark>::' --remote <remote>`를 기준으로 한다
- [routes.ts](/Users/keumky/Desktop/side-project/visual-jj-webview/packages/server/src/routes.ts)
  - 기존 `/api/push` 엔드포인트를 확장하거나 subtree 전용 엔드포인트를 추가한다
  - 추천 방향은 기존 `/api/push`에 `scope: 'bookmark' | 'subtree'`를 추가하는 방식이다

### API 초안

```ts
POST /api/push?cwd=...

interface PushRequest {
  bookmark: string
  remote: string
  scope?: 'bookmark' | 'subtree'
  force?: boolean
}
```

- `scope` 기본값은 `'bookmark'`
- `scope === 'subtree'`이면 서버는 `jj git push -r '<bookmark>::'` 경로를 사용한다

---

## 상태 및 메시지 규칙

- 메뉴 항목은 descendant 유무와 관계없이 항상 표시한다.
- subtree push의 로딩 표시는 "시작한 bookmark" 기준으로 한다.
- 성공 메시지는 subtree push였다는 점이 드러나야 한다.
- 정보 메시지는 "already up to date" 성격을 유지한다.
- 에러 메시지는 jj stderr를 최대한 그대로 노출한다.

---

## 구현 시 주의사항

- 이 기능은 descendant bookmark 목록을 클라이언트에서 직접 계산해서 여러 번 push하는 방식이 아니라, jj revset 한 번으로 처리하는 방향을 우선한다.
- 따라서 기존 `utils/graph.ts`의 descendants 계산은 UI 표시나 향후 개선에는 쓸 수 있지만, subtree push의 정합성 자체는 서버의 `jj git push -r` 실행이 책임진다.
- remote 선택은 기존 흐름을 재사용하되, 확인 모달은 remote 선택보다 앞선다.
- 기존 `Push this bookmark`와 토스트/에러 UX가 크게 어긋나지 않도록 문구와 타이밍을 맞춘다.

---

## 리스크 및 확인 필요 사항

- 현재 로컬 환경의 `jj 0.38.0` 도움말에는 `jj git push`의 subtree 대상 지정용 `-r/--revisions`는 확인되지만, 명시적인 force push 플래그는 바로 보이지 않는다.
- 따라서 "실패 후 다시 물어본 뒤 재시도"는 제품 요구사항으로 유지하되, 실제 재시도 CLI는 구현 전에 jj 버전 기준으로 검증해야 한다.
- 확인 모달에서 subtree에 포함될 bookmark 목록이나 개수를 보여줄지는 아직 미정이다. 이번 PRD 범위에서는 필수 요구사항으로 두지 않는다.

---

## 구현 순서 제안

1. 서버에서 subtree push CLI 래퍼를 추가한다.
2. `/api/push`에 subtree scope를 추가한다.
3. 클라이언트의 bookmark 컨텍스트 메뉴에 새 항목을 추가한다.
4. subtree push 전용 확인 모달 상태를 추가한다.
5. 기존 remote 선택 및 토스트 흐름과 연결한다.
6. rejected 계열 실패 시 재확인 UX를 정리한다.

---

## 결정 요약

- 하위 범위 정의: `jj git push -r '<bookmark>::'`
- 메뉴 항목: 기존 단건 push와 별개로 새 항목 추가
- 확인 단계: 필수
- remote 선택: 기존 흐름 재사용
- 하위 bookmark 없음: 메뉴는 그대로 표시하고 동일 흐름 유지
- 실패 후 destructive retry: 자동 진행 금지, 반드시 다시 묻기
