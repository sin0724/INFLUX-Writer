'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { Client } from '@/lib/types';

// 여러 건 생성용 이미지 드롭존 컴포넌트
function JobImageDropzone({
  jobId,
  images,
  onAddImages,
  onRemoveImage,
}: {
  jobId: string;
  images: File[];
  onAddImages: (files: File[]) => void;
  onRemoveImage: (index: number) => void;
}) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onAddImages(acceptedFiles);
      }
      setIsDragActive(false);
    },
    [onAddImages]
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    noClick: false,
  });

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (event: any) => {
      const files = Array.from(event.target.files) as File[];
      if (files.length > 0) {
        onAddImages(files);
      }
    };
    input.click();
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        이미지 * (각 원고마다 다른 이미지 필수)
      </label>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
        }`}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
      >
        <input {...getInputProps()} />
        {images.length === 0 ? (
          <div>
            {isDragActive ? (
              <p className="text-sm text-blue-600">이미지를 여기에 놓으세요...</p>
            ) : (
              <p className="text-sm text-gray-500">이미지를 드래그하거나 클릭하여 업로드하세요</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {images.map((image, imgIndex) => (
              <div key={imgIndex} className="relative">
                <img
                  src={URL.createObjectURL(image)}
                  alt={`Preview ${imgIndex + 1}`}
                  className="w-full h-24 object-cover rounded"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(imgIndex);
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewJobPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get('client_id');

  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(clientIdParam || '');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [creationMode, setCreationMode] = useState<'single' | 'multiple'>('single');
  const [guideMode, setGuideMode] = useState<'append' | 'override'>('append');
  const [customGuide, setCustomGuide] = useState('');
  const [contentType, setContentType] = useState<'review' | 'info'>('review');
  const [lengthHint, setLengthHint] = useState<1000 | 1500>(1000);
  const [humanExtraPrompt, setHumanExtraPrompt] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  
  // 여러 건 생성용 상태
  const [multipleJobs, setMultipleJobs] = useState<Array<{
    id: string;
    images: File[];
    guide: string;
    useBaseGuide: boolean;
  }>>([{ id: '1', images: [], guide: '', useBaseGuide: true }]);

  useEffect(() => {
    fetchClients();
    // 현재 로그인된 사용자 정보 가져오기
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

  // 검색 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter((client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find((c) => c.id === selectedClientId);
      setSelectedClient(client || null);
      if (client?.base_guide) {
        setCustomGuide(client.base_guide);
      }
    }
  }, [selectedClientId, clients]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
      setFilteredClients(data.clients || []);
    } catch (error) {
      console.error('클라이언트 조회 오류:', error);
    }
  };

  // 단일 생성 모드용 드롭존
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
    },
    onDrop: (acceptedFiles) => {
      if (creationMode === 'single') {
        setImages((prev) => [...prev, ...acceptedFiles]);
      }
    },
    disabled: creationMode === 'multiple',
  });

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 여러 건 생성 관련 함수
  const addJob = () => {
    setMultipleJobs((prev) => [
      ...prev,
      { id: Date.now().toString(), images: [], guide: '', useBaseGuide: true },
    ]);
  };

  const removeJob = (jobId: string) => {
    if (multipleJobs.length > 1) {
      setMultipleJobs((prev) => prev.filter((job) => job.id !== jobId));
    }
  };

  const updateJobGuide = (jobId: string, guide: string) => {
    setMultipleJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, guide } : job))
    );
  };

  const toggleUseBaseGuide = (jobId: string) => {
    setMultipleJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, useBaseGuide: !job.useBaseGuide, guide: job.useBaseGuide ? job.guide : '' }
          : job
      )
    );
  };

  const addImageToJob = (jobId: string, files: File[]) => {
    setMultipleJobs((prev) =>
      prev.map((job) =>
        job.id === jobId ? { ...job, images: [...job.images, ...files] } : job
      )
    );
  };

  const removeImageFromJob = (jobId: string, imageIndex: number) => {
    setMultipleJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? { ...job, images: job.images.filter((_, i) => i !== imageIndex) }
          : job
      )
    );
  };

  const convertImageToBase64 = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      alert('업체를 선택해주세요.');
      return;
    }

    if (creationMode === 'single') {
      // 단일 생성
      setLoading(true);
      try {
        const imageFiles = await Promise.all(images.map(convertImageToBase64));

        const guideText =
          guideMode === 'append' && selectedClient?.base_guide
            ? `${selectedClient.base_guide}\n\n${customGuide}`
            : customGuide;

        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: selectedClientId,
            guide_text: guideText,
            human_extra_prompt: humanExtraPrompt || null,
            content_type: contentType,
            length_hint: lengthHint,
            image_files: imageFiles,
            created_by: currentUser,
          }),
        });

        const data = await res.json();
        if (res.ok && data.job_id) {
          router.push(`/jobs/${data.job_id}`);
        } else {
          alert('작업 생성에 실패했습니다.');
        }
      } catch (error) {
        console.error('작업 생성 오류:', error);
        alert('작업 생성 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    } else {
      // 여러 건 생성
      setLoading(true);
      try {
        // 배치 ID 생성 (여러 건 생성 시 같은 배치로 묶기)
        const batchId = crypto.randomUUID();
        
        // 각 원고별로 작업 생성
        const jobPromises = multipleJobs.map(async (job) => {
          // 이미지가 없으면 스킵
          if (job.images.length === 0) {
            return null;
          }

          const imageFiles = await Promise.all(job.images.map(convertImageToBase64));

          // 가이드 텍스트 결정
          let guideText = '';
          if (job.useBaseGuide && selectedClient?.base_guide) {
            if (job.guide.trim()) {
              guideText = `${selectedClient.base_guide}\n\n${job.guide}`;
            } else {
              guideText = selectedClient.base_guide;
            }
          } else {
            guideText = job.guide || customGuide;
          }

          const res = await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_id: selectedClientId,
              guide_text: guideText,
              human_extra_prompt: humanExtraPrompt || null,
              content_type: contentType,
              length_hint: lengthHint,
              image_files: imageFiles,
              created_by: currentUser,
              batch_id: batchId,
            }),
          });

          const data = await res.json();
          return res.ok && data.job_id ? data.job_id : null;
        });

        const jobIds = await Promise.all(jobPromises);
        const successCount = jobIds.filter((id) => id !== null).length;

        if (successCount > 0) {
          alert(`${successCount}개의 작업이 생성되었습니다.`);
          router.push('/jobs');
        } else {
          alert('작업 생성에 실패했습니다.');
        }
      } catch (error) {
        console.error('작업 생성 오류:', error);
        alert('작업 생성 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">새 원고 생성</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              홈
            </button>
          </div>

          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-6">
            {/* 생성 모드 선택 */}
            <div>
              <label className="block text-sm font-medium mb-2">생성 모드</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="single"
                    checked={creationMode === 'single'}
                    onChange={(e) => setCreationMode(e.target.value as 'single' | 'multiple')}
                    className="mr-2"
                  />
                  단일 생성
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="multiple"
                    checked={creationMode === 'multiple'}
                    onChange={(e) => setCreationMode(e.target.value as 'single' | 'multiple')}
                    className="mr-2"
                  />
                  여러 건 생성
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">업체 선택 *</label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="업체명으로 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">선택하세요</option>
                  {filteredClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
                {searchQuery && (
                  <p className="text-xs text-gray-500">
                    검색 결과: {filteredClients.length}개
                  </p>
                )}
              </div>
            </div>

            {selectedClient && (
              <div className="bg-blue-50 p-4 rounded">
                <p className="text-sm text-gray-600 mb-2">기본 가이드:</p>
                <p className="text-sm">{selectedClient.base_guide}</p>
              </div>
            )}

            {creationMode === 'single' ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">가이드 모드</label>
                  <div className="flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="append"
                        checked={guideMode === 'append'}
                        onChange={(e) => setGuideMode(e.target.value as 'append')}
                        className="mr-2"
                      />
                      기본 가이드에 추가
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="override"
                        checked={guideMode === 'override'}
                        onChange={(e) => setGuideMode(e.target.value as 'override')}
                        className="mr-2"
                      />
                      기본 가이드 덮어쓰기
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">가이드 텍스트 *</label>
                  <textarea
                    required
                    value={customGuide}
                    onChange={(e) => setCustomGuide(e.target.value)}
                    className="w-full px-3 py-2 border rounded"
                    rows={8}
                    placeholder="이번 작업에 대한 가이드라인을 입력하세요..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">이미지 (선택)</label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded p-8 text-center cursor-pointer ${
                      isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <input {...getInputProps()} />
                    {isDragActive ? (
                      <p>이미지를 여기에 놓으세요...</p>
                    ) : (
                      <p>이미지를 드래그하거나 클릭하여 업로드하세요</p>
                    )}
                  </div>
                  {images.length > 0 && (
                    <div className="mt-4 grid grid-cols-4 gap-4">
                      {images.map((image, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* 여러 건 생성 모드 */}
                <div className="space-y-4">
                  {multipleJobs.map((job, jobIndex) => (
                    <div key={job.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">원고 {jobIndex + 1}</h3>
                        {multipleJobs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeJob(job.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            삭제
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        <JobImageDropzone
                          jobId={job.id}
                          images={job.images}
                          onAddImages={(files) => addImageToJob(job.id, files)}
                          onRemoveImage={(index) => removeImageFromJob(job.id, index)}
                        />

                        <div>
                          <label className="flex items-center mb-2">
                            <input
                              type="checkbox"
                              checked={job.useBaseGuide}
                              onChange={() => toggleUseBaseGuide(job.id)}
                              className="mr-2"
                            />
                            <span className="text-sm">기본 가이드 사용</span>
                          </label>
                          {!job.useBaseGuide && (
                            <textarea
                              required={!job.useBaseGuide}
                              value={job.guide}
                              onChange={(e) => updateJobGuide(job.id, e.target.value)}
                              className="w-full px-3 py-2 border rounded"
                              rows={6}
                              placeholder="이 원고에 대한 가이드라인을 입력하세요..."
                            />
                          )}
                          {job.useBaseGuide && job.guide && (
                            <textarea
                              value={job.guide}
                              onChange={(e) => updateJobGuide(job.id, e.target.value)}
                              className="w-full px-3 py-2 border rounded mt-2"
                              rows={4}
                              placeholder="기본 가이드에 추가할 내용 (선택)"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addJob}
                    className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded text-gray-600 hover:border-blue-500 hover:text-blue-600"
                  >
                    + 원고 추가
                  </button>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">글 타입 *</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="review"
                    checked={contentType === 'review'}
                    onChange={(e) => setContentType(e.target.value as 'review')}
                    className="mr-2"
                  />
                  후기형
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="info"
                    checked={contentType === 'info'}
                    onChange={(e) => setContentType(e.target.value as 'info')}
                    className="mr-2"
                  />
                  정보형
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">원고 길이 *</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="1000"
                    checked={lengthHint === 1000}
                    onChange={(e) => setLengthHint(Number(e.target.value) as 1000 | 1500)}
                    className="mr-2"
                  />
                  1000자
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="1500"
                    checked={lengthHint === 1500}
                    onChange={(e) => setLengthHint(Number(e.target.value) as 1000 | 1500)}
                    className="mr-2"
                  />
                  1500자
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">추가 요청사항</label>
              <textarea
                value={humanExtraPrompt}
                onChange={(e) => setHumanExtraPrompt(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                rows={3}
                placeholder="추가로 요청할 사항이 있으면 입력하세요 (모든 원고에 공통 적용)"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading
                ? '생성 중...'
                : creationMode === 'multiple'
                ? `원고 ${multipleJobs.length}건 일괄 생성`
                : '원고 생성 시작'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">로딩 중...</div>}>
      <NewJobPageContent />
    </Suspense>
  );
}

