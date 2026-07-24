import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

// 임시 부트스트랩: 실제 로그인 화면(이메일/소셜) 만들기 전까지, 세션이 없으면
// Supabase 익명 로그인으로 auth.uid()를 확보해서 온보딩 플로우를 테스트 가능하게 함.
// 나중에 실제 로그인 화면이 생기면 anonymous -> 실계정 업그레이드(linkIdentity)로 전환.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (mounted) {
          setSession(data.session);
          setLoading(false);
        }
        return;
      }

      const { data: anon, error } = await supabase.auth.signInAnonymously();
      if (mounted) {
        if (error) {
          console.error('anonymous sign-in failed', error);
        }
        setSession(anon?.session ?? null);
        setLoading(false);
      }
    }

    bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
