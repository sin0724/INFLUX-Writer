import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;
    const body = await request.json();
    const { downloaded_by } = body;

    if (!downloaded_by) {
      return NextResponse.json({ error: '다운로드한 사용자 정보가 필요합니다.' }, { status: 400 });
    }

    // Job의 다운로드 정보 업데이트
    const { data: job, error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        downloaded_by,
        downloaded_at: new Date().toISOString(),
      })
      .eq('id', jobId)
      .select()
      .single();

    if (updateError || !job) {
      return NextResponse.json({ error: '다운로드 정보 업데이트 실패', details: updateError }, { status: 500 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    console.error('다운로드 API 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

