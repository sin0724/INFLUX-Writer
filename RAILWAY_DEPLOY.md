# Railway 배포 가이드

## 📋 배포 전 준비사항

### 1. GitHub 저장소 준비
- 프로젝트를 GitHub에 푸시합니다
- `.env.local` 파일은 **절대 커밋하지 마세요** (이미 `.gitignore`에 포함됨)

### 2. 필요한 정보 수집
- Supabase 프로젝트 URL 및 키들
- Anthropic Claude API 키들 (여러 개 권장)
- Super Admin 초기화 시크릿 (선택사항)

---

## 🚀 Railway 배포 단계

### 1단계: Railway 계정 생성 및 로그인

1. [Railway](https://railway.app) 접속
2. "Start a New Project" 클릭
3. GitHub 계정으로 로그인 (또는 이메일로 가입)

### 2단계: 새 프로젝트 생성

1. **"New Project"** 클릭
2. **"Deploy from GitHub repo"** 선택
3. GitHub 저장소 선택
4. 저장소 연결 확인

### 3단계: 환경 변수 설정

Railway 대시보드에서 프로젝트 → **Variables** 탭으로 이동하여 다음 환경 변수를 추가합니다:

#### 필수 환경 변수

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Anthropic Claude API Keys (JSON 배열 형식)
CLAUDE_API_KEYS=["sk-ant-api03-xxx","sk-ant-api03-yyy","sk-ant-api03-zzz"]

# Super Admin 초기화 시크릿 (선택사항, 보안을 위해 설정 권장)
SUPER_ADMIN_INIT_SECRET=your_random_secret_string_here
```

#### 환경 변수 입력 방법

1. Railway 대시보드 → 프로젝트 → **Variables** 탭
2. **"New Variable"** 클릭
3. 각 변수를 하나씩 추가:
   - **Name**: 변수 이름 (예: `NEXT_PUBLIC_SUPABASE_URL`)
   - **Value**: 변수 값
   - **참고**: `CLAUDE_API_KEYS`는 JSON 배열 형식으로 입력 (큰따옴표 포함)

#### ⚠️ 중요: CLAUDE_API_KEYS 입력 형식

```json
["key1","key2","key3","key4","key5","key6"]
```

- 큰따옴표(`"`)로 감싸야 함
- 쉼표로 구분
- 대괄호(`[]`)로 배열 표시

### 4단계: 빌드 설정 확인

Railway는 Next.js를 자동으로 감지하지만, 다음을 확인하세요:

1. 프로젝트 → **Settings** 탭
2. **Build Command**: `npm run build` (자동 설정됨)
3. **Start Command**: `npm start` (자동 설정됨)
4. **Root Directory**: `.` (루트 디렉토리)

### 5단계: 배포 실행

1. 환경 변수 설정 완료 후
2. Railway가 자동으로 배포를 시작합니다
3. **Deployments** 탭에서 배포 진행 상황 확인

### 6단계: 도메인 설정 (선택사항)

1. 프로젝트 → **Settings** → **Networking**
2. **Generate Domain** 클릭하여 무료 도메인 생성
3. 또는 **Custom Domain** 추가

### 7단계: Super Admin 계정 생성

배포 완료 후, 다음 URL로 접속하여 Super Admin 계정을 생성합니다:

```
https://influx-writer-production.up.railway.app/api/init/super-admin
```

**실제 배포 주소:** https://influx-writer-production.up.railway.app

**주의**: 
- `SUPER_ADMIN_INIT_SECRET`을 환경 변수로 설정했다면 해당 값을 사용
- 이 작업은 **한 번만** 실행하면 됩니다
- 계정 생성 후 이 엔드포인트는 비활성화하는 것을 권장합니다

### 8단계: 배포 확인

1. 배포된 URL로 접속
2. 로그인 페이지(`/login`)에서 생성한 Super Admin 계정으로 로그인
3. 기능 테스트:
   - 업체 등록
   - 원고 생성
   - 작업 목록 확인

---

## 🔧 문제 해결

### 빌드 실패 시

1. **Deployments** 탭에서 로그 확인
2. 일반적인 원인:
   - 환경 변수 누락
   - `CLAUDE_API_KEYS` 형식 오류 (JSON 배열이어야 함)
   - Supabase 연결 오류

### 환경 변수 확인

Railway 대시보드 → **Variables** 탭에서 모든 변수가 올바르게 설정되었는지 확인

### 로그 확인

1. 프로젝트 → **Deployments** → 최신 배포 클릭
2. **View Logs** 클릭하여 상세 로그 확인

---

## 📝 배포 후 체크리스트

- [ ] 모든 환경 변수 설정 완료
- [ ] 배포 성공 확인
- [ ] Super Admin 계정 생성
- [ ] 로그인 테스트
- [ ] 업체 등록 테스트
- [ ] 원고 생성 테스트
- [ ] Supabase Storage 버킷(`job-images`) 생성 확인
- [ ] 이미지 업로드 테스트

---

## 🔐 보안 권장사항

1. **SUPER_ADMIN_INIT_SECRET** 설정 필수
2. **CLAUDE_API_KEYS**는 여러 개 사용하여 라운드로빈 적용
3. Railway의 환경 변수는 암호화되어 저장됨
4. Super Admin 초기화 후 해당 엔드포인트 비활성화 고려

---

## 📞 추가 도움말

- [Railway 공식 문서](https://docs.railway.app)
- [Next.js 배포 가이드](https://nextjs.org/docs/deployment)

