import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

function getEmailRedirectTo() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/budget/`;
}

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  isAnonymous: false,
  signIn: async () => undefined,
  signUp: async () => ({ requiresEmailConfirmation: false }),
  signOut: async () => undefined,
});

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

      if (mounted) {
        setSession(null);
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

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
  }

  async function signUp(email: string, password: string): Promise<SignUpResult> {
    // 이전 버전에서 만든 익명 세션이 있으면 같은 auth.uid()에 자격 증명을 붙인다.
    // 이미 끝낸 온보딩과 가구 데이터가 그대로 유지된다.
    if (session?.user.is_anonymous) {
      const { data, error } = await supabase.auth.updateUser(
        { email, password },
        { emailRedirectTo: getEmailRedirectTo() },
      );
      if (error) throw error;

      const { data: refreshed } = await supabase.auth.getSession();
      setSession(refreshed.session);
      return { requiresEmailConfirmation: !data.user.email_confirmed_at };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getEmailRedirectTo() },
    });
    if (error) throw error;
    setSession(data.session);
    return { requiresEmailConfirmation: !data.session };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isAnonymous: session?.user.is_anonymous === true,
        signIn,
        signUp,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
