'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import JSZip from 'jszip';
import { Job, Article, JobImage, Client } from '@/lib/types';

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [images, setImages] = useState<JobImage[]>([]);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showImages, setShowImages] = useState(false);
  const [showArticle, setShowArticle] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const fetchJobDetail = useCallback(async (): Promise<boolean> => {
    try {
      // 캐시 방지를 위해 timestamp 추가 및 headers 설정
      const res = await fetch(`/api/jobs/${jobId}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) {
        throw new Error('작업 조회 실패');
      }
      const data = await res.json();
      
      // 상태 업데이트
      if (data.job) {
        setJob((prevJob) => {
          const previousStatus = prevJob?.status;
          if (previousStatus !== data.job.status) {
            console.log(`상태 변경: ${previousStatus} -> ${data.job.status}`);
          }
          return data.job;
        });
        setArticle(data.article || null);
        setImages(data.images || []);
        setClient(data.client || null);
        
        // 완료 또는 오류 상태면 폴링 중지
        if (data.job.status === 'done' || data.job.status === 'error') {
          setPolling(false);
          return true; // 완료됨을 반환
        }
        return false; // 계속 진행 중
      }
    } catch (error) {
      console.error('작업 상세 조회 오류:', error);
    } finally {
      setLoading(false);
    }
    return false;
  }, [jobId]);

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
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

  // 초기 로드 및 jobId 변경 시
  useEffect(() => {
    setLoading(true);
    fetchJobDetail();
  }, [jobId]); // jobId만 의존성으로 사용하여 페이지 이동 시 새로 로드

  // 폴링 로직 (별도 useEffect)
  useEffect(() => {
    if (!job) return;

    // 처리 중이면 폴링 시작
    if (job.status === 'processing' || job.status === 'pending') {
      setPolling(true);
      const interval = setInterval(async () => {
        console.log('폴링: 작업 상태 확인 중...', job.status);
        const isComplete = await fetchJobDetail();
        if (isComplete) {
          clearInterval(interval);
          setPolling(false);
        }
      }, 3000);
      
      return () => {
        clearInterval(interval);
        setPolling(false);
      };
    } else {
      setPolling(false);
    }
  }, [job?.status, fetchJobDetail]);

  const handleCopy = () => {
    if (article?.content) {
      navigator.clipboard.writeText(article.content);
      alert('원고가 클립보드에 복사되었습니다.');
    }
  };

  const handleDownload = async () => {
    if (!article?.content || !client) {
      alert('다운로드할 원고가 없습니다.');
      return;
    }

    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    // 다운로드 정보 업데이트
    try {
      const downloadRes = await fetch(`/api/jobs/${jobId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloaded_by: currentUser }),
      });

      const downloadData = await downloadRes.json();

      if (!downloadRes.ok) {
        console.error('다운로드 정보 업데이트 실패:', downloadData);
      } else {
        console.log('다운로드 정보 업데이트 성공:', downloadData);
        setTimeout(() => {
          fetchJobDetail();
        }, 500);
      }
    } catch (error) {
      console.error('다운로드 정보 업데이트 오류:', error);
    }

    // 파일 다운로드
    const blob = new Blob([article.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // 파일명: 업체명_YYYYMMDD 형식
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const fileName = `${client.name}_${dateStr}.txt`;
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    if (!article?.content || !client) {
      alert('다운로드할 원고가 없습니다.');
      return;
    }

    if (!currentUser) {
      alert('로그인이 필요합니다.');
      return;
    }

    setDownloadingZip(true);

    try {
      const zip = new JSZip();
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}${month}${day}`;

      // 원고 텍스트 파일 추가
      zip.file(`${client.name}_${dateStr}.txt`, article.content);

      // 이미지 추가
      if (images.length > 0) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${img.storage_path}`;
          
          try {
            const response = await fetch(imageUrl);
            if (response.ok) {
              const blob = await response.blob();
              const fileName = img.storage_path.split('/').pop() || `image_${i + 1}.jpg`;
              zip.file(`images/${fileName}`, blob);
            }
          } catch (error) {
            console.error(`이미지 다운로드 실패 (${img.storage_path}):`, error);
          }
        }
      }

      // ZIP 파일 생성 및 다운로드
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name}_${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 다운로드 정보 업데이트
      try {
        await fetch(`/api/jobs/${jobId}/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ downloaded_by: currentUser }),
        });
        setTimeout(() => {
          fetchJobDetail();
        }, 500);
      } catch (error) {
        console.error('다운로드 정보 업데이트 오류:', error);
      }
    } catch (error) {
      console.error('ZIP 다운로드 오류:', error);
      alert('ZIP 파일 다운로드 중 오류가 발생했습니다.');
    } finally {
      setDownloadingZip(false);
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  if (!job) {
    return <div className="p-8">작업을 찾을 수 없습니다.</div>;
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">작업 상세</h1>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                setLoading(true);
                await fetchJobDetail();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              새로고침
            </button>
            <button
              onClick={() => router.push('/jobs')}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              목록으로
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {/* 작업 정보 */}
          <div
            className={`p-6 rounded-lg shadow-md ${
              job.downloaded_by ? 'bg-green-50 border-2 border-green-200' : 'bg-yellow-50 border-2 border-yellow-200'
            }`}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">작업 정보</h2>
              {job.downloaded_by ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <span>✓</span>
                  <span>광고주 컨펌 완료</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  <span>!</span>
                  <span>담당자 확인 필요</span>
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">상태</p>
                <p className={`inline-block px-3 py-1 rounded ${getStatusColor(job.status)}`}>
                  {getStatusText(job.status)}
                  {polling && ' (갱신 중...)'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">업체</p>
                <p className="font-medium">{client?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">글 타입</p>
                <p className="font-medium">{job.content_type === 'review' ? '후기형' : '정보형'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">원고 길이</p>
                <p className="font-medium">{job.length_hint}자</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">생성자</p>
                <p className="font-medium">{job.created_by || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">생성일</p>
                <p className="font-medium">{new Date(job.created_at).toLocaleString('ko-KR')}</p>
              </div>
              {job.completed_at && (
                <div>
                  <p className="text-sm text-gray-600">완료일</p>
                  <p className="font-medium">{new Date(job.completed_at).toLocaleString('ko-KR')}</p>
                </div>
              )}
              {(job.downloaded_by || job.downloaded_at) && (
                <>
                  {job.downloaded_by && (
                    <div>
                      <p className="text-sm text-gray-600">다운로드한 사람</p>
                      <p className="font-medium">{job.downloaded_by}</p>
                    </div>
                  )}
                  {job.downloaded_at && (
                    <div>
                      <p className="text-sm text-gray-600">다운로드일</p>
                      <p className="font-medium">{new Date(job.downloaded_at).toLocaleString('ko-KR')}</p>
                    </div>
                  )}
                </>
              )}
            </div>
            {job.error_message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">오류: {job.error_message}</p>
              </div>
            )}
          </div>

          {/* Vision 결과 (이미지가 있는 경우) */}
          {images.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">업로드된 이미지 ({images.length}개)</h2>
                <button
                  onClick={() => setShowImages(!showImages)}
                  className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                >
                  {showImages ? '숨기기' : '보기'}
                </button>
              </div>
              {showImages && (
                <div className="grid grid-cols-4 gap-4">
                  {images.map((img) => {
                    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                    const imageUrl = `${supabaseUrl}/storage/v1/object/public/job-images/${img.storage_path}`;
                    return (
                      <div key={img.id} className="relative">
                        <img
                          src={imageUrl}
                          alt="Job image"
                          className="w-full h-32 object-cover rounded"
                          loading="lazy"
                          onError={(e) => {
                            console.error('이미지 로드 실패:', imageUrl);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 최종 원고 */}
          {article && (
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">생성된 원고</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    복사
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    텍스트 다운로드
                  </button>
                  <button
                    onClick={handleDownloadZip}
                    disabled={downloadingZip}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:bg-gray-400 text-sm"
                  >
                    {downloadingZip ? '압축 중...' : 'ZIP 다운로드'}
                  </button>
                </div>
              </div>
              <div className="mb-4">
                <button
                  onClick={() => setShowArticle(!showArticle)}
                  className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                >
                  {showArticle ? '원고 숨기기' : '원고 보기'}
                </button>
              </div>
              {showArticle && (
                <>
                  <div className="prose max-w-none">
                    <pre className="whitespace-pre-wrap font-sans text-sm bg-gray-50 p-4 rounded">
                      {article.content}
                    </pre>
                  </div>
                  <div className="mt-4 text-xs text-gray-500">
                    <p>모델: {article.model_name}</p>
                    <p>생성일: {new Date(article.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                </>
              )}
            </div>
          )}

          {!article && (job.status === 'pending' || job.status === 'processing') && (
            <div className="bg-blue-50 p-6 rounded-lg shadow-md text-center">
              <p className="text-blue-800">원고 생성 중입니다. 잠시만 기다려주세요...</p>
            </div>
          )}
          {job.status === 'error' && !article && (
            <div className="bg-red-50 p-6 rounded-lg shadow-md text-center">
              <p className="text-red-800">원고 생성 중 오류가 발생했습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

