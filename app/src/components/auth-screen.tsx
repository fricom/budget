import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

type AuthMode = 'signIn' | 'signUp';

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (message.includes('Email not confirmed')) return '이메일 인증을 완료한 뒤 로그인해 주세요.';
  if (message.includes('User already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (message.toLowerCase().includes('password')) return '비밀번호는 6자 이상 입력해 주세요.';
  return message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function AuthScreen() {
  const theme = useTheme();
  const { isAnonymous, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(isAnonymous ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && !submitting;

  async function submit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      if (mode === 'signIn') {
        await signIn(email.trim(), password);
      } else {
        const result = await signUp(email.trim(), password);
        if (result.requiresEmailConfirmation) {
          setNotice('인증 메일을 보냈어요. 메일에서 인증한 뒤 로그인해 주세요.');
        }
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setErrorMessage(null);
    setNotice(null);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brandRow}>
          <View style={[styles.brandDot, { backgroundColor: theme.primary }]} />
          <ThemedText type="smallBold">BUDGET</ThemedText>
        </View>

        <View style={styles.intro}>
          <ThemedText style={styles.title}>우리 가족의 돈 루틴을{`\n`}이어서 관리해요</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            계정으로 로그인하면 이 기기에서는 다음부터 바로 홈에서 시작합니다.
          </ThemedText>
        </View>

        {isAnonymous && (
          <View style={[styles.savedDataCard, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>저장된 설정이 있어요</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              회원가입하면 현재 브라우저의 가구 설정과 온보딩 기록을 그대로 계정에 연결해 드려요.
            </ThemedText>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View style={[styles.modeTabs, { backgroundColor: theme.background }]}>
            {([
              ['signIn', '로그인'],
              ['signUp', '회원가입'],
            ] as const).map(([value, label]) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === value }}
                key={value}
                onPress={() => changeMode(value)}
                style={[
                  styles.modeTab,
                  mode === value && { backgroundColor: theme.backgroundElement },
                ]}>
                <ThemedText
                  type="smallBold"
                  themeColor={mode === value ? 'text' : 'textSecondary'}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.fields}>
            <View style={styles.field}>
              <ThemedText type="smallBold">이메일</ThemedText>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                editable={!submitting}
                keyboardType="email-address"
                onChangeText={setEmail}
                onSubmitEditing={submit}
                placeholder="name@example.com"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="next"
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
                ]}
                value={email}
              />
            </View>

            <View style={styles.field}>
              <ThemedText type="smallBold">비밀번호</ThemedText>
              <TextInput
                autoCapitalize="none"
                autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                editable={!submitting}
                onChangeText={setPassword}
                onSubmitEditing={submit}
                placeholder="6자 이상 입력"
                placeholderTextColor={theme.textSecondary}
                returnKeyType="done"
                secureTextEntry
                style={[
                  styles.input,
                  { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
                ]}
                value={password}
              />
            </View>
          </View>

          {errorMessage && (
            <View style={[styles.feedback, { backgroundColor: theme.dangerSoft }]}>
              <ThemedText type="small" style={{ color: theme.danger }}>{errorMessage}</ThemedText>
            </View>
          )}
          {notice && (
            <View style={[styles.feedback, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>{notice}</ThemedText>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!canSubmit}
            onPress={submit}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: theme.primary },
              !canSubmit && styles.disabled,
              pressed && canSubmit && styles.pressed,
            ]}>
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText type="smallBold" style={styles.submitLabel}>
                {mode === 'signIn'
                  ? '로그인하고 시작하기'
                  : isAnonymous
                    ? '현재 데이터에 계정 연결하기'
                    : '계정 만들고 시작하기'}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  content: { padding: Spacing.four, gap: Spacing.four },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  brandDot: { width: 9, height: 9, borderRadius: 5 },
  intro: { gap: Spacing.two },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  description: { fontSize: 14, lineHeight: 21 },
  savedDataCard: { borderRadius: 18, padding: Spacing.three, gap: Spacing.one },
  card: { borderWidth: 1, borderRadius: 24, padding: Spacing.three, gap: Spacing.three },
  modeTabs: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  modeTab: { flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: Spacing.three },
  field: { gap: Spacing.two },
  input: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 15 },
  feedback: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  submitButton: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitLabel: { color: '#FFFFFF' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
});
