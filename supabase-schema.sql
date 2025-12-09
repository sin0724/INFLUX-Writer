-- Clients 테이블
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  place_url TEXT,
  category TEXT,
  base_guide TEXT,
  keywords TEXT,
  default_style_id UUID,
  memo TEXT,
  requires_confirmation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Style Presets 테이블
CREATE TABLE IF NOT EXISTS style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  tone TEXT,
  length_hint TEXT,
  platform TEXT,
  extra_rules TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs 테이블
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  style_preset_id UUID REFERENCES style_presets(id) ON DELETE SET NULL,
  guide_text TEXT NOT NULL,
  human_extra_prompt TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('review', 'info')),
  length_hint INTEGER NOT NULL CHECK (length_hint IN (1000, 1500)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'error')),
  error_message TEXT,
  created_by TEXT,
  downloaded_by TEXT,
  downloaded_at TIMESTAMPTZ,
  batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Job Images 테이블
CREATE TABLE IF NOT EXISTS job_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Articles 테이블
CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  raw_prompt TEXT NOT NULL,
  model_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admins 테이블
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_jobs_client_id ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_job_images_job_id ON job_images(job_id);
CREATE INDEX IF NOT EXISTS idx_articles_job_id ON articles(job_id);
CREATE INDEX IF NOT EXISTS idx_articles_client_id ON articles(client_id);
CREATE INDEX IF NOT EXISTS idx_style_presets_client_id ON style_presets(client_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- 초기 슈퍼어드민 계정은 스크립트로 생성하거나
-- Supabase 대시보드에서 직접 생성하세요.
-- 아이디: admin, 비밀번호: 1234

-- Storage Bucket 생성 (Supabase 대시보드에서 수동으로 생성하거나 RPC로 생성)
-- 또는 Supabase 대시보드에서 'job-images' 버킷을 생성하세요.
