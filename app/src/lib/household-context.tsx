import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { completeHouseholdOnboarding } from '@/lib/households';
import { supabase } from '@/lib/supabase';

type HouseholdStatus = 'loading' | 'onboarding' | 'ready';

type HouseholdContextValue = {
  status: HouseholdStatus;
  resumeInviteCode: string | null;
  completeOnboarding: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdContextValue>({
  status: 'loading',
  resumeInviteCode: null,
  completeOnboarding: async () => undefined,
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<HouseholdStatus>('loading');
  const [resumeInviteCode, setResumeInviteCode] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkMembership() {
      if (authLoading) return;
      if (!session?.user.id) {
        if (active) setStatus('onboarding');
        return;
      }

      setStatus('loading');
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, households(invite_code, onboarding_completed_at)')
        .eq('user_id', session.user.id)
        .limit(1);

      if (!active) return;
      if (error) {
        console.error('household membership check failed', error);
        setStatus('onboarding');
        return;
      }
      const membership = data[0] as unknown as {
        household_id: string;
        households: { invite_code: string; onboarding_completed_at: string | null } | null;
      } | undefined;
      setResumeInviteCode(membership?.households?.onboarding_completed_at
        ? null
        : membership?.households?.invite_code ?? null);
      setStatus(membership?.households?.onboarding_completed_at ? 'ready' : 'onboarding');
    }

    checkMembership();
    return () => {
      active = false;
    };
  }, [authLoading, session?.user.id]);

  const completeOnboarding = useCallback(async () => {
    await completeHouseholdOnboarding();
    setResumeInviteCode(null);
    setStatus('ready');
  }, []);

  return (
    <HouseholdContext.Provider value={{ status, resumeInviteCode, completeOnboarding }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHouseholdStatus() {
  return useContext(HouseholdContext);
}
