# QA 테스트 문서 — visual-jj-webview 신규 기능

## 사전 준비

- `bun run dev`로 서버 실행 (port 7777)
- `bun run --cwd packages/client dev`로 클라이언트 dev server 실행
- 브라우저에서 `http://localhost:5173?cwd=/path/to/jj-repo` 접속
- 테스트용 jj 저장소에 여러 커밋, 북마크, 변경 파일이 있는 상태 준비
- git remote가 설정된 저장소 (push 테스트용)

---

## 1. Describe 기능

### TC-D01: 컨텍스트 메뉴에 Describe 항목 표시 (통과)
- 일반 커밋을 우클릭한다
- "Describe" 항목이 컨텍스트 메뉴에 표시되는지 확인 
- 예상: 메뉴에 "Describe" 항목이 보인다

### TC-D02: Immutable 커밋에서 Describe 비활성화 (통과)
- immutable 커밋(◆)을 우클릭한다
- "Describe" 항목이 비활성화(회색) 상태인지 확인
- 예상: 클릭 불가

### TC-D03: Describe 클릭 시 인라인 textarea 표시 (통과)
- 일반 커밋 우클릭 → "Describe" 클릭
- 해당 커밋 row 아래에 textarea가 펼쳐지는지 확인
- 예상: textarea + Save/Cancel 버튼이 인라인으로 표시

### TC-D04: 기존 description이 textarea에 미리 채워짐 (통과x → 수정됨: GET 라우트 method 체크 추가로 description fetch 정상화 -> 통과)
- description이 있는 커밋에서 Describe 실행
- 예상: textarea에 기존 전체 description이 표시됨

### TC-D05: 빈 description 처리 (통과x → 수정됨: TC-D04 수정으로 재테스트 필요 -> 통과 )
- `(no description set)` 커밋에서 Describe 실행
- 예상: textarea가 빈 상태로 표시 (placeholder 텍스트 없음)

### TC-D06: 멀티라인 description 입력 (통과x → 수정됨: TC-D07 수정으로 재테스트 필요 -> 통과)
- textarea에 여러 줄의 텍스트를 입력하고 Save 클릭
- 예상: 멀티라인 description이 정상 저장됨

### TC-D07: Save 버튼으로 저장 (통과x → 수정됨: GET 라우트 method 체크 추가로 POST /api/describe 정상 매칭 -> 통과)
- description을 수정하고 Save 클릭
- 예상: `jj describe` 실행, 그래프 자동 갱신, textarea 닫힘

### TC-D08: Cancel 버튼으로 취소 (통과)
- description을 수정하고 Cancel 클릭
- 예상: 변경사항 없이 textarea 닫힘

### TC-D09: 한 번에 하나의 describe editor만 열림 (통과)
- 커밋 A에서 Describe 열기 → 커밋 B에서 Describe 열기
- 예상: 커밋 A의 editor가 닫히고 커밋 B의 editor만 열림

---

## 2. 북마크 관리 기능

### TC-B01: Create bookmark 메뉴 항목 (통과)
- 커밋 우클릭 → "Create bookmark" 클릭
- 예상: 이름 입력 모달이 표시됨

### TC-B02: 북마크 생성 (통과x → 수정됨: GET 라우트 method 체크 추가로 POST /api/bookmark/create 정상 매칭 -> 통과x → 재수정: stderr 캡처 에러 메시지 개선, 재테스트 필요)
- 모달에 이름 입력 → Create 클릭
- 예상: 북마크가 생성되고 그래프에 badge 표시

### TC-B03: 빈 이름으로 생성 시도 (통과x → 재수정: disabled 버튼 시각적 스타일 추가 (opacity 0.4, cursor not-allowed), 재테스트 필요)
- 모달에서 이름을 비워두고 Create 클릭
- 예상: Create 버튼 비활성화

### TC-B04: 북마크 badge 우클릭 컨텍스트 메뉴 (통과)
- 북마크 badge를 우클릭
- 예상: "Push this bookmark", "Move bookmark", "Rename bookmark", "Delete bookmark" 메뉴 표시

### TC-B05: Delete bookmark (통과x → 수정됨: TC-B02 수정으로 재테스트 필요)
- 북마크 badge 우클릭 → "Delete bookmark" 클릭
- 예상: 북마크 삭제, 그래프 갱신

### TC-B06: Rename bookmark (통과x → 수정됨: TC-B02 수정으로 재테스트 필요)
- 북마크 badge 우클릭 → "Rename bookmark" 클릭
- 예상: 기존 이름이 채워진 모달 표시
- 새 이름 입력 → Rename 클릭
- 예상: 이름 변경, 그래프 갱신

### TC-B07: Move bookmark — 대상 선택 (통과)
- 북마크 badge 우클릭 → "Move bookmark" 클릭
- 예상: 배너에 "destination 커밋을 클릭하세요" 안내 표시
- 다른 커밋 클릭
- 예상: 확인 단계로 전환, 소스/대상 정보 표시

### TC-B08: Move bookmark — 확인 및 실행 (통과x → 수정됨: TC-B02 수정으로 재테스트 필요)
- TC-B07 이후 "Move" 버튼 클릭
- 예상: 북마크 이동 완료, Undo 버튼 표시

### TC-B09: Move bookmark — Undo (통과x → 수정됨: TC-B02 수정으로 재테스트 필요)
- TC-B08 이후 "Undo" 버튼 클릭
- 예상: 이동 전 상태로 복원

### TC-B10: Move bookmark — ESC로 취소 (통과)
- Move bookmark 모드에서 ESC 키 누르기
- 예상: 이동 모드 취소, 배너 사라짐

### TC-B11: Rebase 모드와 배타적 제약 (통과)
- Rebase 모드 진입 중 Move bookmark 시도
- 예상: Move bookmark 시작 불가 

### TC-B12: Immutable 커밋에 북마크 생성 (통과x → 수정됨: ContextMenu 화면 밖 방지 위치 조정 추가)
- immutable 커밋 우클릭 → "Create bookmark"
- 예상: 정상적으로 북마크 생성 가능

---

## 3. 커밋 조작 기능 (Split / Squash / Move Changes)

### TC-C01: Split 메뉴 항목 (통과)
- 변경 파일이 있는 커밋 우클릭
- 예상: "Split" 항목이 활성화 상태

### TC-C02: Split — 파일 선택 모달 (통과)
- "Split" 클릭
- 예상: 파일 체크박스 모달 표시, 각 파일의 상태(A/M/D) 표시

### TC-C03: Split — 전체 선택/해제 (통과)
- 모달에서 "Select all" 체크박스 토글
- 예상: 모든 파일 선택/해제

### TC-C04: Split — 최소 1개 파일 남기기 제약 (통과x → 재수정: disabled 버튼 시각적 스타일 추가, 재테스트 필요 -> 통과)
- 모든 파일을 선택한 상태에서 Confirm 클릭
- 예상: 최소 1개는 원래 커밋에 남아야 하므로 Confirm 비활성화 (minUnselected=1)

### TC-C05: Split — 실행 및 Undo (통과x → 재수정: jj split에 -m 옵션 추가하여 에디터 열림 방지, 재테스트 필요)
- 일부 파일 선택 → Confirm
- 예상: 커밋이 두 개로 분할, Undo 버튼 표시
- Undo 클릭
- 예상: 분할 전 상태로 복원

### TC-C06: Squash into parent 메뉴 항목 (통과)
- 변경 파일이 있는 커밋 우클릭
- 예상: "Squash into parent" 항목 활성화
 
### TC-C07: Squash — 확인 모달 (통과)
- "Squash into parent" 클릭
- 예상: 소스 커밋과 부모 커밋 정보가 표시된 확인 모달

### TC-C08: Squash — 실행 및 Undo (통과x → 수정됨: GET 라우트 method 체크 추가로 POST /api/squash 정상 매칭, 재테스트 필요. -> 통과)
- 확인 모달에서 "Squash" 클릭
- 예상: 부모 커밋으로 합쳐짐, Undo 버튼 표시

### TC-C09: Move changes — 파일 선택 (통과)
- 커밋 우클릭 → "Move changes from here" 클릭
- 예상: 파일 선택 모달 표시

### TC-C10: Move changes — 대상 커밋 선택 (통과)
- 파일 선택 후 Confirm → 대상 커밋 클릭
- 예상: 배너에 소스/대상 정보 표시, 확인 단계

### TC-C11: Move changes — 실행 및 Undo (통과x → 수정됨: GET 라우트 method 체크 추가로 POST /api/move-changes 정상 매칭, 재테스트 필요 -> 통과)
- "Move" 버튼 클릭
- 예상: 변경사항 이동 완료, Undo 버튼 표시

### TC-C12: Move changes — ESC로 취소 (통과)
- Move changes 대상 선택 모드에서 ESC
- 예상: 모드 취소

### TC-C13: Immutable 커밋에서 비활성화 (통과)
- immutable 커밋 우클릭
- 예상: Split, Squash, Move changes 모두 비활성화

### TC-C14: Empty 커밋에서 비활성화 (통과x → 수정됨: squash는 empty 커밋에서도 활성화하도록 변경 -> 통과)
- empty 커밋 우클릭
- 예상: Split, Move changes는 비활성화, Squash는 활성화

### TC-C15: 상태머신 배타적 제약 (통과)
- Rebase 모드 중 Move changes 시도
- 예상: 시작 불가
- Bookmark move 모드 중 Split 시도
- 예상: 컨텍스트 메뉴 자체가 열리지 않음 (isAnyMoveMode)

---

## 4. Git Push 기능 (전체 통과x: bookmark 기능 고쳐지면 다시 테스트할 예정)

### TC-P01: Push this bookmark 메뉴 항목(통과)
- 북마크 badge 우클릭
- 예상: "Push this bookmark" 항목 표시

### TC-P02: Remote 1개일 때 바로 push (통과)
- remote가 1개인 저장소에서 "Push this bookmark" 클릭
- 예상: 바로 push 실행, 성공 토스트 표시

### TC-P03: Remote 여러 개일 때 선택 UI (통과)
- remote가 여러 개인 저장소에서 "Push this bookmark" 클릭
- 예상: remote 선택 드롭다운 모달 표시
- remote 선택 후 push 실행

### TC-P04: Push 성공 피드백 (통과x → 재수정: 토스트 위치를 오른쪽 위로 변경, 재테스트 필요)
- push 성공 시
- 예상: 녹색 토스트 "bookmark pushed to remote" 표시

### TC-P05: Already up to date 피드백 (통과x → 재수정: pushBookmark에서 stderr도 캡처하여 "Nothing changed" 감지, 재테스트 필요)
- 이미 동기화된 bookmark push 시
- 예상: 파란색 토스트 "already up to date" 표시

### TC-P06: Push 실패 피드백 (통과)
- push 실패 시 (인증 오류 등)
- 예상: 빨간색 에러 토스트 표시

### TC-P07: Non-fast-forward 시 Force push 확인 (통과)
- non-fast-forward 상황에서 push 시도
- 예상: "Force push?" 확인 다이얼로그 표시
- "Force Push" 클릭
- 예상: force push 실행

### TC-P08: 토스트 클릭으로 닫기 (통과x → 재수정: 토스트에 x 닫기 버튼 추가, 재테스트 필요)
- push 결과 토스트 클릭
- 예상: 토스트 사라짐

### TC-P09: Push 중 Pushing... 표시 (통과x → 확인: 코드상 pushingBookmarks 상태 전달 정상, push가 빠르게 완료되어 표시 안 보일 수 있음)
- push 진행 중 같은 bookmark badge 우클릭
- 예상: "Pushing..." 항목이 비활성화 상태로 표시

---

## 공통 테스트 (다시 테스트할예정)

### TC-G01: SSE 자동 갱신
- 모든 조작(describe, bookmark, split, squash, move, push) 후
- 예상: 그래프가 자동으로 갱신됨

### TC-G02: 에러 처리
- 잘못된 changeId로 API 호출 시
- 예상: ErrorBanner에 에러 메시지 표시

### TC-G03: 컨텍스트 메뉴 외부 클릭으로 닫기
- 컨텍스트 메뉴 열린 상태에서 외부 클릭
- 예상: 메뉴 닫힘

### TC-G04: 모달 외부 클릭으로 닫기
- 모달 열린 상태에서 overlay 클릭
- 예상: 모달 닫힘
