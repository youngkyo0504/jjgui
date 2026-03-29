# visual-jj

Jujutsu(jj) 버전 관리 시스템을 위한 웹 기반 GUI.

## 기능

- 커밋 그래프 시각화 — jj log를 브라우저에서 컬러 레인과 함께 렌더링
- 인터랙티브 rebase — 드래그 방식의 다단계 rebase 워크플로우 (소스 선택 → 대상 선택 → 확인)
- 커밋 조작 — edit, new, rebase, undo 등 주요 jj 명령을 UI에서 실행
- 파일 변경 내역 — 커밋 클릭 시 변경된 파일 목록(Added/Modified/Deleted) 표시
- 실시간 갱신 — 파일 시스템 감시 + SSE로 저장소 변경 시 자동 새로고침
- 멀티 저장소 — 하나의 서버에서 여러 jj 저장소를 동시에 관리
- 컨텍스트 메뉴 — 우클릭으로 커밋 액션 빠르게 접근 (immutable 커밋은 비활성)

## 기술 스택

| 영역 | 스택 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite |
| 백엔드 | Bun, TypeScript, SSE |
| CLI | `jjgui [path]` — 서버 자동 기동 후 브라우저 오픈 |

## 구조

```
bin/jjgui.ts          — CLI 진입점 (데몬 관리)
packages/client/      — React 프론트엔드
packages/server/      — Bun HTTP 서버 + 파일 감시 + jj CLI 래퍼
```
