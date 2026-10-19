import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// expo-router web은 SSR(Node) 패스로도 이 모듈을 로드하는데, 그 환경엔 window가 없어서
// AsyncStorage의 web 구현체가 즉시 크래시함. SSR을 제외한 웹/네이티브 클라이언트에만 storage를 붙임.
const isServerRenderedWeb = Platform.OS === 'web' && typeof window === 'undefined';
const isBrowser = Platform.OS === 'web' && !isServerRenderedWeb;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: isServerRenderedWeb ? undefined : AsyncStorage,
    autoRefreshToken: !isServerRenderedWeb,
    persistSession: !isServerRenderedWeb,
    detectSessionInUrl: isBrowser,
  },
});
