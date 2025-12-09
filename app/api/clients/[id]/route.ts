import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: '클라이언트를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clientId = params.id;

    // 클라이언트 삭제 (CASCADE로 관련 jobs, articles도 자동 삭제됨)
    const { error: deleteError } = await supabaseAdmin
      .from('clients')
      .delete()
      .eq('id', clientId);

    if (deleteError) {
      return NextResponse.json({ error: '업체 삭제 실패', details: deleteError }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '업체가 삭제되었습니다.' });
  } catch (error) {
    console.error('업체 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { data, error } = await supabaseAdmin
      .from('clients')
      .update(body)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: '업데이트 실패', details: error }, { status: 500 });
    }

    return NextResponse.json({ client: data });
  } catch (error) {
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

