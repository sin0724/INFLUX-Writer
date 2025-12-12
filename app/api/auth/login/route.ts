import { NextRequest, NextResponse } from 'next/server';
import { login, setServerSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { username, password } = body;

    // username과 password 앞뒤 공백 제거
    if (username) username = username.trim();
    if (password) password = password.trim();

    if (!username || !password) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    // 빈 문자열 체크
    if (username.length === 0 || password.length === 0) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const session = await login(username, password);

    if (!session) {
      // 로그인 실패 시 더 구체적인 메시지 (보안을 위해 일반적인 메시지 유지)
      console.error(`로그인 실패 시도 - username: "${username}"`);
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    await setServerSession(session);

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error('로그인 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

