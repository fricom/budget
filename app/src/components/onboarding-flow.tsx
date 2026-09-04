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
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addHouseholdMember,
  createHousehold,
  getInvitePreview,
  joinHousehold,
  type InvitePreviewRow,
} from '@/lib/households';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

type Step =
  | { name: 'prologue' }
  | { name: 'household-count' }
  | { name: 'household-names' }
  | { name: 'household-success'; inviteCode: string }
  | { name: 'join-code' }
  | { name: 'join-pick'; householdName: string | null; members: InvitePreviewRow[] }
  | { name: 'join-success'; memberName: string };

const stepNumber: Partial<Record<Step['name'], number>> = {
  'household-count': 1,
  'household-names': 2,
  'household-success': 3,
  'join-code': 1,
  'join-pick': 2,
  'join-success': 3,
};

export function OnboardingFlow() {
  const theme = useTheme();
  const [step, setStep] = useState<Step>({ name: 'prologue' });
  const [memberCount, setMemberCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '']);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goBack() {
    setError(null);
    if (step.name === 'household-names') setStep({ name: 'household-count' });
    else if (step.name === 'join-pick') setStep({ name: 'join-code' });
    else setStep({ name: 'prologue' });
  }

  function selectCount(count: number) {
    setMemberCount(count);
    setNames((prev) => {
      const next = [...prev];
      while (next.length < count) next.push('');
      return next.slice(0, count);
    });
  }

  async function submitHousehold() {
    setError(null);
    if (names.some((name) => name.trim().length === 0)) {
      setError('모든 가구원의 이름을 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const first = await createHousehold(`${names[0].trim()}네 가족`, names[0].trim());
      for (let i = 1; i < names.length; i++) {
        await addHouseholdMember(first.household_id, i + 1, names[i].trim());
      }
      const { supabase } = await import('@/lib/supabase');
      const { data, error: fetchError } = await supabase
        .from('households')
        .select('invite_code')
        .eq('id', first.household_id)
        .single();
      if (fetchError) throw fetchError;
      setStep({ name: 'household-success', inviteCode: data.invite_code as string });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitInviteCode() {
    setError(null);
    if (!inviteCodeInput.trim()) {
      setError('초대코드를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const rows = await getInvitePreview(inviteCodeInput.trim());
      if (rows.length === 0) {
        setError('초대코드를 찾을 수 없어요. 다시 확인해주세요.');
        return;
      }
      setStep({ name: 'join-pick', householdName: rows[0].household_name, members: rows });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickMember(memberId: string, memberName: string) {
    setError(null);
    setBusy(true);
    try {
      await joinHousehold(inviteCodeInput.trim(), memberId);
      setStep({ name: 'join-success', memberName });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const currentStep = stepNumber[step.name];
  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }];
  const primaryButtonStyle = ({ pressed }: { pressed: boolean }) => [
    styles.primaryButton,
    { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {step.name !== 'prologue' && (
        <>
          <View pointerEvents="none" style={[styles.glow, styles.glowTop, { backgroundColor: theme.primarySoft }]} />
          <View pointerEvents="none" style={[styles.glow, styles.glowBottom, { backgroundColor: theme.accent }]} />
        </>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scrollContent, step.name === 'prologue' && styles.prologueScrollContent]}
        showsVerticalScrollIndicator={false}>
        {step.name !== 'prologue' && (
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="이전으로" hitSlop={12} onPress={goBack}>
              <View style={[styles.backButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText style={styles.backIcon}>‹</ThemedText>
              </View>
            </Pressable>
            <View style={[styles.brandPill, { backgroundColor: theme.primarySoft }]}>
              <View style={[styles.brandDot, { backgroundColor: theme.primary }]} />
              <ThemedText type="smallBold" style={{ color: theme.primary }}>BUDGET</ThemedText>
            </View>
            {currentStep ? <ThemedText type="smallBold" themeColor="textSecondary">{currentStep} / 3</ThemedText> : <View style={styles.backButton} />}
          </View>
        )}

        <View style={[
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          step.name === 'prologue' && styles.prologueCard,
        ]}>
          {step.name === 'prologue' && (
            <View style={styles.prologueBody}>
              <ThemedText type="title" style={styles.prologueTitle}>버짓 앱에 오신 걸 환영해요</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.prologueCopy}>
                버짓앱은 가족 단위로 예산을 관리하는 가계부 서비스예요.{`\n\n`}
                버짓앱을 사용하기 위해서는 다음과 같은 초기 정보가 있을 때 빈틈없는 가계운영이 가능해요!{`\n\n`}
                · 주거비: 대출금 / 주거 관리비 / 통신비 / 재산세{`\n`}
                · 보험비: 월 평균 보험비{`\n\n`}
                지금 입력하지 않아도 추후 입력으로 세팅 가능해요.
              </ThemedText>
              <Pressable style={primaryButtonStyle} onPress={() => setStep({ name: 'household-count' })}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>시작할게요</ThemedText>
              </Pressable>
            </View>
          )}

          {step.name === 'household-count' && (
            <View style={styles.stepBody}>
              <View style={styles.copyBlock}>
                <ThemedText type="eyebrow" style={{ color: theme.primary }}>가족 구성</ThemedText>
                <ThemedText type="subtitle">몇 명이 함께 쓰나요?</ThemedText>
                <ThemedText themeColor="textSecondary">지출을 구분할 가구원 수를 알려주세요. 최대 5명까지 함께할 수 있어요.</ThemedText>
              </View>
              <View style={styles.countGrid}>
                {[1, 2, 3, 4, 5].map((count) => {
                  const selected = memberCount === count;
                  return (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      key={count}
                      style={({ pressed }) => [
                        styles.countChip,
                        { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primarySoft : theme.background },
                        pressed && styles.pressed,
                      ]}
                      onPress={() => selectCount(count)}>
                      <ThemedText style={[styles.countNumber, selected && { color: theme.primary }]}>{count}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{count === 1 ? '명' : '명 함께'}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={primaryButtonStyle} onPress={() => setStep({ name: 'household-names' })}>
                <ThemedText type="smallBold" style={styles.primaryButtonText}>다음</ThemedText>
              </Pressable>
            </View>
          )}

          {step.name === 'household-names' && (
            <View style={styles.stepBody}>
              <View style={styles.copyBlock}>
                <ThemedText type="eyebrow" style={{ color: theme.primary }}>가구원 등록</ThemedText>
                <ThemedText type="subtitle">가족을 어떻게 부를까요?</ThemedText>
                <ThemedText themeColor="textSecondary">이름이나 편한 별명을 입력해주세요.</ThemedText>
              </View>
              <View style={styles.fields}>
                {names.map((name, index) => (
                  <View key={index} style={styles.fieldGroup}>
                    <ThemedText type="smallBold">가구원 {index + 1}{index === 0 ? ' · 나' : ''}</ThemedText>
                    <TextInput
                      style={inputStyle}
                      placeholder={index === 0 ? '내 이름 또는 별명' : '이름 또는 별명'}
                      placeholderTextColor={theme.textSecondary}
                      value={name}
                      onChangeText={(text) => setNames((prev) => prev.map((item, itemIndex) => itemIndex === index ? text : item))}
                      returnKeyType={index === names.length - 1 ? 'done' : 'next'}
                    />
                  </View>
                ))}
              </View>
              <ErrorMessage message={error} />
              <Pressable style={primaryButtonStyle} onPress={submitHousehold} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>가족 구성 등록하기</ThemedText>}
              </Pressable>
            </View>
          )}

          {step.name === 'household-success' && (
            <SuccessPanel
              title="우리 가족 공간이 생겼어요!"
              description="아래 코드를 가족에게 공유하면 같은 가계부에 연결할 수 있어요."
              theme={theme}
              inviteCode={step.inviteCode}
            />
          )}

          {step.name === 'join-code' && (
            <View style={styles.stepBody}>
              <View style={[styles.smallIcon, { backgroundColor: theme.primarySoft }]}><ThemedText style={{ color: theme.primary }}>⌁</ThemedText></View>
              <View style={styles.copyBlock}>
                <ThemedText type="eyebrow" style={{ color: theme.primary }}>가족과 연결</ThemedText>
                <ThemedText type="subtitle">초대코드를 입력해주세요</ThemedText>
                <ThemedText themeColor="textSecondary">가족에게 받은 코드를 그대로 입력하면 돼요.</ThemedText>
              </View>
              <TextInput
                autoFocus
                style={[inputStyle, styles.codeInput]}
                placeholder="예: FAMILY26"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="characters"
                autoCorrect={false}
                value={inviteCodeInput}
                onChangeText={setInviteCodeInput}
                onSubmitEditing={submitInviteCode}
              />
              <ErrorMessage message={error} />
              <Pressable style={primaryButtonStyle} onPress={submitInviteCode} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>가족 찾기</ThemedText>}
              </Pressable>
            </View>
          )}

          {step.name === 'join-pick' && (
            <View style={styles.stepBody}>
              <View style={styles.copyBlock}>
                <ThemedText type="eyebrow" style={{ color: theme.primary }}>가족을 찾았어요</ThemedText>
                <ThemedText type="subtitle">{step.householdName ?? '우리 가족'}</ThemedText>
                <ThemedText themeColor="textSecondary">목록에서 나를 선택해주세요.</ThemedText>
              </View>
              <View style={styles.memberList}>
                {step.members.map((member) => (
                  <Pressable
                    key={member.member_id}
                    disabled={member.is_claimed || busy}
                    onPress={() => pickMember(member.member_id, member.member_name)}
                    style={({ pressed }) => [
                      styles.memberButton,
                      { backgroundColor: theme.background, borderColor: theme.border },
                      (pressed || member.is_claimed) && styles.pressed,
                    ]}>
                    <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                      <ThemedText type="smallBold" style={{ color: theme.primary }}>{member.member_name.slice(0, 1)}</ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={styles.memberName}>{member.member_name}</ThemedText>
                    <ThemedText type="small" style={{ color: member.is_claimed ? theme.textSecondary : theme.primary }}>
                      {member.is_claimed ? '연결됨' : '선택  →'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ErrorMessage message={error} />
            </View>
          )}

          {step.name === 'join-success' && (
            <SuccessPanel
              title={`${step.memberName}님, 반가워요!`}
              description="가족 가계부에 안전하게 연결됐어요. 이제 함께 예산을 만들어볼까요?"
              theme={theme}
            />
          )}
        </View>
        {step.name !== 'prologue' && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerText}>가족의 금융 정보는 안전하게 보호돼요</ThemedText>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ErrorMessage({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;
  return (
    <View style={[styles.errorBox, { backgroundColor: theme.dangerSoft }]}>
      <ThemedText type="small" style={{ color: theme.danger }}>!  {message}</ThemedText>
    </View>
  );
}

function SuccessPanel({ title, description, theme, inviteCode }: {
  title: string;
  description: string;
  theme: ReturnType<typeof useTheme>;
  inviteCode?: string;
}) {
  return (
    <View style={[styles.stepBody, styles.successPanel]}>
      <View style={[styles.successIcon, { backgroundColor: theme.primarySoft }]}>
        <ThemedText style={[styles.check, { color: theme.primary }]}>✓</ThemedText>
      </View>
      <View style={[styles.copyBlock, styles.centerCopy]}>
        <ThemedText type="eyebrow" style={{ color: theme.primary }}>설정 완료</ThemedText>
        <ThemedText type="subtitle" style={styles.centerText}>{title}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centerText}>{description}</ThemedText>
      </View>
      {inviteCode && (
        <View style={[styles.inviteCodeBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">우리 가족 초대코드</ThemedText>
          <ThemedText style={[styles.inviteCode, { color: theme.primary }]} selectable>{inviteCode}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">길게 눌러 복사할 수 있어요</ThemedText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.four, gap: Spacing.three },
  prologueScrollContent: { justifyContent: 'flex-start', paddingTop: 70, paddingBottom: 30, gap: 0 },
  glow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.55 },
  glowTop: { top: -150, right: -110 },
  glowBottom: { bottom: -210, left: -140, opacity: 0.16 },
  topBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  backIcon: { fontSize: 30, lineHeight: 32, marginTop: -3 },
  brandPill: { minHeight: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: 'row', gap: 7, alignItems: 'center' },
  brandDot: { width: 7, height: 7, borderRadius: 4 },
  card: { width: '100%', borderRadius: 30, borderWidth: 1, padding: Spacing.four, shadowColor: '#0B2717', shadowOffset: { width: 0, height: 18 }, shadowOpacity: 0.08, shadowRadius: 32, elevation: 4 },
  prologueCard: { flex: 1, borderRadius: 16, borderWidth: 0, paddingHorizontal: 22, paddingTop: 32, paddingBottom: 28, shadowColor: '#1A264D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 2 },
  prologueBody: { gap: 20 },
  prologueTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  prologueCopy: { lineHeight: 17, fontWeight: '400' },
  stepBody: { gap: Spacing.four },
  copyBlock: { gap: Spacing.two },
  heroIcon: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  wallet: { width: 43, height: 34, borderRadius: 10, justifyContent: 'center', paddingLeft: 9 },
  walletLine: { width: 14, height: 3, borderRadius: 2 },
  walletCoin: { position: 'absolute', right: -4, width: 14, height: 14, borderRadius: 7, borderWidth: 3, borderColor: '#FFFFFF' },
  benefitList: { gap: Spacing.three, paddingVertical: Spacing.one },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  numberBadge: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 48, borderRadius: 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  primaryButtonText: { color: '#FFFFFF' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  countChip: { flexGrow: 1, minWidth: 82, minHeight: 82, borderWidth: 1.5, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  countNumber: { fontSize: 25, lineHeight: 30, fontWeight: '700' },
  fields: { gap: Spacing.three },
  fieldGroup: { gap: Spacing.two },
  input: { minHeight: 54, borderWidth: 1, borderRadius: 16, paddingHorizontal: Spacing.three, paddingVertical: 14, fontSize: 16, fontFamily: Fonts.sans },
  codeInput: { minHeight: 66, fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  errorBox: { borderRadius: 14, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  smallIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberList: { gap: Spacing.two },
  memberButton: { minHeight: 64, borderRadius: 18, borderWidth: 1, paddingHorizontal: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1 },
  successPanel: { alignItems: 'center', paddingVertical: Spacing.three },
  successIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  centerCopy: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  inviteCodeBox: { width: '100%', borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', padding: Spacing.four, alignItems: 'center', gap: Spacing.two },
  inviteCode: { fontFamily: Fonts.mono, fontSize: 28, lineHeight: 36, fontWeight: '800', letterSpacing: 4 },
  footerText: { textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
