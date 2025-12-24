'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import JSZip from 'jszip';
import { Job } from '@/lib/types';

interface JobWithClient extends Job {
  client_name?: string | null;
  article_content?: string | null;
  client_requires_confirmation?: boolean;
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
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithClient[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobWithClient[]>([]);
  const [jobGroups, setJobGroups] = useState<JobGroup[]>([]);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
  const [downloadingJobIds, setDownloadingJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'client' | 'creator' | 'downloader' | 'content'>('all');
  const [downloadFilter, setDownloadFilter] = useState<'downloaded' | 'not_downloaded'>('not_downloaded');
  const [confirmationFilter, setConfirmationFilter] = useState<'all' | 'requires_confirmation' | 'no_confirmation'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'error' | 'processing'>('all');
  const [retryingJobIds, setRetryingJobIds] = useState<Set<string>>(new Set());
  const [retriedJobIds, setRetriedJobIds] = useState<Set<string>>(new Set()); // 재생성된 작업 추적
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [authChecked, setAuthChecked] = useState(false);
  const [downloadingBatchId, setDownloadingBatchId] = useState<string | null>(null);
  const [copyingJobIds, setCopyingJobIds] = useState<Set<string>>(new Set()); // 텍스트 복사 중인 작업 ID
  const [copyingBatchId, setCopyingBatchId] = useState<string | null>(null); // 텍스트 복사 중인 배치 ID
  const itemsPerPage = 20;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
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
      setCurrentUser(session.username || null);
      setAuthChecked(true);
      fetchJobs(false);
    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    }
  };

  useEffect(() => {
    if (authChecked) {
      fetchJobs(false);
    }
  }, [authChecked]);

  // filterType이 변경될 때 원고 내용 포함 여부 결정 (원고 내용 검색으로 변경 시에만 서버 요청)
  useEffect(() => {
    // 원고 내용 검색으로 변경할 때만 서버에서 데이터 가져오기
    if (filterType === 'content') {
      const hasContent = jobs.length > 0 && jobs.some((job: any) => job.article_content);
      if (!hasContent) {
        fetchJobs(true);
      }
    }
  }, [filterType]);

  // 검색 필터링 및 그룹화
  useEffect(() => {
    let filtered = jobs;

    // 컨펌 필요 여부 필터
    if (confirmationFilter === 'requires_confirmation') {
      filtered = filtered.filter((job) => job.client_requires_confirmation === true);
    } else if (confirmationFilter === 'no_confirmation') {
      filtered = filtered.filter((job) => job.client_requires_confirmation === false);
    }

    // 상태 필터
    if (statusFilter !== 'all') {
      filtered = filtered.filter((job) => job.status === statusFilter);
    }

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
  }, [searchQuery, filterType, downloadFilter, confirmationFilter, statusFilter, jobs]);

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

  const getStatusText = (status: string, jobId?: string) => {
    // 재생성된 작업인 경우
    if (jobId && retriedJobIds.has(jobId) && status === 'processing') {
      return '재생성 처리중';
    }
    
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

  // 마감일 계산 (생성일 + 5일)
  const getDeadline = (createdAt: string): Date => {
    const createdDate = new Date(createdAt);
    const deadline = new Date(createdDate);
    deadline.setDate(deadline.getDate() + 5);
    return deadline;
  };

  // 마감일이 지났거나 오늘인지 확인 (5일째 되는 날부터 표시)
  const shouldShowDeadline = (createdAt: string): boolean => {
    const deadline = getDeadline(createdAt);
    const today = new Date();
    
    // 날짜만 비교 (시간 제외)
    const deadlineDate = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    // 마감일이 오늘이거나 지났을 때만 표시 (5일째 되는 날부터)
    return todayDate.getTime() >= deadlineDate.getTime();
  };

  // 마감일 포맷팅
  const formatDeadline = (createdAt: string): string => {
    const deadline = getDeadline(createdAt);
    return deadline.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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

  const toggleJobExpanded = (jobId: string) => {
    setExpandedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleSingleJobDownload = async (jobId: string, clientName: string | null) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    setDownloadingJobIds((prev) => new Set(prev).add(jobId));

    try {
      // 작업 상세 정보 가져오기
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error('작업 조회 실패');
      }
      const data = await res.json();

      if (!data.article?.content || !data.client) {
        if (data.job?.status === 'error') {
          alert('오류가 발생한 작업입니다. 재생성 후 다운로드할 수 있습니다.');
        } else {
          alert('다운로드할 원고가 없습니다.');
        }
        return;
      }

      if (data.job?.status === 'error') {
        alert('오류가 발생한 작업입니다. 재생성 후 다운로드할 수 있습니다.');
        return;
      }

      const zip = new JSZip();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // 원고 텍스트 파일 추가
      zip.file(`${data.client.name}_${dateStr}.txt`, data.article.content);

      // 이미지 병렬 다운로드
      if (data.images && data.images.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        
        const imagePromises = data.images.map(async (img: any, i: number) => {
          const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${img.storage_path}`;
          try {
            const response = await fetch(imageUrl);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = img.storage_path.split('/').pop() || `image_${i + 1}.jpg`;
              return { fileName, blob };
            }
          } catch (error) {
            console.error(`이미지 다운로드 실패 (${img.storage_path}):`, error);
          }
          return null;
        });

        const imageResults = await Promise.all(imagePromises);
        
        imageResults.forEach((result) => {
          if (result) {
            zip.file(`images/${result.fileName}`, result.blob);
          }
        });
      }

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.client.name}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 다운로드 정보 업데이트
      await fetch(`/api/jobs/${jobId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloaded_by: currentUser }),
      });

      // 작업 목록 새로고침
      const shouldIncludeContent = filterType === 'content' || filterType === 'all';
      await fetchJobs(shouldIncludeContent);
    } catch (error) {
      console.error('개별 작업 다운로드 오류:', error);
      alert(`다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setDownloadingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
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

  const handleRetryJob = async (jobId: string) => {
    if (!confirm('이 작업을 재생성하시겠습니까?')) {
      return;
    }

    setRetryingJobIds((prev) => new Set(prev).add(jobId));

    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, {
        method: 'POST',
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '재생성 실패');
      }

      // 재생성된 작업으로 표시
      setRetriedJobIds((prev) => new Set(prev).add(jobId));
      
      alert('작업이 재생성되었습니다. 처리 상태를 확인해주세요.');
      
      // 작업 목록 새로고침
      const shouldIncludeContent = filterType === 'content' || filterType === 'all';
      await fetchJobs(shouldIncludeContent);
    } catch (error) {
      console.error('작업 재생성 오류:', error);
      alert(`작업 재생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setRetryingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleCopyText = async (jobId: string) => {
    if (copyingJobIds.has(jobId)) return;

    setCopyingJobIds((prev) => new Set(prev).add(jobId));

    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        throw new Error('작업 조회 실패');
      }
      const data = await res.json();

      if (!data.article?.content) {
        alert('복사할 원고가 없습니다.');
        return;
      }

      // 클립보드에 복사
      await navigator.clipboard.writeText(data.article.content);
      alert('원고가 클립보드에 복사되었습니다.');
    } catch (error) {
      console.error('텍스트 복사 오류:', error);
      alert(`텍스트 복사 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCopyingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleBatchCopyText = async (batchId: string, clientName: string | null) => {
    if (copyingBatchId === batchId) return;

    setCopyingBatchId(batchId);

    try {
      // 배치 내 모든 작업 조회
      const res = await fetch(`/api/jobs/batch/${batchId}`);
      if (!res.ok) {
        throw new Error('배치 조회 실패');
      }
      const data = await res.json();
      const batchJobs = data.jobs || [];

      // 완료된 작업만 필터링
      const completedJobs = batchJobs.filter((item: any) => item.article !== null && item.job.status === 'done');

      if (completedJobs.length === 0) {
        alert('복사할 완료된 원고가 없습니다.');
        setCopyingBatchId(null);
        return;
      }

      // 모든 원고를 합쳐서 복사 (각 원고 사이에 구분선 추가)
      const allTexts = completedJobs.map((item: any, index: number) => {
        const header = `========== 원고 ${index + 1} ==========\n`;
        return header + (item.article?.content || '');
      }).join('\n\n');

      // 클립보드에 복사
      await navigator.clipboard.writeText(allTexts);
      alert(`${completedJobs.length}개의 원고가 클립보드에 복사되었습니다.`);
    } catch (error) {
      console.error('배치 텍스트 복사 오류:', error);
      alert(`텍스트 복사 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setCopyingBatchId(null);
    }
  };

  const handleBatchDownload = async (batchId: string, clientName: string | null) => {
    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 즉시 로딩 상태 표시 및 버튼 비활성화
    setDownloadingBatchId(batchId);

    try {
      // 배치 내 모든 작업 조회
      const res = await fetch(`/api/jobs/batch/${batchId}`);
      if (!res.ok) {
        throw new Error('배치 조회 실패');
      }
      const data = await res.json();
      const batchJobs = data.jobs || [];

      // 완료된 작업만 필터링 (오류 작업 제외)
      const completedJobs = batchJobs.filter((item: any) => item.article !== null && item.job.status === 'done');
      const errorJobs = batchJobs.filter((item: any) => item.job.status === 'error');

      if (completedJobs.length === 0) {
        if (errorJobs.length > 0) {
          alert(`다운로드할 완료된 원고가 없습니다.\n오류가 발생한 작업이 ${errorJobs.length}개 있습니다. 오류 작업은 재생성 후 다운로드할 수 있습니다.`);
        } else {
          alert('다운로드할 완료된 원고가 없습니다.');
        }
        setDownloadingBatchId(null);
        return;
      }

      // 오류 작업이 있으면 알림 표시
      if (errorJobs.length > 0) {
        const message = `배치에 오류가 발생한 작업이 ${errorJobs.length}개 있습니다.\n완료된 ${completedJobs.length}개 작업만 다운로드됩니다.\n오류 작업은 재생성 후 다운로드할 수 있습니다.`;
        if (!confirm(message)) {
          setDownloadingBatchId(null);
          return;
        }
      }

      // 배치 내 모든 작업의 다운로드 정보 업데이트 (병렬 처리)
      const jobIds = completedJobs.map((item: any) => item.job.id);
      await Promise.allSettled(
        jobIds.map((jobId: string) =>
          fetch(`/api/jobs/${jobId}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloaded_by: currentUser }),
          }).catch((error) => {
            console.error(`작업 ${jobId} 다운로드 정보 업데이트 실패:`, error);
          })
        )
      );

      const zip = new JSZip();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // 각 작업의 원고와 이미지 추가
      for (let i = 0; i < completedJobs.length; i++) {
        const item = completedJobs[i];
        
        // 원고 텍스트 파일 추가 (즉시 처리)
        if (item.article?.content) {
          zip.file(`원고_${i + 1}.txt`, item.article.content);
        }

        // 이미지 병렬 다운로드로 속도 향상
        if (item.images && item.images.length > 0) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          
          // 모든 이미지를 병렬로 다운로드
          const imagePromises = item.images.map(async (img: any, j: number) => {
            const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${img.storage_path}`;
            try {
              const response = await fetch(imageUrl);
              if (response.ok) {
                const blob = await response.blob();
                const fileName = img.storage_path.split('/').pop() || `image_${j + 1}.jpg`;
                return { fileName, blob, jobIndex: i };
              }
            } catch (error) {
              console.error(`이미지 다운로드 실패 (${img.storage_path}):`, error);
            }
            return null;
          });

          // 모든 이미지 다운로드 완료 대기
          const imageResults = await Promise.all(imagePromises);
          
          // ZIP에 이미지 추가
          imageResults.forEach((result) => {
            if (result) {
              zip.file(`원고_${result.jobIndex + 1}_이미지/${result.fileName}`, result.blob);
            }
          });
        }
      }

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 } // 적절한 압축 레벨로 속도와 크기 균형
      });
      
      // 즉시 다운로드 시작
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${clientName || '배치'}_${dateStr}_${completedJobs.length}건.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 작업 목록 새로고침 (비동기로 처리하여 다운로드 속도에 영향 없음)
      fetchJobs().catch(console.error);

      alert(`${completedJobs.length}개의 원고가 다운로드되었습니다.`);
    } catch (error) {
      console.error('배치 다운로드 오류:', error);
      alert('배치 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingBatchId(null);
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
            {/* 업체 유형 필터 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">업체 유형</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setConfirmationFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    confirmationFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => {
                    setConfirmationFilter('requires_confirmation');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    confirmationFilter === 'requires_confirmation'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  컨펌 필요 업체
                </button>
                <button
                  onClick={() => {
                    setConfirmationFilter('no_confirmation');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    confirmationFilter === 'no_confirmation'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  임의 작업 업체
                </button>
              </div>
            </div>
            {/* 작업 상태 필터 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">작업 상태</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('processing');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'processing'
                      ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  처리중
                </button>
                <button
                  onClick={() => {
                    setStatusFilter('error');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === 'error'
                      ? 'bg-red-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  오류
                </button>
              </div>
            </div>
            {/* 다운로드 상태 필터 */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">다운로드 상태</label>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDownloadFilter('not_downloaded');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    downloadFilter === 'not_downloaded'
                      ? 'bg-yellow-500 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  담당자 확인 필요
                </button>
                <button
                  onClick={() => {
                    setDownloadFilter('downloaded');
                    setCurrentPage(1);
                  }}
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
                      setCurrentPage(1); // 필터 타입 변경 시 첫 페이지로
                      // 원고 내용 검색으로 변경 시에만 서버에서 데이터 가져오기
                      if (newFilterType === 'content') {
                        const hasContent = jobs.length > 0 && jobs.some((job: any) => job.article_content);
                        if (!hasContent) {
                          fetchJobs(true);
                        }
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
                  {(searchQuery || statusFilter !== 'all' || confirmationFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilterType('all');
                        setDownloadFilter('not_downloaded');
                        setStatusFilter('all');
                        setConfirmationFilter('all');
                        setCurrentPage(1);
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
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">마감일</th>
                <th className="px-5 py-4 text-left text-sm font-bold text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody>
              {jobGroups.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center">
                    <p className="text-gray-500 text-base font-medium">
                      {searchQuery || statusFilter !== 'all' || confirmationFilter !== 'all' ? '검색 결과가 없습니다.' : '생성된 작업이 없습니다.'}
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
                            {shouldShowDeadline(firstJob.created_at) ? (
                              <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
                                {formatDeadline(firstJob.created_at)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => group.batch_id && handleBatchDownload(group.batch_id, firstJob.client_name || null)}
                                disabled={downloadingBatchId === group.batch_id}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all whitespace-nowrap"
                              >
                                {downloadingBatchId === group.batch_id ? '압축 중...' : 'ZIP 다운로드'}
                              </button>
                              <button
                                onClick={() => group.batch_id && handleBatchCopyText(group.batch_id, firstJob.client_name || null)}
                                disabled={copyingBatchId === group.batch_id}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all whitespace-nowrap"
                              >
                                {copyingBatchId === group.batch_id ? '복사 중...' : '텍스트 복사'}
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
                      {(!isBatch || isExpanded) && group.jobs.map((job, index) => {
                        const isJobExpanded = !isBatch ? expandedJobs.has(job.id) : false;
                        return (
                          <React.Fragment key={job.id}>
                            <tr
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
                                  <button
                                    onClick={() => toggleJobExpanded(job.id)}
                                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                                  >
                                    <svg
                                      className={`w-5 h-5 text-blue-700 transition-transform ${isJobExpanded ? 'rotate-90' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                    <span className="font-semibold text-gray-900">{job.client_name || '-'}</span>
                                  </button>
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
                              {getStatusText(job.status, job.id)}
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
                            {shouldShowDeadline(job.created_at) ? (
                              <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-semibold">
                                {formatDeadline(job.created_at)}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {!isBatch && (
                                <>
                                  <button
                                    onClick={() => handleSingleJobDownload(job.id, job.client_name || null)}
                                    disabled={downloadingJobIds.has(job.id) || job.status !== 'done'}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all whitespace-nowrap"
                                  >
                                    {downloadingJobIds.has(job.id) ? '압축 중...' : 'ZIP 다운로드'}
                                  </button>
                                  <button
                                    onClick={() => handleCopyText(job.id)}
                                    disabled={copyingJobIds.has(job.id) || job.status !== 'done'}
                                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all whitespace-nowrap"
                                  >
                                    {copyingJobIds.has(job.id) ? '복사 중...' : '텍스트 복사'}
                                  </button>
                                </>
                              )}
                              {(job.status === 'error' || job.status === 'processing' || job.status === 'pending') && (
                                <button
                                  onClick={() => handleRetryJob(job.id)}
                                  disabled={retryingJobIds.has(job.id)}
                                  className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 active:bg-orange-800 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md transition-all"
                                >
                                  {retryingJobIds.has(job.id) ? '재생성 중...' : '재생성'}
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteJob(job.id, job.client_name || '작업')}
                                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 active:bg-red-800 shadow-md transition-all"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                        {!isBatch && isJobExpanded && (
                          <tr className="bg-gray-50 border-t border-gray-200">
                            <td colSpan={10} className="px-5 py-4">
                              <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                <div className="flex justify-between items-start mb-4">
                                  <h3 className="text-lg font-semibold text-gray-900">작업 상세 정보</h3>
                                  <Link
                                    href={`/jobs/${job.id}`}
                                    className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all"
                                  >
                                    전체 상세보기
                                  </Link>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-600 font-medium">업체명</p>
                                    <p className="text-gray-900">{job.client_name || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600 font-medium">글 타입</p>
                                    <p className="text-gray-900">{job.content_type === 'review' ? '후기형' : '정보형'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600 font-medium">원고 길이</p>
                                    <p className="text-gray-900">{job.length_hint}자</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600 font-medium">상태</p>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(job.status)}`}>
                                      {getStatusText(job.status, job.id)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="text-gray-600 font-medium">생성자</p>
                                    <p className="text-gray-900">{job.created_by || '-'}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-600 font-medium">생성일</p>
                                    <p className="text-gray-900">{new Date(job.created_at).toLocaleString('ko-KR')}</p>
                                  </div>
                                  {job.downloaded_by && (
                                    <div>
                                      <p className="text-gray-600 font-medium">다운로드한 사람</p>
                                      <p className="text-gray-900">{job.downloaded_by}</p>
                                    </div>
                                  )}
                                  {job.downloaded_at && (
                                    <div>
                                      <p className="text-gray-600 font-medium">다운로드일</p>
                                      <p className="text-gray-900">{new Date(job.downloaded_at).toLocaleDateString('ko-KR')}</p>
                                    </div>
                                  )}
                                  {job.error_message && (
                                    <div className="col-span-full">
                                      <p className="text-gray-600 font-medium">오류 메시지</p>
                                      <p className="text-red-600 bg-red-50 p-2 rounded mt-1">{job.error_message}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                      );
                    })}
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

