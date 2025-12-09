'use client';

import { useState, useEffect } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Client } from '@/lib/types';

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [authChecked, setAuthChecked] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    place_url: '',
    category: '',
    base_guide: '',
    keywords: '',
    memo: '',
    requires_confirmation: false,
  });

  const categories = [
    '네일',
    '속눈썹/눈썹/메이크업',
    '왁싱/피부관리/체형관리',
    '미용실',
    '꽃집/공방',
    '맛집/술집',
    '카페/디저트',
    'PT/필라테스',
    '스포츠/운동',
    '자동차',
    '인테리어',
    '핸드폰',
    '반려동물',
    '학원/스터디카페',
    '펜션/숙소/민박/호텔',
    '공간대여/파티룸/스튜디오',
    '기타',
  ];

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
      setAuthChecked(true);
      fetchClients();
    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    }
  };

  useEffect(() => {
    if (authChecked) {
      fetchClients();
    }
  }, [authChecked]);

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
    setCurrentPage(1); // 검색 시 첫 페이지로 리셋
  }, [searchQuery, clients]);

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/clients');
      const data = await res.json();
      setClients(data.clients || []);
      setFilteredClients(data.clients || []);
    } catch (error) {
      console.error('클라이언트 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      place_url: client.place_url || '',
      category: client.category || '',
      base_guide: client.base_guide || '',
      keywords: client.keywords || '',
      memo: client.memo || '',
      requires_confirmation: client.requires_confirmation || false,
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingClient(null);
    setFormData({
      name: '',
      place_url: '',
      category: '',
      base_guide: '',
      keywords: '',
      memo: '',
      requires_confirmation: false,
    });
  };

  const handleDelete = async (clientId: string, clientName: string) => {
    if (!confirm(`"${clientName}" 업체를 정말 삭제하시겠습니까? 관련된 모든 작업과 원고도 함께 삭제되며 복구할 수 없습니다.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '업체 삭제 실패');
      }

      alert('업체가 삭제되었습니다.');
      fetchClients();
    } catch (error) {
      console.error('업체 삭제 오류:', error);
      alert(`업체 삭제 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      if (editingClient) {
        // 수정
        res = await fetch(`/api/clients/${editingClient.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else {
        // 등록
        res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (res.ok) {
        setShowForm(false);
        setEditingClient(null);
        setFormData({
          name: '',
          place_url: '',
          category: '',
          base_guide: '',
          keywords: '',
          memo: '',
          requires_confirmation: false,
        });
        fetchClients();
        alert(editingClient ? '업체 정보가 수정되었습니다.' : '업체가 등록되었습니다.');
      } else {
        alert(editingClient ? '업체 수정에 실패했습니다.' : '업체 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('업체 처리 오류:', error);
      alert('처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">업체 관리</h1>
          <div className="flex gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              홈
            </Link>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {showForm ? '취소' : '업체 등록'}
            </button>
          </div>
        </div>

        {/* 검색 필터 */}
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="업체명으로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                초기화
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-sm text-gray-600 mt-2">
              검색 결과: {filteredClients.length}개
            </p>
          )}
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingClient ? '업체 정보 수정' : '새 업체 등록'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">업체명 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">플레이스 URL</label>
                <input
                  type="url"
                  value={formData.place_url}
                  onChange={(e) => setFormData({ ...formData, place_url: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="https://place.map.kakao.com/..."
                />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requires_confirmation}
                    onChange={(e) => setFormData({ ...formData, requires_confirmation: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">컨펌을 받아야 하는 업체</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">체크 시 광고주 컨펌이 필요한 업체로 표시됩니다</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">업종</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">기본 가이드 *</label>
                <textarea
                  required
                  value={formData.base_guide}
                  onChange={(e) => setFormData({ ...formData, base_guide: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={5}
                  placeholder="업체에 대한 기본 가이드라인을 입력하세요..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">키워드</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="예: 맛집, 카페, 브런치, 데이트코스 (쉼표로 구분)"
                />
                <p className="text-xs text-gray-500 mt-1">원고에 포함할 키워드를 쉼표로 구분하여 입력하세요</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">메모</label>
                <textarea
                  value={formData.memo}
                  onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingClient ? '수정' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">업체명</th>
                <th className="px-4 py-3 text-left">업종</th>
                <th className="px-4 py-3 text-left">플레이스 URL</th>
                <th className="px-4 py-3 text-left">등록일</th>
                <th className="px-4 py-3 text-left">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? '검색 결과가 없습니다.' : '등록된 업체가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredClients
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((client) => (
                  <tr key={client.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{client.name}</td>
                    <td className="px-4 py-3">{client.category || '-'}</td>
                    <td className="px-4 py-3">
                      {client.place_url ? (
                        <a
                          href={client.place_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          링크
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(client.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(client)}
                          className="text-blue-600 hover:underline"
                        >
                          수정
                        </button>
                        <span className="text-gray-300">|</span>
                        <Link
                          href={`/jobs/new?client_id=${client.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          작업 생성
                        </Link>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleDelete(client.id, client.name)}
                          className="text-red-600 hover:underline"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {filteredClients.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              전체 {filteredClients.length}개 중 {Math.min((currentPage - 1) * itemsPerPage + 1, filteredClients.length)}-{Math.min(currentPage * itemsPerPage, filteredClients.length)}개 표시
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
                {Array.from({ length: Math.ceil(filteredClients.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter((page) => {
                    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, index, array) => {
                    const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
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
                onClick={() => setCurrentPage((prev) => Math.min(Math.ceil(filteredClients.length / itemsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(filteredClients.length / itemsPerPage)}
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

