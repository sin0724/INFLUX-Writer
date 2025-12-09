import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, place_url, category, base_guide, keywords, default_style_id, memo, requires_confirmation } = body;

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

