import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 세션 확인
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, place_url, category, base_guide, keywords, default_style_id, memo, requires_confirmation } = body;

    // 일반 어드민은 중복 체크 (슈퍼 어드민은 중복 허용)
    if (session.role === 'admin') {
      const { data: existingClient } = await supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('name', name)
        .single();

      if (existingClient) {
        return NextResponse.json({ 
          error: `이미 등록된 업체입니다: "${name}". 일반 어드민은 중복 업체를 등록할 수 없습니다.` 
        }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({
        name,
        place_url: place_url || null,
        category: category || null,
        base_guide: base_guide || null,
        keywords: keywords || null,
        default_style_id: default_style_id || null,
        memo: memo || null,
        requires_confirmation: requires_confirmation || false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: '클라이언트 생성 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: '조회 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ clients: data || [] });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

