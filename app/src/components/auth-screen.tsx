import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';

type AuthMode = 'signIn' | 'signUp';
type Submission = 'email' | 'kakao' | null;

function getAuthErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  const normalizedMessage = message.toLowerCase();

  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호를 확인해 주세요.';
  if (message.includes('Email not confirmed')) return '이메일 인증을 완료한 뒤 로그인해 주세요.';
  if (message.includes('User already registered')) return '이미 가입된 이메일이에요. 로그인해 주세요.';
  if (normalizedMessage.includes('identity_already_exists')) {
    return '이미 다른 계정에 연결된 카카오 계정이에요.';
  }
  if (normalizedMessage.includes('manual linking') || normalizedMessage.includes('manual_linking')) {
    return '현재 데이터 연결 설정이 아직 준비되지 않았어요.';
  }
  if (normalizedMessage.includes('provider') && normalizedMessage.includes('enabled')) {
    return '카카오 로그인이 아직 준비되지 않았어요.';
  }
  if (normalizedMessage.includes('password')) return '비밀번호는 6자 이상 입력해 주세요.';
  return message || '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
}

function AgreementCheckbox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.agreementRow, pressed && styles.pressed]}>
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? theme.primary : '#8B929B' },
          checked && { backgroundColor: theme.primary },
        ]}>
        {checked && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </View>
      <ThemedText style={styles.agreementLabel}>{label}</ThemedText>
    </Pressable>
  );
}

export function AuthScreen() {
  const theme = useTheme();
  const { isAnonymous, kakaoEnabled, signIn, signInWithKakao, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(isAnonymous ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submission, setSubmission] = useState<Submission>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 6 && submission === null;
  const kakaoUnavailable = kakaoEnabled === false;

  async function submit() {
    if (!canSubmit) return;
    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('필수 약관에 모두 동의해 주세요.');
      return;
    }

    setSubmission('email');
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
      setSubmission(null);
    }
  }

  async function submitKakao() {
    if (submission !== null) return;
    if (kakaoUnavailable) {
      setErrorMessage('카카오 로그인이 아직 준비되지 않았어요.');
      return;
    }
    if (!termsAccepted || !privacyAccepted) {
      setErrorMessage('필수 약관에 모두 동의해 주세요.');
      return;
    }

    setSubmission('kakao');
    setErrorMessage(null);
    setNotice(null);

    try {
      await signInWithKakao();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmission(null);
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.brandRow}>
            <Image
              accessibilityIgnoresInvertColors
              source={require('../../assets/images/auth-brand-mark.svg')}
              style={styles.brandMark}
            />
            <ThemedText style={styles.brandLabel}>BUDGET</ThemedText>
          </View>

          <View style={styles.intro}>
            <ThemedText style={styles.title}>카카오로 빠르게 로그인하고{`\n`}바로 홈에서 시작해요</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.description}>
              한 번 로그인하면 다음부터 온보딩 없이{`\n`}우리 가족의 예산 화면으로 바로 돌아갈 수 있어요.
            </ThemedText>
          </View>

          <View style={styles.agreements}>
            <AgreementCheckbox
              checked={termsAccepted}
              label="이용약관 동의 (필수)"
              onPress={() => {
                setTermsAccepted((value) => !value);
                setErrorMessage(null);
              }}
            />
            <AgreementCheckbox
              checked={privacyAccepted}
              label="개인정보 처리방침 동의 (필수)"
              onPress={() => {
                setPrivacyAccepted((value) => !value);
                setErrorMessage(null);
              }}
            />
          </View>

          <Pressable
            accessibilityLabel="카카오로 3초 만에 시작하기"
            accessibilityRole="button"
            disabled={submission !== null || kakaoUnavailable}
            onPress={submitKakao}
            style={({ pressed }) => [
              styles.kakaoButton,
              (submission !== null || kakaoUnavailable) && styles.disabled,
              pressed && submission === null && !kakaoUnavailable && styles.pressed,
            ]}>
              {submission === 'kakao' ? (
                <ActivityIndicator color="#191919" />
              ) : (
                <>
                  <Image
                    accessibilityIgnoresInvertColors
                    source={require('../../assets/images/kakao-login.svg')}
                    style={styles.kakaoIcon}
                  />
                  <ThemedText style={styles.kakaoLabel}>
                    {kakaoUnavailable ? '카카오 로그인 준비 중' : '카카오로 3초 만에 시작하기'}
                  </ThemedText>
                </>
              )}
          </Pressable>

            {kakaoUnavailable && (
              <ThemedText style={styles.providerNotice} themeColor="textSecondary">
                관리자 설정이 완료되면 바로 사용할 수 있어요.
              </ThemedText>
            )}

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <ThemedText style={styles.dividerLabel} themeColor="textSecondary">또는</ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.fields}>
              <View style={styles.field}>
                <ThemedText style={styles.fieldLabel}>이메일</ThemedText>
                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={submission === null}
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
                <ThemedText style={styles.fieldLabel}>비밀번호</ThemedText>
                <TextInput
                  autoCapitalize="none"
                  autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
                  editable={submission === null}
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
                <ThemedText style={[styles.feedbackText, { color: theme.danger }]}>{errorMessage}</ThemedText>
              </View>
            )}
            {notice && (
              <View style={[styles.feedback, { backgroundColor: theme.primarySoft }]}>
                <ThemedText style={[styles.feedbackText, { color: theme.primary }]}>{notice}</ThemedText>
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
              {submission === 'email' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.submitLabel}>
                  {mode === 'signIn'
                    ? '이메일로 로그인'
                    : isAnonymous
                      ? '현재 데이터에 계정 연결하기'
                      : '이메일로 계정 만들기'}
                </ThemedText>
              )}
            </Pressable>

            <View style={styles.accountSwitchRow}>
              <ThemedText style={styles.accountQuestion} themeColor="textSecondary">
                {mode === 'signIn' ? '계정이 없나요?' : '이미 계정이 있나요?'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={submission !== null}
                onPress={() => changeMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
                <ThemedText style={[styles.accountLink, { color: theme.textAccent }]}>
                  {mode === 'signIn' ? '회원가입' : '로그인'}
                </ThemedText>
              </Pressable>
            </View>

          <ThemedText themeColor="textSecondary" style={styles.footer}>
            기존에 저장한 가구 설정도 로그인 후 그대로 이어져요.
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 30,
    paddingHorizontal: Spacing.three,
  },
  card: {
    width: '100%',
    maxWidth: 343,
    minHeight: 712,
    borderRadius: 16,
    paddingTop: 32,
    paddingHorizontal: 22,
    paddingBottom: 28,
    gap: 12,
    alignItems: 'center',
    alignSelf: 'center',
  },
  brandRow: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  brandMark: { width: 9, height: 9 },
  brandLabel: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  intro: { gap: Spacing.two },
  title: { fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -1 },
  description: { fontSize: 14, lineHeight: 22, fontWeight: '400' },
  agreements: { width: '100%', gap: Spacing.two },
  agreementRow: { height: 20, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontWeight: '700' },
  agreementLabel: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '400' },
  kakaoButton: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    backgroundColor: '#FEE500',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  kakaoLabel: { color: '#191919', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  kakaoIcon: { width: 18, height: 18 },
  providerNotice: { width: '100%', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  dividerRow: { width: '100%', height: 18, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: 4 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerLabel: { fontSize: 12, lineHeight: 20, fontWeight: '400' },
  fields: { width: '100%', gap: 12 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 14, lineHeight: 22 },
  feedback: { borderRadius: 12, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  feedbackText: { fontSize: 12, lineHeight: 18 },
  submitButton: { width: '100%', height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  submitLabel: { color: '#FFFFFF', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  accountSwitchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: Spacing.two },
  accountQuestion: { fontSize: 12, lineHeight: 20, fontWeight: '400' },
  accountLink: { fontSize: 12, lineHeight: 20, fontWeight: '600' },
  footer: { width: '100%', textAlign: 'center', fontSize: 12, lineHeight: 20, fontWeight: '400' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
});
