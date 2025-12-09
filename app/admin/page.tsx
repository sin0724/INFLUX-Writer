'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Admin {
  id: string;
  username: string;
  role: 'super_admin' | 'admin';
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin' as 'super_admin' | 'admin',
  });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const sessionStr = localStorage.getItem('admin_session');
      if (!sessionStr) {
        router.push('/login');
        return;
      }

      const sessionData = JSON.parse(sessionStr);
      setSession(sessionData);

      if (sessionData.role === 'super_admin') {
        fetchAdmins();
      } else {
        setLoading(false);
      }
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admins');
      if (res.status === 403) {
        alert('권한이 없습니다.');
        router.push('/');
        return;
      }
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('어드민 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('admin_session');
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setShowForm(false);
        setFormData({ username: '', password: '', role: 'admin' });
        fetchAdmins();
        alert('어드민 계정이 생성되었습니다.');
      } else {
        alert(data.error || '어드민 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('어드민 생성 오류:', error);
      alert('어드민 생성 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="p-8">로딩 중...</div>;
  }

  if (!session || session.role !== 'super_admin') {
    return (
      <div className="p-8">
        <p>슈퍼어드민만 접근할 수 있습니다.</p>
        <Link href="/" className="text-blue-600 hover:underline">홈으로</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">어드민 관리</h1>
          <p className="text-gray-600">현재 로그인: <strong>{session.username}</strong> ({session.role})</p>
        </div>

        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow-md mb-6">
            <h2 className="text-xl font-semibold mb-4">새 어드민 계정 생성</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">아이디 *</label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">비밀번호 *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">역할 *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'super_admin' | 'admin' })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="admin">일반 어드민</option>
                  <option value="super_admin">슈퍼어드민</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  생성
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setFormData({ username: '', password: '', role: 'admin' });
                  }}
                  className="px-6 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">어드민 목록</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showForm ? '취소' : '어드민 생성'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">아이디</th>
                <th className="px-4 py-3 text-left">역할</th>
                <th className="px-4 py-3 text-left">생성일</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    등록된 어드민이 없습니다.
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="border-t">
                    <td className="px-4 py-3 font-medium">{admin.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        admin.role === 'super_admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {admin.role === 'super_admin' ? '슈퍼어드민' : '일반 어드민'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(admin.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

