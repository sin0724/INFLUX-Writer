'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import Link from 'next/link';
import JSZip from 'jszip';
import { Job } from '@/lib/types';

interface JobWithClient extends Job {
  client_name?: string | null;
  article_content?: string | null;
}

interface JobGroup {
  batch_id: string | null;
  jobs: JobWithClient[];
  client_name: string | null;
  created_by: string | null;
  created_at: string;
  downloaded_by: string | null; // 배치 내 다운로드한 사람들
  download_count: number; // 다운로드된 작업 수
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobWithClient[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobWithClient[]>([]);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'client' | 'creator' | 'downloader' | 'content'>('all');
  const [downloadFilter, setDownloadFilter] = useState<'all' | 'downloaded' | 'not_downloaded'>('all');
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    // 초기 로드 및 사용자 정보 가져오기
    fetchJobs(false);
    const sessionStr = localStorage.getItem('admin_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        setCurrentUser(session.username || null);
      } catch (error) {
        console.error('세션 파싱 오류:', error);
      }
    }
  }, []);

  // filterType이 변경될 때 원고 내용 포함 여부 결정
  useEffect(() => {
    const shouldIncludeContent = filterType === 'content' || filterType === 'all';
    fetchJobs(shouldIncludeContent);
  }, [filterType]);

  // 검색 필터링 및 그룹화
  useEffect(() => {
    let filtered = jobs;

    // 다운로드 여부 필터 (배치 작업도 포함)
    if (downloadFilter === 'downloaded') {
      // 배치 작업의 경우: 배치 내 하나라도 다운로드된 작업이 있으면 배치 전체 포함
      const batchIds = new Set(jobs.filter((j) => j.batch_id).map((j) => j.batch_id));
      const batchHasDownloaded = new Set<string>();
      
      jobs.forEach((job) => {
        if (job.batch_id && job.downloaded_by) {
          batchHasDownloaded.add(job.batch_id);
        }
      });

      filtered = filtered.filter((job) => {
        if (job.downloaded_by) return true;
        if (job.batch_id && batchHasDownloaded.has(job.batch_id)) return true;
        return false;
      });
    } else if (downloadFilter === 'not_downloaded') {
      // 배치 작업의 경우: 배치 내 모든 작업이 다운로드되지 않았으면 배치 전체 포함
      const batchIds = new Set(jobs.filter((j) => j.batch_id).map((j) => j.batch_id));
      const batchAllNotDownloaded = new Set<string>();
      
            batchIds.forEach((batchId) => {
              if (!batchId) return;
              const batchJobs = jobs.filter((j) => j.batch_id === batchId);
              if (batchJobs.every((j) => !j.downloaded_by)) {
                batchAllNotDownloaded.add(batchId);
              }
            });

      filtered = filtered.filter((job) => {
        if (!job.downloaded_by && !job.batch_id) return true;
        if (job.batch_id && batchAllNotDownloaded.has(job.batch_id)) return true;
        return false;
      });
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      switch (filterType) {
        case 'client':
          filtered = filtered.filter((job) =>
            job.client_name?.toLowerCase().includes(query)
          );
          break;
        case 'creator':
          filtered = filtered.filter((job) =>
            job.created_by?.toLowerCase().includes(query)
          );
          break;
        case 'downloader':
          filtered = filtered.filter((job) =>
            job.downloaded_by?.toLowerCase().includes(query)
          );
          break;
        case 'content':
          // 원고 내용 검색 (article_content가 있는 경우에만)
          filtered = filtered.filter((job: any) => {
            const content = job.article_content;
            return content && typeof content === 'string' && content.toLowerCase().includes(query);
          });
          break;
        default:
          filtered = filtered.filter((job: any) => {
            const content = job.article_content;
            return (
              job.client_name?.toLowerCase().includes(query) ||
              job.created_by?.toLowerCase().includes(query) ||
              job.downloaded_by?.toLowerCase().includes(query) ||
              (content && typeof content === 'string' && content.toLowerCase().includes(query))
            );
          });
      }
    }

    setFilteredJobs(filtered);

    // 배치별로 그룹화
    const groupsMap = new Map<string | null, JobWithClient[]>();
    const singleJobs: JobWithClient[] = [];

    filtered.forEach((job) => {
      if (job.batch_id) {
        if (!groupsMap.has(job.batch_id)) {
          groupsMap.set(job.batch_id, []);
        }
        groupsMap.get(job.batch_id)!.push(job);
      } else {
        singleJobs.push(job);
      }
    });

    // 그룹을 배열로 변환
    const groups: JobGroup[] = Array.from(groupsMap.entries()).map(([batchId, jobs]) => {
      const sortedJobs = jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const downloadedJobs = sortedJobs.filter((j) => j.downloaded_by);
      const downloaders = Array.from(new Set(downloadedJobs.map((j) => j.downloaded_by).filter(Boolean)));
      
      return {
        batch_id: batchId,
        jobs: sortedJobs,
        client_name: sortedJobs[0]?.client_name || null,
        created_by: sortedJobs[0]?.created_by || null,
        created_at: sortedJobs[0]?.created_at || '',
        downloaded_by: downloaders.length > 0 ? downloaders.join(', ') : null,
        download_count: downloadedJobs.length,
      };
    });

    // 단일 작업도 그룹 형태로 변환
    const singleJobGroups: JobGroup[] = singleJobs.map((job) => ({
      batch_id: null,
      jobs: [job],
      client_name: job.client_name || null,
      created_by: job.created_by || null,
      created_at: job.created_at,
      downloaded_by: job.downloaded_by || null,
      download_count: job.downloaded_by ? 1 : 0,
    }));

    // 모든 그룹을 생성일 기준으로 정렬
    const allGroups = [...groups, ...singleJobGroups].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setJobGroups(allGroups);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 리셋
    
    // 디버깅: 원고 내용 검색 시 로그
    if (filterType === 'content' && searchQuery.trim()) {
      const jobsWithContent = filtered.filter((job: any) => job.article_content);
      const matchedJobs = filtered.filter((job: any) => {
        const content = job.article_content;
        return content && typeof content === 'string' && content.toLowerCase().includes(searchQuery.toLowerCase());
      });
      console.log('원고 내용 검색:', {
        검색어: searchQuery,
        전체_작업: jobs.length,
        원고_있는_작업: jobsWithContent.length,
        필터링된_작업: filtered.length,
        매칭된_작업: matchedJobs.length,
      });
    }
  }, [searchQuery, filterType, downloadFilter, jobs]);

  const fetchJobs = async (includeContent: boolean = false) => {
    try {
      setLoading(true);
      const url = includeContent ? '/api/jobs?include_content=true' : '/api/jobs';
      const res = await fetch(url);
      const data = await res.json();
      const jobsData = data.jobs || [];
      setJobs(jobsData);
      setFilteredJobs(jobsData);
      
      // 디버깅: 원고 내용이 포함되었는지 확인
      if (includeContent) {
        const jobsWithContent = jobsData.filter((job: any) => job.article_content);
        console.log(`원고 내용 포함된 작업: ${jobsWithContent.length}개 / 전체: ${jobsData.length}개`);
      }
    } catch (error) {
      console.error('작업 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'done':
        return '완료';
      case 'processing':
        return '처리 중';
      case 'error':
        return '오류';
      default:
        return '대기';
    }
  };

  const toggleBatchExpanded = (batchId: string) => {
    setExpandedBatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  };

  const handleDeleteJob = async (jobId: string, jobName: string) => {
    if (!confirm(`"${jobName}" 작업을 정말 삭제하시겠습니까? 이 작업은 복구할 수 없습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '작업 삭제 실패');
      }

      alert('작업이 삭제되었습니다.');
      // 작업 목록 새로고침
      const shouldIncludeContent = filterType === 'content' || filterType === 'all';
      await fetchJobs(shouldIncludeContent);
    } catch (error) {
      console.error('작업 삭제 오류:', error);
      alert(`작업 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleDeleteBatch = async (batchId: string, clientName: string | null) => {
    if (!confirm(`"${clientName || '배치'}" 배치 작업을 정말 삭제하시겠습니까? 배치 내 모든 작업이 삭제되며 복구할 수 없습니다.`)) {
      return;
    }

    try {
      // 배치 내 모든 작업 ID 조회
      const batchJobs = jobs.filter((job) => job.batch_id === batchId);
      
      if (batchJobs.length === 0) {
        alert('삭제할 작업이 없습니다.');
        return;
      }

      // 모든 작업 삭제
      const deletePromises = batchJobs.map((job) =>
        fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter((res) => !res.ok);

      if (failed.length > 0) {
        alert(`${failed.length}개의 작업 삭제에 실패했습니다.`);
      } else {
        alert(`${batchJobs.length}개의 작업이 삭제되었습니다.`);
      }

      // 작업 목록 새로고침
      const shouldIncludeContent = filterType === 'content' || filterType === 'all';
      await fetchJobs(shouldIncludeContent);
    } catch (error) {
      console.error('배치 삭제 오류:', error);
      alert(`배치 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleBatchDownload = async (batchId: string, clientName: string | null) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      // 배치 내 모든 작업 조회
      const res = await fetch(`/api/jobs/batch/${batchId}`);
      if (!res.ok) {
        throw new Error('배치 조회 실패');
      }
      const data = await res.json();
      const batchJobs = data.jobs || [];

      // 완료된 작업만 필터링
      const completedJobs = batchJobs.filter((item: any) => item.article !== null);

      if (completedJobs.length === 0) {
        alert('다운로드할 완료된 원고가 없습니다.');
        return;
      }

      // 배치 내 모든 작업의 다운로드 정보 업데이트
      const jobIds = completedJobs.map((item: any) => item.job.id);
      for (const jobId of jobIds) {
        try {
          await fetch(`/api/jobs/${jobId}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloaded_by: currentUser }),
          });
        } catch (error) {
          console.error(`작업 ${jobId} 다운로드 정보 업데이트 실패:`, error);
        }
      }

      const zip = new JSZip();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // 각 작업의 원고와 이미지 추가
      for (let i = 0; i < completedJobs.length; i++) {
        const item = completedJobs[i];
        
        // 원고 텍스트 파일 추가
        if (item.article?.content) {
          zip.file(`원고_${i + 1}.txt`, item.article.content);
        }

        // 이미지 추가
        if (item.images && item.images.length > 0) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          for (let j = 0; j < item.images.length; j++) {
            const img = item.images[j];
            const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${img.storage_path}`;
            
            try {
              const response = await fetch(imageUrl);
              if (response.ok) {
                const blob = await response.blob();
                const fileName = img.storage_path.split('/').pop() || `image_${j + 1}.jpg`;
                zip.file(`원고_${i + 1}_이미지/${fileName}`, blob);
              }
            } catch (error) {
              console.error(`이미지 다운로드 실패 (${img.storage_path}):`, error);
            }
          }
        }
      }

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clientName || '배치'}_${dateStr}_${completedJobs.length}건.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 작업 목록 새로고침
      await fetchJobs();

      alert(`${completedJobs.length}개의 원고가 다운로드되었습니다.`);
    } catch (error) {
      console.error('배치 다운로드 오류:', error);
      alert('배치 다운로드 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">작업 목록</h1>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              홈
            </Link>
            <Link
              href="/jobs/new"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              새 작업 생성
            </Link>
          </div>
        </div>

        {/* 검색 필터 */}
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mb-6">
          <div className="flex flex-col gap-5">
            {/* 다운로드 상태 필터 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">컨펌 상태</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDownloadFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    downloadFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => setDownloadFilter('not_downloaded')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    downloadFilter === 'not_downloaded'
                      ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  담당자 확인 필요
                </button>
                <button
                  onClick={() => setDownloadFilter('downloaded')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    downloadFilter === 'downloaded'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  광고주 컨펌 완료
                </button>
              </div>
            </div>

            {/* 검색 필터 */}
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="flex gap-2">
                  <select
                    value={filterType}
                    onChange={(e) => {
                      const newFilterType = e.target.value as 'all' | 'client' | 'creator' | 'downloader' | 'content';
                      setFilterType(newFilterType);
                      setSearchQuery('');
                      // 원고 내용 검색으로 변경 시 content 포함하여 다시 조회
                      if (newFilterType === 'content' || newFilterType === 'all') {
                        fetchJobs(true);
                      } else {
                        fetchJobs(false);
                      }
                    }}
                    className="px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="all">전체 검색</option>
                    <option value="client">업체명</option>
                    <option value="creator">생성자</option>
                    <option value="downloader">다운로드한 사람</option>
                    <option value="content">원고 내용</option>
                  </select>
                  <input
                    type="text"
                    placeholder={
                      filterType === 'all'
                        ? '업체명, 생성자, 다운로드한 사람, 원고 내용으로 검색...'
                        : filterType === 'client'
                        ? '업체명으로 검색...'
                        : filterType === 'creator'
                        ? '생성자로 검색...'
                        : filterType === 'downloader'
                        ? '다운로드한 사람으로 검색...'
                        : '원고 내용으로 검색...'
                    }
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {(searchQuery || downloadFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('all');
                        setDownloadFilter('all');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 transition-all"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-600 font-medium">
                  검색 결과: <span className="text-gray-900 font-semibold">{filteredJobs.length}</span>개 / 전체: <span className="text-gray-900 font-semibold">{jobs.length}</span>개
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-300">
              <tr>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">업체명</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">건수</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">타입</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">길이</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">상태</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">생성자</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">다운로드</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">생성일</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody>
              {jobGroups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    <p className="text-gray-500 text-base font-medium">
                      {searchQuery || downloadFilter !== 'all' ? '검색 결과가 없습니다.' : '생성된 작업이 없습니다.'}
                    </p>
                  </td>
                </tr>
              ) : (
                jobGroups
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((group) => {
                  const isBatch = group.batch_id !== null && group.jobs.length > 1;
                  const firstJob = group.jobs[0];
                  const isExpanded = group.batch_id ? expandedBatches.has(group.batch_id) : true;
                  
                  // 배치 작업의 통계
                  const doneCount = group.jobs.filter((j) => j.status === 'done').length;
                  const allDownloaded = group.jobs.every((j) => j.downloaded_by);
                  const hasDownloaded = group.jobs.some((j) => j.downloaded_by);
                  
                  return (
                    <React.Fragment key={group.batch_id || firstJob.id}>
                      {isBatch ? (
                        // 배치 그룹 헤더 (드롭다운)
                        <tr className={`border-t-2 ${allDownloaded ? 'bg-green-50 border-green-400' : hasDownloaded ? 'bg-yellow-50 border-yellow-400' : 'bg-blue-50 border-blue-400'}`}>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => group.batch_id && toggleBatchExpanded(group.batch_id)}
                              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            >
                              <svg
                                className={`w-5 h-5 text-blue-700 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-base font-semibold text-gray-900">
                                {firstJob.client_name || '-'}
                              </span>
                            </button>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                              {group.jobs.length}건
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">-</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">-</span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-col gap-1">
                              {group.download_count > 0 ? (
                                <span className={`text-xs font-semibold ${allDownloaded ? 'text-green-700' : 'text-yellow-700'}`}>
                                  다운로드 {group.download_count}/{group.jobs.length}건
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-yellow-700">다운로드 확인 필요</span>
                              )}
                              <span className="text-xs font-semibold text-gray-700">완료 {doneCount}/{group.jobs.length}건</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">{group.created_by || '-'}</span>
                          </td>
                          <td className="px-5 py-4">
                            {group.download_count > 0 ? (
                              <div className="space-y-1">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${allDownloaded ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                  <span>{allDownloaded ? '✓' : '!'}</span>
                                  <span>{allDownloaded ? '컨펌 완료' : '일부 컨펌'}</span>
                                </span>
                                {group.downloaded_by && (
                                  <p className="text-xs font-medium text-gray-700 mt-1">{group.downloaded_by}</p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-semibold">
                                <span>!</span>
                                <span>확인 필요</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-600">
                              {new Date(firstJob.created_at).toLocaleString('ko-KR')}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => group.batch_id && handleBatchDownload(group.batch_id, firstJob.client_name || null)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-md transition-all whitespace-nowrap"
                              >
                                ZIP 다운로드
                              </button>
                              <button
                                onClick={() => group.batch_id && handleDeleteBatch(group.batch_id, firstJob.client_name || null)}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 active:bg-red-800 shadow-md transition-all whitespace-nowrap"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {(!isBatch || isExpanded) && group.jobs.map((job, index) => (
                        <tr
                          key={job.id}
                          className={`border-t ${
                            job.downloaded_by
                              ? 'bg-green-50 hover:bg-green-100'
                              : 'bg-yellow-50 hover:bg-yellow-100'
                          } ${isBatch ? 'border-l-4 border-l-blue-400 pl-2' : ''}`}
                        >
                          <td className="px-5 py-4">
                            {isBatch ? (
                              <div className="flex items-center gap-2">
                                <span className="text-blue-500 font-bold text-lg">└</span>
                                <span className="font-semibold text-gray-900">{job.client_name || '-'}</span>
                              </div>
                            ) : (
                              <span className="font-semibold text-gray-900">{job.client_name || '-'}</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                              1건
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">
                              {job.content_type === 'review' ? '후기형' : '정보형'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">{job.length_hint}자</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                              {getStatusText(job.status)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium text-gray-700">{job.created_by || '-'}</span>
                          </td>
                          <td className="px-5 py-4">
                            {job.downloaded_by ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-semibold">
                                  <span className="text-green-600">✓</span>
                                  <span>컨펌 완료</span>
                                </span>
                                <p className="text-xs font-medium text-gray-700 mt-1">{job.downloaded_by}</p>
                                {job.downloaded_at && (
                                  <p className="text-xs text-gray-500">
                                    {new Date(job.downloaded_at).toLocaleDateString('ko-KR')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-xs font-semibold">
                                <span className="text-yellow-600">!</span>
                                <span>확인 필요</span>
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm text-gray-600">
                              {new Date(job.created_at).toLocaleString('ko-KR')}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/jobs/${job.id}`}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-md transition-all"
                              >
                                상세보기
                              </Link>
                              <button
                                onClick={() => handleDeleteJob(job.id, job.client_name || '작업')}
                                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 active:bg-red-800 shadow-md transition-all"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {jobGroups.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              전체 {jobGroups.length}개 중 {Math.min((currentPage - 1) * itemsPerPage + 1, jobGroups.length)}-{Math.min(currentPage * itemsPerPage, jobGroups.length)}개 표시
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                이전
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(jobGroups.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter((page) => {
                    const totalPages = Math.ceil(jobGroups.length / itemsPerPage);
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, index, array) => {
                    const totalPages = Math.ceil(jobGroups.length / itemsPerPage);
                    const prevPage = array[index - 1];
                    const showEllipsis = prevPage && page - prevPage > 1;
                    
                    return (
                      <React.Fragment key={page}>
                        {showEllipsis && (
                          <span className="px-2 text-gray-500">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            currentPage === page
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(jobGroups.length / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(jobGroups.length / itemsPerPage)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

