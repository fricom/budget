import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
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
  finalizeOnboarding,
  saveOnboardingProgress,
  type InvitePreviewRow,
  type OnboardingDraft,
} from '@/lib/households';

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

type SimpleStepName =
  | 'prologue'
  | 'household-count'
  | 'household-names'
  | 'income'
  | 'housing'
  | 'insurance'
  | 'vision'
  | 'living'
  | 'savings'
  | 'pension'
  | 'emergency'
  | 'allowance'
  | 'join-code';

type Step =
  | { name: SimpleStepName }
  | { name: 'household-success'; inviteCode: string }
  | { name: 'join-pick'; householdName: string | null; members: InvitePreviewRow[] }
  | { name: 'join-success'; memberName: string };

export function OnboardingFlow({ initialInviteCode, initialStep, initialDraft, onComplete }: {
  initialInviteCode: string | null;
  initialStep: string | null;
  initialDraft: OnboardingDraft;
  onComplete: () => Promise<void>;
}) {
  const theme = useTheme();
  const resumableSteps = ['income', 'housing', 'insurance', 'vision', 'living', 'savings', 'pension', 'emergency', 'allowance'] as const;
  const resumedName = resumableSteps.find((name) => name === initialStep);
  const [step, setStep] = useState<Step>(resumedName
    ? { name: resumedName }
    : initialInviteCode ? { name: 'household-success', inviteCode: initialInviteCode } : { name: 'prologue' });
  const [memberCount, setMemberCount] = useState(3);
  const [names, setNames] = useState<string[]>(['', '', '']);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(
    Object.entries(initialDraft).map(([key, value]) => [key, String(value)]),
  ));

  const money = (key: string) => Number((draft[key] ?? '').replace(/[^0-9]/g, '')) || 0;
  const setMoney = (key: string, value: string) => setDraft((current) => ({
    ...current,
    [key]: value.replace(/[^0-9]/g, ''),
  }));
  const numericDraft = (): OnboardingDraft => Object.fromEntries(
    Object.entries(draft).map(([key, value]) => [key, Number(value) || 0]),
  );
  const formatWon = (value: number) => `${Math.max(0, Math.round(value)).toLocaleString('ko-KR')}원`;
  const totalIncome = money('income_1') + money('income_2');
  const totalFixed = money('loan_payment') + money('housing_fee') + money('telecom_fee')
    + money('property_tax_monthly') + money('insurance_total');
  const availableBudget = Math.max(0, totalIncome - totalFixed);

  async function saveAndGo(next: Step['name'], additions: Record<string, number> = {}) {
    setError(null);
    setBusy(true);
    try {
      const nextDraft = { ...numericDraft(), ...additions };
      await saveOnboardingProgress(next, nextDraft);
      setDraft((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(additions).map(([key, value]) => [key, String(value)])),
      }));
      setStep({ name: next } as Step);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function suggestedGoals(): Record<string, number> {
    const living = Math.round(availableBudget * 4 / 12);
    const savings = Math.round(availableBudget * 4 / 12);
    const pension = Math.round(availableBudget * 2 / 12);
    const emergency = Math.round(availableBudget / 12);
    return { living, savings, pension, emergency, allowance: availableBudget - living - savings - pension - emergency };
  }

  async function beginGoals() {
    const suggestions = suggestedGoals();
    const missing = Object.fromEntries(Object.entries(suggestions).filter(([key]) => !draft[key]));
    await saveAndGo('living', missing);
  }

  async function rebalanceAndGo(currentKey: 'living' | 'savings' | 'pension' | 'emergency', next: Step['name']) {
    const order = ['living', 'savings', 'pension', 'emergency', 'allowance'] as const;
    const weights = { living: 4, savings: 4, pension: 2, emergency: 1, allowance: 1 };
    const currentIndex = order.indexOf(currentKey);
    const fixedKeys = order.slice(0, currentIndex + 1);
    const remainingKeys = order.slice(currentIndex + 1);
    const used = fixedKeys.reduce((sum, key) => sum + money(key), 0);
    const remaining = availableBudget - used;
    if (remaining < 0) {
      setError(`입력 금액이 여유예산 ${formatWon(availableBudget)}을 초과해요.`);
      return;
    }
    const weightTotal = remainingKeys.reduce((sum, key) => sum + weights[key], 0);
    let allocated = 0;
    const additions: Record<string, number> = {};
    remainingKeys.forEach((key, index) => {
      const amount = index === remainingKeys.length - 1
        ? remaining - allocated
        : Math.round(remaining * weights[key] / weightTotal);
      additions[key] = amount;
      allocated += amount;
    });
    await saveAndGo(next, additions);
  }

  async function finishSetup() {
    const data = numericDraft();
    const goalTotal = ['living', 'savings', 'pension', 'emergency', 'allowance']
      .reduce((sum, key) => sum + (data[key] ?? 0), 0);
    if (totalIncome <= 0) {
      setError('가구 소득을 입력해주세요.');
      return;
    }
    if (goalTotal !== availableBudget) {
      setError(`목표 합계를 여유예산 ${formatWon(availableBudget)}에 맞춰주세요. 현재 ${formatWon(goalTotal)}이에요.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await finalizeOnboarding(data);
      await onComplete();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
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

  const inputStyle = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }];
  const primaryButtonStyle = ({ pressed }: { pressed: boolean }) => [
    styles.primaryButton,
    { backgroundColor: pressed ? theme.primaryPressed : theme.primary },
  ];

  function openJoinFlow() {
    setError(null);
    setInviteCodeInput('');
    setStep({ name: 'join-code' });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={[
          styles.card,
          { backgroundColor: theme.backgroundElement },
        ]}>
          {step.name === 'prologue' && (
            <View style={styles.prologueBody}>
              <ThemedText type="title" style={styles.prologueTitle}>버짓 앱에 오신 걸{`\n`}환영해요</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.prologueCopy}>
                버짓앱은 가족 단위로 예산을 관리하는 가계부 서비스예요.{`\n\n`}
                버짓앱을 사용하기 위해서는 다음과 같은 초기 정보가 있을 때 빈틈없는 가계운영이 가능해요!{`\n\n`}
                · 주거비: 대출금 / 주거 관리비 / 통신비 / 재산세{`\n`}
                · 보험비: 월 평균 보험비{`\n\n`}
                지금 입력하지 않아도 추후 입력으로 세팅 가능해요.
              </ThemedText>
              <View style={styles.prologueActions}>
                <Pressable style={({ pressed }) => [...primaryButtonStyle({ pressed }), styles.inlineButton]} onPress={() => setStep({ name: 'household-count' })}>
                  <ThemedText type="smallBold" style={styles.primaryButtonText}>시작할게요</ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={openJoinFlow}
                  style={({ pressed }) => [styles.secondaryButton, { borderColor: theme.border }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>초대코드로 참여하기</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          {step.name === 'household-count' && (
            <View style={styles.stepBody}>
              <View style={styles.copyBlock}>
                <ThemedText type="subtitle" style={styles.stepTitle}>몇 분이 함께 사나요?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">가구원은 소비 태깅용으로 최대 5명까지 등록 가능해요. 소득/예산 관리는 처음 등록한 2명으로 제한돼요.</ThemedText>
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
                        { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.backgroundElement },
                        pressed && styles.pressed,
                      ]}
                      onPress={() => selectCount(count)}>
                      <ThemedText type="small" style={selected && styles.primaryButtonText}>{count}</ThemedText>
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
              <ThemedText type="subtitle" style={styles.stepTitle}>가구원 이름(또는 별명)을{`\n`}입력해주세요</ThemedText>
              <View style={styles.fields}>
                {names.map((name, index) => (
                  <View key={index} style={styles.fieldGroup}>
                    {index > 0 && <ThemedText type="small" themeColor="textSecondary">가구원 {index + 1} 이름</ThemedText>}
                    <TextInput
                      style={inputStyle}
                      placeholder={`가구원 ${index + 1} 이름 (${index === 0 ? '예: 지원' : index === 1 ? '예: 윤혜' : '예: 아이'})`}
                      placeholderTextColor="#8B929B"
                      value={name}
                      onChangeText={(text) => setNames((prev) => prev.map((item, itemIndex) => itemIndex === index ? text : item))}
                      returnKeyType={index === names.length - 1 ? 'done' : 'next'}
                    />
                  </View>
                ))}
              </View>
              <ErrorMessage message={error} />
              <Pressable style={primaryButtonStyle} onPress={submitHousehold} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>가족 구성 등록</ThemedText>}
              </Pressable>
            </View>
          )}

          {step.name === 'household-success' && (
            <SuccessPanel
              title="우리 가족 공간이 생겼어요!"
              description="아래 코드를 가족에게 공유하면 같은 가계부에 연결할 수 있어요."
              theme={theme}
              inviteCode={step.inviteCode}
              onDone={() => saveAndGo('income')}
            />
          )}

          {step.name === 'income' && (
            <View style={styles.stepBody}>
              <StepCopy
                title={'가구원별 월 평균 소득을\n입력해주세요'}
                description="이 값으로 생활비/저축/노후자금/비상금/용돈 비율을 제안해드려요. 소득관리 대상은 처음 등록한 2명까지예요."
              />
              <MoneyField label="가구원 1님 월 평균 소득" placeholder="예: 4,500,000원" value={draft.income_1} onChangeText={(value) => setMoney('income_1', value)} inputStyle={inputStyle} />
              {memberCount > 1 && <MoneyField label="가구원 2님 월 평균 소득" placeholder="예: 3,800,000원" value={draft.income_2} onChangeText={(value) => setMoney('income_2', value)} inputStyle={inputStyle} />}
              <View style={[styles.totalCard, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.totalLabel}>우리 가족 월 평균 소득</ThemedText>
                <ThemedText style={styles.totalAmount}>{formatWon(totalIncome)}</ThemedText>
              </View>
              <ErrorMessage message={error} />
              <NextButton label="다음" busy={busy} theme={theme} onPress={() => totalIncome > 0 ? saveAndGo('housing') : setError('월 평균 소득을 입력해주세요.')} />
            </View>
          )}

          {step.name === 'housing' && (
            <View style={styles.stepBody}>
              <StepCopy title="주거비를 세팅해볼까요?" />
              <MoneyField label="대출금 (월 상환액)" placeholder="예: 900,000원" value={draft.loan_payment} onChangeText={(value) => setMoney('loan_payment', value)} inputStyle={inputStyle} />
              <MoneyField label="주거 관리비" placeholder="예: 250,000원" value={draft.housing_fee} onChangeText={(value) => setMoney('housing_fee', value)} inputStyle={inputStyle} />
              <MoneyField label="통신비" placeholder="예: 130,000원" value={draft.telecom_fee} onChangeText={(value) => setMoney('telecom_fee', value)} inputStyle={inputStyle} />
              <MoneyField label="재산세 (연 납부액 / 12)" placeholder="예: 40,000원" value={draft.property_tax_monthly} onChangeText={(value) => setMoney('property_tax_monthly', value)} inputStyle={inputStyle} />
              <ThemedText style={styles.helperText}>재산세는 7월·9월에 나눠 납부해요. 위택스에서 1년 납부 내역을 확인할 수 있어요.</ThemedText>
              <ErrorMessage message={error} />
              <NextButton label="다음" busy={busy} theme={theme} onPress={() => saveAndGo('insurance')} />
            </View>
          )}

          {step.name === 'insurance' && (
            <View style={styles.stepBody}>
              <StepCopy title="이제 보험비예요" description="보험비는 나중에 세부항목을 입력해도 돼요. 편하게 월 평균 비용만 입력해주세요!" />
              <MoneyField label="월 평균 보험비 (가구 전체)" placeholder="예: 350,000원" value={draft.insurance_total} onChangeText={(value) => setMoney('insurance_total', value)} inputStyle={inputStyle} />
              <ErrorMessage message={error} />
              <NextButton label="고정비 세팅 완료" busy={busy} theme={theme} onPress={() => saveAndGo('vision')} />
            </View>
          )}

          {step.name === 'vision' && (
            <View style={styles.stepBody}>
              <StepCopy title="고정비용이 다 세팅됐어요!" description="이제부터는 생활비, 저축, 노후자금, 비상금, 용돈을 설계할거예요! 이 세팅으로 미래의 내가 행복해집니다." />
              <View style={styles.allocationBar}>
                {[['생활', 4], ['저축', 4], ['노후', 2], ['비상', 1], ['용돈', 1]].map(([label, flex]) => (
                  <View key={String(label)} style={[styles.allocationPiece, { flex: Number(flex), backgroundColor: Number(flex) >= 4 ? theme.primary : theme.primarySoft }]}>
                    <ThemedText style={[styles.allocationText, { color: Number(flex) >= 4 ? '#FFFFFF' : theme.primary }]}>{label}</ThemedText>
                  </View>
                ))}
              </View>
              <ThemedText style={styles.helperText}>여유예산(=총소득−고정비) {formatWon(availableBudget)} 안에서 4:4:2:1:1 비율로 자동 배분돼요.</ThemedText>
              <ErrorMessage message={error} />
              <NextButton label="시작해볼까요" busy={busy} theme={theme} onPress={beginGoals} />
            </View>
          )}

          {(['living', 'savings', 'pension', 'emergency', 'allowance'] as const).includes(step.name as 'living') && (() => {
            const config = {
              living: { title: '생활비 세팅', description: '월 평균 생활비를 얼마로 세팅하실 계획인가요? 여유예산의 1/3을 제안드려요.', placeholder: '예: 800,000원', next: 'savings' as const },
              savings: { title: '저축 세팅', description: '저축을 얼마 목표로 하고 계신가요? 여유예산의 1/3을 제안드려요.', placeholder: '예: 800,000원', next: 'pension' as const },
              pension: { title: '노후자금 세팅', description: '노후자금은 얼마를 목표로 하고 계신가요? 여유예산의 1/6을 제안드려요.', placeholder: '예: 400,000원', next: 'emergency' as const },
              emergency: { title: '비상금 세팅', description: '병원비·차량관리·여행비·가족경조사·지인경조사를 비상금에서 관리해요. 여유예산의 1/12을 제안드려요.', placeholder: '예: 200,000원', next: 'allowance' as const },
              allowance: { title: '용돈 세팅', description: '작고 소중한 내 용돈. 여유예산의 1/12로 잡았어요. 소득관리 대상 2명에게 소득 비례로 기본 배분돼요.', placeholder: '예: 200,000원', next: null },
            }[step.name as 'living' | 'savings' | 'pension' | 'emergency' | 'allowance'];
            const key = step.name as 'living' | 'savings' | 'pension' | 'emergency' | 'allowance';
            return (
              <View style={styles.stepBody}>
                <StepCopy title={config.title} description={config.description} />
                <MoneyField placeholder={config.placeholder} value={draft[key]} onChangeText={(value) => setMoney(key, value)} inputStyle={inputStyle} />
                <View style={[styles.budgetHint, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText style={[styles.budgetHintText, { color: theme.primary }]}>여유예산 {formatWon(availableBudget)}</ThemedText>
                </View>
                <ErrorMessage message={error} />
                <NextButton
                  label={config.next ? '다음' : '온보딩 완료'}
                  busy={busy}
                  theme={theme}
                  onPress={() => config.next
                    ? rebalanceAndGo(key as 'living' | 'savings' | 'pension' | 'emergency', config.next)
                    : finishSetup()}
                />
              </View>
            );
          })()}

          {step.name === 'join-code' && (
            <View style={styles.stepBody}>
              <ThemedText style={styles.linkIcon}>🔗</ThemedText>
              <View style={styles.copyBlock}>
                <ThemedText type="subtitle" style={styles.joinTitle}>초대코드를 입력해주세요</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">가구를 만든 가구원에게 받은 초대코드를 입력하면 가족 예산에 함께 참여할 수 있어요.</ThemedText>
              </View>
              <TextInput
                autoFocus
                style={[inputStyle, styles.codeInput]}
                placeholder="초대코드 입력"
                placeholderTextColor="#8B929B"
                autoCapitalize="characters"
                autoCorrect={false}
                value={inviteCodeInput}
                onChangeText={setInviteCodeInput}
                onSubmitEditing={submitInviteCode}
              />
              <ErrorMessage message={error} />
              <Pressable style={({ pressed }) => [...primaryButtonStyle({ pressed }), styles.inlineButton]} onPress={submitInviteCode} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>확인</ThemedText>}
              </Pressable>
              <Pressable style={styles.backLink} onPress={() => setStep({ name: 'prologue' })}>
                <ThemedText type="small" themeColor="textSecondary">처음으로 돌아가기</ThemedText>
              </Pressable>
            </View>
          )}

          {step.name === 'join-pick' && (
            <View style={styles.stepBody}>
              <View style={styles.copyBlock}>
                <ThemedText type="subtitle" style={styles.joinTitle}>{step.householdName ?? '우리 가족'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">당신은 누구인가요?</ThemedText>
              </View>
              <View style={styles.memberList}>
                {step.members.map((member) => (
                  <Pressable
                    key={member.member_id}
                    disabled={member.is_claimed || busy}
                    onPress={() => pickMember(member.member_id, member.member_name)}
                    style={({ pressed }) => [
                      styles.memberButton,
                      { backgroundColor: member.is_claimed ? theme.background : theme.backgroundElement, borderColor: member.is_claimed ? theme.background : theme.primary },
                      (pressed || member.is_claimed) && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold" style={styles.memberName}>{member.member_name}</ThemedText>
                    <ThemedText type="small" style={{ color: member.is_claimed ? theme.textSecondary : theme.primary }}>
                      {member.is_claimed ? '이미 가입됨' : '선택하기 →'}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ErrorMessage message={error} />
            </View>
          )}

          {step.name === 'join-success' && (
            <SuccessPanel
              title={`${step.memberName}님, 가입 완료됐어요!`}
              description="이제 가족과 같은 가계부를 함께 관리해요."
              theme={theme}
              onDone={onComplete}
            />
          )}
        </View>
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

function StepCopy({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.copyBlock}>
      <ThemedText style={styles.formTitle}>{title}</ThemedText>
      {description && <ThemedText style={styles.formDescription}>{description}</ThemedText>}
    </View>
  );
}

function MoneyField({ label, placeholder, value, onChangeText, inputStyle }: {
  label?: string;
  placeholder: string;
  value?: string;
  onChangeText: (value: string) => void;
  inputStyle: object[];
}) {
  return (
    <View style={styles.fieldGroup}>
      {label && <ThemedText style={styles.fieldLabel}>{label}</ThemedText>}
      <TextInput
        keyboardType="number-pad"
        inputMode="numeric"
        style={inputStyle}
        placeholder={placeholder}
        placeholderTextColor="#8B929B"
        value={value ?? ''}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function NextButton({ label, busy, theme, onPress }: {
  label: string;
  busy: boolean;
  theme: ReturnType<typeof useTheme>;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Pressable
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, { backgroundColor: pressed ? theme.primaryPressed : theme.primary }]}>
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <ThemedText type="smallBold" style={styles.primaryButtonText}>{label}</ThemedText>}
    </Pressable>
  );
}

function SuccessPanel({ title, description, theme, inviteCode, onDone }: {
  title: string;
  description: string;
  theme: ReturnType<typeof useTheme>;
  inviteCode?: string;
  onDone: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);

  async function copyInviteCode() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    setCopied(true);
  }

  async function finishOnboarding() {
    setCompletionError(null);
    setCompleting(true);
    try {
      await onDone();
    } catch (e) {
      setCompletionError(getErrorMessage(e));
    } finally {
      setCompleting(false);
    }
  }

  return (
    <View style={[styles.stepBody, styles.successPanel]}>
      <View style={[styles.successIcon, { backgroundColor: '#E8F6EF' }]}>
        <ThemedText style={styles.check}>✅</ThemedText>
      </View>
      <View style={[styles.copyBlock, styles.centerCopy]}>
        <ThemedText style={[styles.successTitle, styles.centerText]}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>{description}</ThemedText>
      </View>
      {inviteCode && (
        <View style={[styles.inviteCodeBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText type="small" themeColor="textSecondary">우리 가족 초대코드</ThemedText>
          <View style={styles.inviteCodeRow}>
            <ThemedText style={[styles.inviteCode, { color: theme.primary }]} selectable>{inviteCode}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="초대코드 복사"
              hitSlop={10}
              onPress={copyInviteCode}
              style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
              <View style={[styles.copyIconBack, { borderColor: theme.primary }]} />
              <View style={[styles.copyIconFront, { borderColor: theme.primary, backgroundColor: theme.background }]} />
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {copied ? '초대코드를 복사했어요!' : '길게 누르거나 아이콘을 눌러 복사해요'}
          </ThemedText>
        </View>
      )}
      <ErrorMessage message={completionError} />
      <Pressable disabled={completing} style={({ pressed }) => [styles.primaryButton, styles.inlineButton, { backgroundColor: pressed ? theme.primaryPressed : theme.primary }]} onPress={finishOnboarding}>
        {completing
          ? <ActivityIndicator color="#FFFFFF" />
          : <ThemedText type="smallBold" style={styles.primaryButtonText}>
              {inviteCode ? '우리 가계 빈틈없이 굴리기' : '가계부 시작하기'}
            </ThemedText>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 70, paddingBottom: 30 },
  card: { flex: 1, width: '100%', borderRadius: 16, paddingHorizontal: 22, paddingTop: 32, paddingBottom: 28, shadowColor: '#1A264D', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 2, overflow: 'hidden' },
  prologueBody: { flex: 1, gap: 20 },
  prologueActions: { gap: 10 },
  prologueTitle: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.6 },
  prologueCopy: { lineHeight: 17, fontWeight: '400' },
  stepBody: { flex: 1, gap: 20 },
  copyBlock: { gap: 16 },
  stepTitle: { fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: 0 },
  formTitle: { fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.3 },
  formDescription: { color: '#5C636B', fontSize: 14, lineHeight: 18, fontWeight: '400' },
  fieldLabel: { color: '#5C636B', fontSize: 13, lineHeight: 18, fontWeight: '500' },
  helperText: { color: '#5C636B', fontSize: 12, lineHeight: 17 },
  joinTitle: { fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: 0 },
  linkIcon: { fontSize: 32, lineHeight: 38 },
  primaryButton: { minHeight: 48, borderRadius: 10, paddingHorizontal: 20, marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  primaryButtonText: { color: '#FFFFFF' },
  inlineButton: { marginTop: 0 },
  secondaryButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  backLink: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  countGrid: { flexDirection: 'row', gap: 10 },
  countChip: { height: 32, minWidth: 32, borderWidth: 1, borderRadius: 9999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  fields: { gap: 16 },
  fieldGroup: { gap: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14, fontSize: 14, fontFamily: Fonts.sans, fontWeight: '500' },
  totalCard: { width: '100%', borderRadius: 10, padding: 16, gap: 4, shadowColor: '#2563EB', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 18 },
  totalLabel: { color: '#D9E5FF', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  totalAmount: { color: '#FFFFFF', fontSize: 24, lineHeight: 30, fontWeight: '700' },
  allocationBar: { width: '100%', height: 40, flexDirection: 'row', gap: 8 },
  allocationPiece: { minWidth: 25, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  allocationText: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
  budgetHint: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  budgetHintText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  codeInput: { fontSize: 14, fontWeight: '500', textAlign: 'left', letterSpacing: 0 },
  errorBox: { borderRadius: 14, paddingHorizontal: Spacing.three, paddingVertical: 12 },
  memberList: { gap: 18 },
  memberButton: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center' },
  memberName: { flex: 1 },
  successPanel: { alignItems: 'center', gap: 18 },
  successIcon: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  check: { fontSize: 32, lineHeight: 38 },
  successTitle: { fontSize: 20, lineHeight: 24, fontWeight: '800' },
  centerCopy: { alignItems: 'center' },
  centerText: { textAlign: 'center' },
  inviteCodeBox: { width: '100%', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center', gap: 12 },
  inviteCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  inviteCode: { fontFamily: Fonts.mono, fontSize: 24, lineHeight: 32, fontWeight: '800', letterSpacing: 1 },
  copyButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  copyIconBack: { position: 'absolute', width: 16, height: 18, borderWidth: 2, borderRadius: 2, left: 6, top: 5 },
  copyIconFront: { position: 'absolute', width: 16, height: 18, borderWidth: 2, borderRadius: 2, left: 10, top: 9 },
  pressed: { opacity: 0.65 },
});
