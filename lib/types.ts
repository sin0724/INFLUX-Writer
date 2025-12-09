export interface Client {
  id: string;
  name: string;
  place_url: string | null;
  category: string | null;
  base_guide: string | null;
  keywords: string | null;
  default_style_id: string | null;
  memo: string | null;
  created_at: string;
}

export interface StylePreset {
  id: string;
  client_id: string | null;
  tone: string | null;
  length_hint: string | null;
  platform: string | null;
  extra_rules: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  client_id: string;
  style_preset_id: string | null;
  guide_text: string;
  human_extra_prompt: string | null;
  content_type: 'review' | 'info';
  length_hint: 1000 | 1500;
  status: 'pending' | 'processing' | 'done' | 'error';
  error_message: string | null;
  created_by: string | null;
  downloaded_by: string | null;
  downloaded_at: string | null;
  batch_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface JobImage {
  id: string;
  job_id: string;
  storage_path: string;
  created_at: string;
}

export interface Article {
  id: string;
  job_id: string;
  client_id: string;
  content: string;
  raw_prompt: string;
  model_name: string;
  created_at: string;
}

export interface Admin {
  id: string;
  username: string;
  password_hash: string;
  role: 'super_admin' | 'admin';
  created_at: string;
}

export type Category =
  | '피부과/에스테틱'
  | '네일/속눈썹'
  | '미용실'
  | '카페'
  | '맛집'
  | 'PT'
  | '반려동물'
  | '숙소'
  | '자동차/정비'
  | '인테리어'
  | '학원';
