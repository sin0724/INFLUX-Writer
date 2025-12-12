import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 슈퍼 어드민만 접근 가능
    const session = await getServerSession();
    if (!session || session.role !== 'super_admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    // 모든 작업 조회
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('jobs')
      .select('id, created_by, status, created_at, completed_at')
      .order('created_at', { ascending: false });

    if (jobsError) {
      return NextResponse.json({ error: '작업 조회 실패', details: jobsError }, { status: 500 });
    }

    // 생성자별로 통계 집계
    const creatorStats: Record<string, {
      creator: string;
      total: number;
      done: number;
      processing: number;
      error: number;
      pending: number;
      completionRate: number;
      lastCreatedAt: string | null;
      avgCompletionTime: number | null; // 평균 완료 시간 (분)
    }> = {};

    jobs?.forEach((job) => {
      const creator = job.created_by || '미지정';
      
      if (!creatorStats[creator]) {
        creatorStats[creator] = {
          creator,
          total: 0,
          done: 0,
          processing: 0,
          error: 0,
          pending: 0,
          completionRate: 0,
          lastCreatedAt: null,
          avgCompletionTime: null,
        };
      }

      const stats = creatorStats[creator];
      stats.total++;
      
      if (job.status === 'done') {
        stats.done++;
      } else if (job.status === 'processing') {
        stats.processing++;
      } else if (job.status === 'error') {
        stats.error++;
      } else if (job.status === 'pending') {
        stats.pending++;
      }

      // 최근 생성일 업데이트
      if (!stats.lastCreatedAt || new Date(job.created_at) > new Date(stats.lastCreatedAt)) {
        stats.lastCreatedAt = job.created_at;
      }
    });

    // 완료율 및 평균 완료 시간 계산
    Object.values(creatorStats).forEach((stats) => {
      stats.completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
      
      // 해당 생성자의 완료된 작업들의 완료 시간 계산
      const creatorCompletedJobs = jobs?.filter(
        (job) => job.created_by === stats.creator && job.status === 'done' && job.completed_at
      ) || [];
      
      if (creatorCompletedJobs.length > 0) {
        const totalMinutes = creatorCompletedJobs.reduce((sum, job) => {
          if (job.completed_at) {
            const created = new Date(job.created_at).getTime();
            const completed = new Date(job.completed_at).getTime();
            const minutes = (completed - created) / (1000 * 60);
            return sum + minutes;
          }
          return sum;
        }, 0);
        
        stats.avgCompletionTime = Math.round(totalMinutes / creatorCompletedJobs.length);
      }
    });

    // 배열로 변환하고 정렬 (전체 생성 건수 기준 내림차순)
    const statsArray = Object.values(creatorStats).sort((a, b) => b.total - a.total);

    return NextResponse.json({ stats: statsArray });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류', details: String(error) }, { status: 500 });
  }
}

