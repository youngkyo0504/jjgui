# visual-jj (jjgui)

Jujutsu(jj) 버전 관리 시스템을 위한 웹 기반 GUI.

커밋 그래프를 SVG로 시각화하고, 브라우저에서 rebase, split, squash, bookmark 관리 등 주요 jj 작업을 수행할 수 있습니다.

## 요구사항

- [Bun](https://bun.sh) v1.0+
- [Jujutsu (jj)](https://github.com/martinvonz/jj) CLI

## 빠른 시작

```bash
# jj 저장소에서 실행
bun run bin/jjgui.ts .

# 또는 경로 지정
bun run bin/jjgui.ts /path/to/jj-repo

# 서버 종료
bun run bin/jjgui.ts stop
```

서버가 자동으로 백그라운드에서 실행되고 브라우저가 열립니다.

## CLI 옵션

```bash
bun run bin/jjgui.ts [--opener=auto|browser|cmux] [path]
```

| 옵션 | 설명 |
|------|------|
| `path` | jj 저장소 경로 (기본값: `.`) |
| `--opener=auto` | 환경에 따라 자동 선택 (기본값) |
| `--opener=browser` | 항상 시스템 브라우저로 열기 |
| `--opener=cmux` | 항상 cmux 내장 브라우저로 열기 |
| `stop` | 실행 중인 서버 종료 |

## 설정 파일

`~/.jjgui/config.toml`에 기본 설정을 지정할 수 있습니다. 파일이 없으면 기본값으로 동작합니다.

### 설정 파일 만들기

```bash
mkdir -p ~/.jjgui
touch ~/.jjgui/config.toml
```

### 전체 설정 예시

```toml
# ~/.jjgui/config.toml
#
# 브라우저 열기 방식
# - "auto"    : CMUX_SURFACE_ID 환경변수가 있으면 cmux, 없으면 시스템 브라우저 (기본값)
# - "browser" : 항상 시스템 기본 브라우저 (Safari, Chrome 등)
# - "cmux"    : 항상 cmux 내장 브라우저
opener = "auto"

# cmux 관련 설정 (opener가 "cmux"이거나 auto로 cmux가 선택될 때 적용)
[cmux]
# 열기 모드
# - "tab"   : 새 탭으로 열기 (기본값)
# - "split" : 화면 분할로 열기
openMode = "tab"

# split 방향 (openMode = "split"일 때만 적용)
# - "right" : 오른쪽으로 분할 (기본값)
# - "down"  : 아래로 분할
splitDirection = "right"
```

### 시나리오별 예시

cmux 사용자 — 별도 설정 없이 자동 감지:
```toml
# config.toml이 없어도 됨
# cmux 내부에서 실행하면 자동으로 내장 브라우저 사용
```

cmux 사용자 — 항상 화면 분할로 열기:
```toml
opener = "cmux"

[cmux]
openMode = "split"
splitDirection = "right"
```

cmux 내부에서도 항상 시스템 브라우저 사용:
```toml
opener = "browser"
```

### TOML 문법 참고

```toml
# 주석은 # 으로 시작

# 최상위 키 = 값 (따옴표로 감싸기)
opener = "auto"

# 섹션은 [이름] 으로 시작
[cmux]
# 섹션 안의 키 = 값
openMode = "tab"
splitDirection = "right"
```

### 설정 우선순위

높은 것이 우선 적용됩니다:

1. CLI 플래그 (`--opener=cmux`)
2. 설정 파일 (`~/.jjgui/config.toml`)
3. 환경변수 자동감지 (`opener = "auto"`일 때 `CMUX_SURFACE_ID` 확인)
4. 기본값 (`opener = "auto"`, `cmux.openMode = "tab"`, `cmux.splitDirection = "right"`)

### 에러 처리

- 설정 파일이 없으면 → 기본값으로 정상 동작
- TOML 파싱 실패 → 기본값으로 폴백 (에러 무시)
- 잘못된 opener 값 → 에러 메시지 출력 후 종료
- cmux 미설치 상태에서 cmux 모드 → 시스템 브라우저로 폴백

### cmux 연동

cmux 터미널 내부에서 실행하면 `CMUX_SURFACE_ID` 환경변수를 자동 감지하여 내장 브라우저로 엽니다. 별도 설정 없이 동작합니다.

## 기능

### 커밋 그래프
- SVG 기반 시각화 (원형 노드, 세로 연결선, Bezier 곡선 분기/병합)
- Working copy: 초록색 노드
- Immutable 커밋: 다이아몬드 형태
- 레인별 고유 색상
- 다크/라이트 테마 지원

### 커밋 조작 (우클릭 메뉴)
- Edit — working copy 변경
- New — 선택한 커밋 위에 새 커밋 생성
- Describe — 커밋 메시지 편집
- Split — 파일 단위로 커밋 분할
- Squash — 부모 커밋으로 합치기
- Move changes — 변경사항을 다른 커밋으로 이동
- Rebase — 서브트리 rebase (드래그 앤 드롭 방식)

### Bookmark 관리 (배지 우클릭)
- Create / Delete / Rename
- Move — 다른 커밋으로 이동
- Push — git remote에 push (force push 확인 포함)

### 파일 목록
- 커밋 행의 chevron(▸/▾) 클릭으로 변경 파일 인라인 표시
- 그래프 세로 라인 연속성 유지

### 실시간 갱신
- 파일 변경 시 SSE를 통해 자동으로 그래프 갱신
