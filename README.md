# SQLD Study Site

개인 학습 문서를 웹에서 읽기 좋은 형태로 제공하기 위해 만든 문서형 학습 사이트다.
Cloudflare Worker와 KV를 이용한 비밀번호 보호, 문서 검색, 반응형 레이아웃, PostgreSQL 실습 자료 화면을 포함한다.

> 공개 저장소에는 원본 학습 문서와 생성된 개인 문서 데이터가 들어 있지 않다.
> 저장소를 내려받으면 개인정보 없는 공개 데모 데이터로 바로 실행된다.

## 주요 기능

- 비밀번호로 보호되는 문서 사이트
- Cloudflare KV 기반 문서·검색 API와 로컬 fallback
- 문서별 목차와 현재 읽는 위치 표시
- 접을 수 있는 왼쪽 탐색 메뉴와 모바일 대응 레이아웃
- SQL·YAML 코드 보기 및 다운로드
- PostgreSQL + Docker Compose 실습 흐름을 보여주는 데모
- 문항 본문의 자연어 정렬 조건과 PK·FK를 포함한 실습 스키마 참조
- 실습 페이지에서만 지연 로드되는 PostgreSQL WASM 쿼리 실행·결과 채점기
- Markdown 렌더링, 링크, 가독성 규칙을 확인하는 테스트

## 구조

```text
로컬 원본 문서
      │  공개 저장소에 포함하지 않음
      ▼
동기화·편집 레이어 ──▶ 무시되는 생성 데이터 ──▶ Worker / KV
                              │
                              └─ 공개 저장소에서는 public-content.json 사용
```

원본 문서가 없는 환경에서는 `data/public-content.json`을 사용한다. 개인 문서에서 생성되는
`data/content.json`, `data/kv-bulk.json`, `src/generated/content.ts`와 운영용 Wrangler 설정은 Git에서 제외한다.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| UI | TypeScript, Vite, CSS |
| Edge | Cloudflare Workers |
| 문서 데이터 | Cloudflare KV |
| 브라우저 SQL 실행 | PGlite (PostgreSQL WASM) |
| Markdown | Marked, sanitize-html |
| 검증 | Node test runner, TypeScript, Wrangler dry-run |

## 로컬 실행

```bash
npm install
cp .dev.vars.example .dev.vars
npm test
npm run dev:worker
```

`.dev.vars`에는 로컬에서 사용할 비밀번호를 직접 입력한다. `npm run dev:worker`는 Worker 인증과 문서 API까지 함께 실행한다.

원본 문서가 없는 일반적인 clone에서는 공개 데모 데이터로 동기화된다.
개인 문서를 연결하려면 커밋하지 않을 로컬 경로를 `SQLD_SOURCE_ROOT`로 지정한다.

```bash
SQLD_SOURCE_ROOT=/path/to/local/sql-study npm run build
```

`3-실습` 문제 페이지에는 `실행기 준비` 버튼이 표시된다. 버튼을 누른 뒤 PostgreSQL
문법으로 쿼리를 작성하면 브라우저 메모리에서 초기화된 실습 데이터에 실행하고, 문제의
정답 쿼리와 조회 결과 또는 최종 데이터 상태를 비교한다. PGlite와 WASM 파일은 이 버튼을
누를 때만 로드되며, 페이지를 나가면 실습 DB가 사라진다.
각 문제에는 정답 SQL에서 검증한 출력 컬럼 순서와 관련 테이블을 명시하되, 정렬 조건은
SQL 표현 대신 문제 문장에 자연어로 안내한다. 스키마 참조는 문제 페이지 위쪽과 브라우저
실습기 바로 위에서 모든 테이블·뷰 컬럼과 PK·FK 관계를 확인할 수 있다.
브라우저에서 채점하는 구조이므로 허용된 사용자는 개발자 도구에서 정답 데이터를 확인할 수
있다. 정답을 완전히 숨겨야 한다면 별도 서버 실행·채점 API가 필요하다.

## 검증 명령

```bash
npm test
npm run check
```

## Cloudflare 배포

운영 배포가 필요할 때만 로컬에서 설정 파일을 만든다.

```bash
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler secret put SQLD_SITE_PASSWORD
npm run deploy
```

`wrangler.jsonc`의 Worker 이름과 KV namespace ID는 자신의 Cloudflare 계정 값으로 채운다.
배포 명령은 문서를 빌드하고 KV를 업로드한 뒤 Worker를 배포한다.

## 개인정보 보호 경계

- 원본 Markdown 문서는 저장소에 포함하지 않는다.
- 생성된 문서 JSON·TypeScript와 KV bulk 파일은 저장소에 포함하지 않는다.
- 비밀번호와 운영용 Cloudflare 설정은 저장소에 포함하지 않는다.
- 공개 clone은 개인 문서가 아닌 데모 fixture만 사용한다.

## 프로젝트 구성

```text
src/worker.ts              Worker 라우팅·인증·문서 API
src/client/                문서 UI
src/client/practice-runner.ts  브라우저 PostgreSQL 실행·결과 비교
scripts/sync-content.mjs   원본 동기화와 공개 fixture fallback
scripts/practice-content.mjs  실습 문제·정답 메타데이터 생성
scripts/site-editorial.mjs 사이트 전용 문장·표현 보정
data/public-content.json   개인정보 없는 공개 데모 데이터
tests/                     콘텐츠·UI·보안 경계 테스트
```
