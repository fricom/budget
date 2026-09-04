import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

type HouseholdStatus = 'loading' | 'onboarding' | 'ready';

type HouseholdContextValue = {
  status: HouseholdStatus;
  completeOnboarding: () => void;
};

const HouseholdContext = createContext<HouseholdContextValue>({
  status: 'loading',
  completeOnboarding: () => undefined,
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<HouseholdStatus>('loading');

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
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1);

      if (!active) return;
      if (error) {
        console.error('household membership check failed', error);
        setStatus('onboarding');
        return;
      }
      setStatus(data.length > 0 ? 'ready' : 'onboarding');
    }

    checkMembership();
    return () => {
      active = false;
    };
  }, [authLoading, session?.user.id]);

  const completeOnboarding = useCallback(() => setStatus('ready'), []);

  return (
    <HouseholdContext.Provider value={{ status, completeOnboarding }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHouseholdStatus() {
  return useContext(HouseholdContext);
}
