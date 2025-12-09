import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    // Job 조회 (최신 데이터를 위해 캐시 없이 조회)
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: '작업을 찾을 수 없습니다.' }, { status: 404 });
    }

    // Article 조회
    const { data: article, error: articleError } = await supabaseAdmin
      .from('articles')
      .select('*')
      .eq('job_id', jobId)
      .single();

    // 이미지 조회
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('job_images')
      .select('*')
      .eq('job_id', jobId);

    // 클라이언트 정보
    const { data: client } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', job.client_id)
      .single();

    return NextResponse.json({
      job,
      article: article || null,
      images: images || [],
      client: client || null,
    });
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id;

    // 1. 이미지 파일 삭제 (Storage에서)
    const { data: images, error: imagesError } = await supabaseAdmin
      .from('job_images')
      .select('storage_path')
      .eq('job_id', jobId);

    if (!imagesError && images && images.length > 0) {
      const imagePaths = images.map((img: any) => img.storage_path);
      const { error: storageError } = await supabaseAdmin.storage
        .from('job-images')
        .remove(imagePaths);

      if (storageError) {
        console.error('이미지 Storage 삭제 오류:', storageError);
        // Storage 삭제 실패해도 계속 진행
      }
    }

    // 2. Job 삭제 (CASCADE로 articles, job_images도 자동 삭제됨)
    const { error: deleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', jobId);

    if (deleteError) {
      return NextResponse.json({ error: '작업 삭제 실패', details: deleteError }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '작업이 삭제되었습니다.' });
  } catch (error) {
    console.error('작업 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}
