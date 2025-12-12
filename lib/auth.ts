import { cookies } from 'next/headers';
import { supabaseAdmin } from './supabase';
import bcrypt from 'bcryptjs';

export interface AdminSession {
  id: string;
  username: string;
  role: 'super_admin' | 'admin';
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function login(username: string, password: string): Promise<AdminSession | null> {
  // username 앞뒤 공백 제거 및 정규화
  const normalizedUsername = username.trim();
  
  if (!normalizedUsername || !password) {
    console.error('로그인 시도: username 또는 password가 비어있음');
    return null;
  }

  // 데이터베이스에서 사용자 조회
  const { data: admin, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('username', normalizedUsername)
    .single();

  if (error) {
    // 에러가 있지만 사용자를 찾지 못한 경우 (PGRST116)
    if (error.code === 'PGRST116') {
      console.error(`로그인 실패: 사용자를 찾을 수 없음 - username: "${normalizedUsername}"`);
    } else {
      console.error('로그인 오류:', error);
    }
    return null;
  }

  if (!admin) {
    console.error(`로그인 실패: 사용자를 찾을 수 없음 - username: "${normalizedUsername}"`);
    return null;
  }

  // 비밀번호 검증
  const isValid = await verifyPassword(password, admin.password_hash);
  if (!isValid) {
    console.error(`로그인 실패: 비밀번호 불일치 - username: "${normalizedUsername}"`);
    return null;
  }

  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
  };
}

// 서버 사이드 세션 관리 (cookies 사용)
export async function getServerSession(): Promise<AdminSession | null> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('admin_session')?.value;

    if (!sessionId) {
      return null;
    }

    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, role')
      .eq('id', sessionId)
      .single();

    if (error || !admin) {
      return null;
    }

    return {
      id: admin.id,
      username: admin.username,
      role: admin.role,
    };
  } catch {
    return null;
  }
}

export async function setServerSession(session: AdminSession) {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set('admin_session', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
  });
}

export async function clearServerSession() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.delete('admin_session');
}

// 클라이언트 사이드용 세션 관리
export function getClientSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  const sessionStr = localStorage.getItem('admin_session');
  if (!sessionStr) return null;
  try {
    return JSON.parse(sessionStr);
  } catch {
    return null;
  }
}

export function setClientSession(session: AdminSession) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_session', JSON.stringify(session));
}

export function clearClientSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_session');
}

