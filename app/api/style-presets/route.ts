import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, tone, length_hint, platform, extra_rules } = body;

    const { data, error } = await supabaseAdmin
      .from('style_presets')
      .insert({
        client_id: client_id || null,
        tone: tone || null,
        length_hint: length_hint || null,
        platform: platform || null,
        extra_rules: extra_rules || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: '스타일 프리셋 생성 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ stylePreset: data });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');

    let query = supabaseAdmin.from('style_presets').select('*');

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: '조회 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ stylePresets: data || [] });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

