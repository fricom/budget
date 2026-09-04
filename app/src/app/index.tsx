import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeDashboard } from '@/components/home-dashboard';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useHouseholdStatus } from '@/lib/household-context';

export default function HomeScreen() {
  const theme = useTheme();
  const { status, completeOnboarding } = useHouseholdStatus();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {status === 'loading' && <ActivityIndicator style={styles.loader} color={theme.primary} />}
        {status === 'onboarding' && <OnboardingFlow onComplete={completeOnboarding} />}
        {status === 'ready' && <HomeDashboard />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    maxWidth: Math.min(MaxContentWidth, 375),
    width: '100%',
  },
  loader: { flex: 1 },
});
