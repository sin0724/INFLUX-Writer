'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CreatorStats {
  creator: string;
  total: number;
  done: number;
  processing: number;
  error: number;
  pending: number;
  completionRate: number;
  lastCreatedAt: string | null;
  avgCompletionTime: number | null;
}

export default function CreatorStatsPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState<CreatorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'total' | 'done' | 'completionRate'>('total');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const sessionStr = localStorage.getItem('admin_session');
      if (!sessionStr) {
        router.push('/login');
        return;
      }
      const session = JSON.parse(sessionStr);
      if (!session || !session.username) {
        router.push('/login');
        return;
      }

      // 슈퍼 어드민만 접근 가능
      if (session.role !== 'super_admin') {
        alert('권한이 없습니다. 슈퍼 어드민만 접근할 수 있습니다.');
        router.push('/');
        return;
      }

      setSession(session);
      fetchStats();
    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats/creators');
      if (res.status === 403) {
        alert('권한이 없습니다.');
        router.push('/');
        return;
      }
      const data = await res.json();
      setStats(data.stats || []);
    } catch (error) {
      console.error('통계 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: 'total' | 'done' | 'completionRate') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedStats = [...stats].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    if (sortBy === 'total') {
      aValue = a.total;
      bValue = b.total;
    } else if (sortBy === 'done') {
      aValue = a.done;
      bValue = b.done;
    } else {
      aValue = a.completionRate;
      bValue = b.completionRate;
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return '-';
    if (minutes < 60) {
      return `${Math.round(minutes)}분`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}시간 ${mins}분`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">생성자별 업무 통계</h1>
              <p className="text-gray-600">각 생성자별 작업 생성 현황 및 성과를 확인할 수 있습니다</p>
            </div>
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-gray-700 transition-colors"
            >
              메인으로
            </Link>
          </div>
        </div>

        {/* 요약 통계 카드 */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">전체 생성자 수</div>
            <div className="text-3xl font-bold text-gray-900">{stats.length}</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">총 작업 수</div>
            <div className="text-3xl font-bold text-blue-600">
              {stats.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">원고 작성 완료된 작업</div>
            <div className="text-3xl font-bold text-green-600">
              {stats.reduce((sum, s) => sum + s.done, 0).toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="text-sm text-gray-600 mb-2">평균 완료율</div>
            <div className="text-3xl font-bold text-purple-600">
              {stats.length > 0
                ? Math.round(
                    stats.reduce((sum, s) => sum + s.completionRate, 0) / stats.length
                  )
                : 0}
              %
            </div>
          </div>
        </div>

        {/* 통계 테이블 */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">생성자</th>
                  <th
                    className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-blue-600 transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center gap-2">
                      전체 작업
                      {sortBy === 'total' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-blue-600 transition-colors"
                    onClick={() => handleSort('done')}
                  >
                    <div className="flex items-center gap-2">
                      원고 작성 완료
                      {sortBy === 'done' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left font-semibold">처리 중</th>
                  <th className="px-6 py-4 text-left font-semibold">대기 중</th>
                  <th className="px-6 py-4 text-left font-semibold">에러</th>
                  <th
                    className="px-6 py-4 text-left font-semibold cursor-pointer hover:bg-blue-600 transition-colors"
                    onClick={() => handleSort('completionRate')}
                  >
                    <div className="flex items-center gap-2">
                      완료율
                      {sortBy === 'completionRate' && (
                        <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left font-semibold">평균 완료 시간</th>
                  <th className="px-6 py-4 text-left font-semibold">최근 생성일</th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sortedStats.map((stat, index) => (
                    <tr
                      key={stat.creator}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 font-semibold text-gray-900">
                        {stat.creator}
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-medium">
                        {stat.total.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-green-600 font-semibold">
                          {stat.done.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-blue-600 font-medium">
                          {stat.processing.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-yellow-600 font-medium">
                          {stat.pending.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-red-600 font-medium">
                          {stat.error.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                            <div
                              className={`h-2 rounded-full ${
                                stat.completionRate >= 80
                                  ? 'bg-green-500'
                                  : stat.completionRate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${stat.completionRate}%` }}
                            />
                          </div>
                          <span className="text-gray-700 font-semibold min-w-[45px]">
                            {stat.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatTime(stat.avgCompletionTime)}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {formatDate(stat.lastCreatedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

