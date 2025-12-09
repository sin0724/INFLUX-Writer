# INFLUX Writer

내부 직원 전용 AI 원고 자동 생성 시스템

## 기술 스택

- **Next.js 14** (App Router)
- **TypeScript**
- **Supabase** (Database + Storage)
- **TailwindCSS**
- **Anthropic Claude SDK** (@anthropic-ai/sdk)
- **모델**: claude-sonnet-4-5-20250929 (스냅샷 ID)

## 주요 기능

- 업체(Client) 관리
- Vision 분석 기반 원고 생성
- 후기형/정보형 글 자동 생성
- 업종별 자동 스타일 적용
- 플레이스 링크 자동 삽입
- 문장 패턴 랜덤 적용

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Anthropic Claude API Keys (JSON 배열 형식)
CLAUDE_API_KEYS=["key1","key2","key3","key4","key5","key6"]
```

### 3. Supabase 설정

1. Supabase 프로젝트 생성
2. `supabase-schema.sql` 파일의 내용을 Supabase SQL Editor에서 실행
3. Storage에서 `job-images` 버킷 생성 (Public 액세스 허용)

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 배포

Railway로 배포하는 방법은 [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) 파일을 참고하세요.

## 사용 방법

### 1. 업체 등록

- `/clients` 페이지에서 업체를 등록합니다.
- 업체명, 플레이스 URL, 업종, 기본 가이드를 입력합니다.

### 2. 원고 생성

- `/jobs/new` 페이지에서 새 작업을 생성합니다.
- 업체 선택 후 가이드 텍스트를 입력합니다.
- 글 타입(후기형/정보형)과 길이(1000자/1500자)를 선택합니다.
- 필요시 이미지를 업로드합니다 (Vision 분석 수행).
- 생성 버튼을 클릭합니다.

### 3. 작업 확인

- `/jobs` 페이지에서 모든 작업 목록을 확인합니다.
- 작업 상세 페이지에서 생성된 원고를 확인하고 복사/다운로드할 수 있습니다.

## 시스템 구조

### API 키 관리

- 여러 Anthropic API 키를 라운드로빈 방식으로 순환 사용
- 에러 발생 시 해당 키를 일정 시간 제외 (쿨다운 5분)

### 프롬프트 엔진

- 업종별 자동 스타일 규칙 적용
- 문장 패턴 30개 중 4~7개 랜덤 적용
- 플레이스 링크 자동 삽입 (상단/중간/하단 랜덤)
- Vision 분석 결과를 Soft Embedding 방식으로 자연스럽게 녹여냄

### Vision 처리

- 이미지가 포함된 경우 Claude Vision으로 분석
- 분석 결과를 키워드로 추출하여 프롬프트에 포함
- 직접적인 문장 사용 금지, 간접적이고 자연스러운 표현만 사용

## 주의사항

⚠️ **중요**: Anthropic API는 반드시 공식 SDK(`@anthropic-ai/sdk`)의 `messages.create()` 메서드만 사용합니다.

- 절대로 `axios`나 `fetch`로 직접 호출하지 마세요.
- 절대로 `/v1/complete` 또는 `/v1/completions` 엔드포인트를 사용하지 마세요.
- `anthropic-version` 헤더는 SDK가 자동 설정하므로 수동으로 설정하지 마세요.

## 프로젝트 구조

```
.
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   ├── clients/           # 업체 관리 페이지
│   ├── jobs/              # 작업 관련 페이지
│   └── layout.tsx         # 레이아웃
├── lib/                   # 유틸리티 및 설정
│   ├── anthropicClient.ts # Anthropic 클라이언트 (라운드로빈)
│   ├── promptEngine.ts    # 프롬프트 엔진
│   ├── supabase.ts        # Supabase 클라이언트
│   └── types.ts           # TypeScript 타입 정의
└── supabase-schema.sql    # 데이터베이스 스키마
```

## 라이선스

내부 사용 전용

