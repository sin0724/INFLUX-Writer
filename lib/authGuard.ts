'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function useAuthGuard() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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

      setIsAuthenticated(true);
    } catch (error) {
      console.error('인증 확인 오류:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  return { isAuthenticated, loading };
}

