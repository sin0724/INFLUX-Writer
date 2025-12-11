import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { processJobAsync } from '../../route';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    // 1. Job 조회
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 2. 오류 상태인지 확인
    if (job.status !== 'error') {
      return NextResponse.json({ error: '오류 상태인 작업만 재생성할 수 있습니다.' }, { status: 400 });
    }

    // 3. 이미지 경로 조회
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('job_images')
      .select('storage_path')
      .eq('job_id', jobId);

    if (imagesError) {
      return NextResponse.json({ error: '이미지 조회 실패', details: imagesError }, { status: 500 });
    }

    const imagePaths = images?.map((img: any) => img.storage_path) || [];

    // 4. 작업 상태를 pending으로 변경하고 에러 메시지 초기화
    const { error: updateError } = await supabaseAdmin
      .from('jobs')
      .update({
        status: 'pending',
        error_message: null,
      })
      .eq('id', jobId);

    if (updateError) {
      return NextResponse.json({ error: '작업 상태 업데이트 실패', details: updateError }, { status: 500 });
    }

    // 5. 기존 article이 있으면 삭제 (재생성을 위해)
    await supabaseAdmin
      .from('articles')
      .delete()
      .eq('job_id', jobId);

    // 6. 비동기로 작업 처리 시작
    processJobAsync(
      jobId,
      job.client_id,
      job.style_preset_id,
      job.guide_text,
      job.human_extra_prompt,
      job.content_type as 'review' | 'info',
      job.length_hint as 1000 | 1500,
      imagePaths
    ).catch((error) => {
      console.error('작업 재생성 처리 오류:', error);
    });

    return NextResponse.json({ 
      success: true, 
      message: '작업이 재생성되었습니다.',
      job_id: jobId 
    });
  } catch (error) {
    console.error('작업 재생성 API 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

