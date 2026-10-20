import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const KAKAO_PROVIDER = 'custom:kakao-no-email';
const KAKAO_SCOPES = 'openid profile_nickname profile_image';

function getEmailRedirectTo() {
  if (typeof window === 'undefined') return undefined;
  const isGitHubPages = window.location.pathname === '/budget'
    || window.location.pathname.startsWith('/budget/');
  return `${window.location.origin}${isGitHubPages ? '/budget/' : '/'}`;
}

function getOAuthRedirectTo() {
  if (Platform.OS === 'web') return getEmailRedirectTo();
  return Linking.createURL('auth/callback');
}

function getOAuthParams(url: string) {
  const parsedUrl = new URL(url);
  const params = new URLSearchParams(parsedUrl.search);
  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));

  hashParams.forEach((value, key) => params.set(key, value));
  return params;
}

async function completeNativeOAuth(url: string, redirectTo: string) {
  const result = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (result.type !== 'success') return;

  const params = getOAuthParams(result.url);
  const oauthError = params.get('error_description') ?? params.get('error');
  if (oauthError) throw new Error(oauthError);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return;
  }

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  }
}

type SignUpResult = {
  requiresEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  kakaoEnabled: boolean | null;
  isAnonymous: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithKakao: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  kakaoEnabled: null,
  isAnonymous: false,
  signIn: async () => undefined,
  signInWithKakao: async () => undefined,
  signUp: async () => ({ requiresEmailConfirmation: false }),
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [kakaoEnabled, setKakaoEnabled] = useState<boolean | null>(null);

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
    getKakaoProviderAvailability().then((available) => {
      if (mounted) setKakaoEnabled(available);
    });

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

  async function signInWithKakao() {
    const kakaoAvailable = kakaoEnabled ?? await getKakaoProviderAvailability();
    setKakaoEnabled(kakaoAvailable);
    if (kakaoAvailable === false) {
      throw new Error('Unsupported provider: provider is not enabled');
    }

    const redirectTo = getOAuthRedirectTo();
    if (!redirectTo) throw new Error('OAuth redirect URL is unavailable.');

    const options = {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      scopes: KAKAO_SCOPES,
    };
    const { data, error } = session?.user.is_anonymous
      ? await supabase.auth.linkIdentity({ provider: KAKAO_PROVIDER, options })
      : await supabase.auth.signInWithOAuth({ provider: KAKAO_PROVIDER, options });

    if (error) throw error;
    if (Platform.OS !== 'web' && data.url) {
      await completeNativeOAuth(data.url, redirectTo);
    }
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
        kakaoEnabled,
        isAnonymous: session?.user.is_anonymous === true,
        signIn,
        signInWithKakao,
        signUp,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

async function getKakaoProviderAvailability(): Promise<boolean | null> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: supabaseKey },
    });
    if (!response.ok) return null;

    const settings = await response.json() as { external?: { kakao?: boolean } };
    return settings.external?.kakao === true;
  } catch {
    return null;
  }
}

export function useAuth() {
  return useContext(AuthContext);
}
