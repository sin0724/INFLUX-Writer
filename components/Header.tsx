'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';

interface AdminSession {
  id: string;
  username: string;
  role: 'super_admin' | 'admin';
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
    
    // pathname이 변경될 때마다 세션 다시 확인
    const handleStorageChange = () => {
      checkSession();
    };
    
    // localStorage 변경 감지
    window.addEventListener('storage', handleStorageChange);
    
    // 커스텀 이벤트로 로그인 시 세션 업데이트
    window.addEventListener('admin-login', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('admin-login', handleStorageChange);
    };
  }, [pathname]);

  const checkSession = () => {
    try {
      const sessionStr = localStorage.getItem('admin_session');
      if (sessionStr) {
        const sessionData = JSON.parse(sessionStr);
        setSession(sessionData);
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('세션 확인 오류:', error);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('admin_session');
      setSession(null);
      router.push('/login');
    } catch (error) {
      console.error('로그아웃 오류:', error);
    }
  };

  // 로그인 페이지에서는 헤더를 표시하지 않음
  if (pathname === '/login') {
    return null;
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-gray-900">
              INFLUX Writer
            </Link>
            {session?.role === 'super_admin' && (
              <nav className="hidden md:flex gap-4">
                <Link
                  href="/admin"
                  className={`px-3 py-1 rounded hover:bg-gray-100 ${
                    pathname === '/admin' ? 'text-blue-600 font-medium' : 'text-gray-600'
                  }`}
                >
                  어드민 관리
                </Link>
              </nav>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-sm text-gray-500">로딩 중...</span>
            ) : session ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded">
                  <span className="text-sm text-gray-600">로그인:</span>
                  <span className="text-sm font-medium text-blue-700">{session.username}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    session.role === 'super_admin' 
                      ? 'bg-purple-100 text-purple-700' 
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {session.role === 'super_admin' ? '슈퍼어드민' : '어드민'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

