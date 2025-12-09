import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batchId = params.batchId;

    // 배치 ID로 모든 작업 조회
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('*, clients(name)')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: false });

    if (jobsError) {
      return NextResponse.json({ error: '작업 조회 실패', details: jobsError }, { status: 500 });
    }

    // 각 작업의 원고와 이미지 조회
    const jobsWithDetails = await Promise.all(
      (jobs || []).map(async (job: any) => {
        const [articleRes, imagesRes] = await Promise.all([
          supabaseAdmin
            .from('articles')
            .select('*')
            .eq('job_id', job.id)
            .single(),
          supabaseAdmin
            .from('job_images')
            .select('*')
            .eq('job_id', job.id),
        ]);

        return {
          job,
          article: articleRes.data || null,
          images: imagesRes.data || [],
          client_name: job.clients?.name || null,
        };
      })
    );

    return NextResponse.json({ jobs: jobsWithDetails });
  } catch (error) {
    console.error('배치 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

