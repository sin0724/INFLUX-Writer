import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 테스트 데이터 삭제 API
export async function DELETE(request: NextRequest) {
  try {
    // 1. Storage의 모든 이미지 먼저 삭제 (DB 레코드 삭제 전에)
    const { data: allImages, error: imagesError } = await supabaseAdmin
      .from('job_images')
      .select('storage_path');

    if (!imagesError && allImages && allImages.length > 0) {
      const imagePaths = allImages.map((img: any) => img.storage_path);
      const { error: storageError } = await supabaseAdmin.storage
        .from('job-images')
        .remove(imagePaths);

      if (storageError) {
        console.error('이미지 Storage 삭제 오류:', storageError);
      }
    }

    // 2. 모든 작업 삭제 (CASCADE로 articles, job_images도 자동 삭제)
    const { error: jobsError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 작업 삭제

    if (jobsError) {
      console.error('작업 삭제 오류:', jobsError);
    }

    // 3. 모든 업체 삭제 (CASCADE로 관련 데이터도 자동 삭제)
    const { error: clientsError } = await supabaseAdmin
      .from('clients')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 업체 삭제

    if (clientsError) {
      console.error('업체 삭제 오류:', clientsError);
    }

    return NextResponse.json({ 
      success: true, 
      message: '모든 테스트 데이터가 삭제되었습니다.' 
    });
  } catch (error) {
    console.error('테스트 데이터 삭제 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류', 
      details: String(error) 
    }, { status: 500 });
  }
}

