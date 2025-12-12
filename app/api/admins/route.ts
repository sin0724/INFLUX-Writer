import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 세션 확인
    const session = await getServerSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    let { username, password, role } = body;

    // username과 password 앞뒤 공백 제거
    if (username) username = username.trim();
    if (password) password = password.trim();

    if (!username || !password || !role) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 빈 문자열 체크
    if (username.length === 0 || password.length === 0) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    if (role !== 'super_admin' && role !== 'admin') {
      return NextResponse.json({ error: '올바른 역할을 선택해주세요.' }, { status: 400 });
    }

    // 중복 사용자명 체크
    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('id, username')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ error: `이미 존재하는 아이디입니다: "${username}"` }, { status: 400 });
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password);

    // 어드민 생성
    const { data, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        role,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: '어드민 생성 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ admin: { id: data.id, username: data.username, role: data.role } });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // 세션 확인
    const session = await getServerSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('admins')
      .select('id, username, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: '조회 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ admins: data || [] });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

