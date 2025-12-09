import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const username = 'admin';
    const password = '1234';
    
    // 기존 계정 확인
    const { data: existing } = await supabaseAdmin
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (existing) {
      return NextResponse.json({ 
        message: '슈퍼어드민 계정이 이미 존재합니다.',
        admin: { username: existing.username, role: existing.role }
      });
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password);
    
    // 슈퍼어드민 생성
    const { data, error } = await supabaseAdmin
      .from('admins')
      .insert({
        username,
        password_hash: passwordHash,
        role: 'super_admin',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ 
        error: '슈퍼어드민 생성 실패', 
        details: error 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: '슈퍼어드민 계정이 생성되었습니다.',
      admin: { 
        id: data.id, 
        username: data.username, 
        role: data.role 
      }
    });
  } catch (error) {
    console.error('슈퍼어드민 생성 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류', 
      details: String(error) 
    }, { status: 500 });
  }
}

