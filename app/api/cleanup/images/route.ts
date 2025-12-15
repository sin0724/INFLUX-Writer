import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // 14일(2주) 전 날짜 계산
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoISO = twoWeeksAgo.toISOString();

    // 14일(2주) 이상 된 이미지 레코드 조회
    const { data: oldImages, error: queryError } = await supabaseAdmin
      .from('job_images')
      .select('*')
      .lt('created_at', twoWeeksAgoISO);

    if (queryError) {
      console.error('이미지 조회 오류:', queryError);
      return NextResponse.json({ error: '이미지 조회 실패', details: queryError }, { status: 500 });
    }

    if (!oldImages || oldImages.length === 0) {
      return NextResponse.json({ 
        message: '삭제할 이미지가 없습니다.',
        deleted: 0 
      });
    }

    // Storage에서 이미지 삭제
    const deletedPaths: string[] = [];
    const failedPaths: string[] = [];

    for (const image of oldImages) {
      try {
        const { error: deleteError } = await supabaseAdmin.storage
          .from('job-images')
          .remove([image.storage_path]);

        if (deleteError) {
          console.error(`이미지 삭제 실패 (${image.storage_path}):`, deleteError);
          failedPaths.push(image.storage_path);
        } else {
          deletedPaths.push(image.storage_path);
        }
      } catch (error) {
        console.error(`이미지 삭제 오류 (${image.storage_path}):`, error);
        failedPaths.push(image.storage_path);
      }
    }

    // DB에서 이미지 레코드 삭제
    const { error: deleteError } = await supabaseAdmin
      .from('job_images')
      .delete()
      .lt('created_at', twoWeeksAgoISO);

    if (deleteError) {
      console.error('DB 레코드 삭제 오류:', deleteError);
    }

    return NextResponse.json({
      success: true,
      message: `${deletedPaths.length}개의 이미지가 삭제되었습니다.`,
      deleted: deletedPaths.length,
      failed: failedPaths.length,
      deletedPaths: deletedPaths.slice(0, 10), // 처음 10개만 반환
    });
  } catch (error) {
    console.error('이미지 정리 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류', 
      details: String(error) 
    }, { status: 500 });
  }
}

// GET 요청으로도 실행 가능 (수동 실행용)
export async function GET(request: NextRequest) {
  return POST(request);
}

