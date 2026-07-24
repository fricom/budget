import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import {
  addHouseholdMember,
  createHousehold,
  getInvitePreview,
  joinHousehold,
  type InvitePreviewRow,
} from '@/lib/households';

// Supabase 에러(PostgrestError 등)는 Error를 상속하지 않고 {message, code, ...} 평범한 객체라
// instanceof Error 체크가 항상 실패함 -> message 필드를 우선적으로 찾아서 사용.
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

export function OnboardingFlow() {
  const { session, loading: authLoading } = useAuth();
  const [step, setStep] = useState<Step>({ name: 'prologue' });
  const [memberCount, setMemberCount] = useState(2);
  const [names, setNames] = useState<string[]>(['', '']);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading || !session) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText type="small">로그인 준비 중...</ThemedText>
      </ThemedView>
    );
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
    if (names.some((n) => n.trim().length === 0)) {
      setError('모든 가구원 이름을 입력해주세요');
      return;
    }
    setBusy(true);
    try {
      const householdName = `${names[0]}네 가족`;
      const first = await createHousehold(householdName, names[0].trim());
      for (let i = 1; i < names.length; i++) {
        await addHouseholdMember(first.household_id, i + 1, names[i].trim());
      }
      // households.invite_code는 select 정책이 있는 households 테이블에서 읽어와야 하지만
      // create_household가 household_id만 반환하므로 간단히 재조회
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
    if (inviteCodeInput.trim().length === 0) return;
    setBusy(true);
    try {
      const rows = await getInvitePreview(inviteCodeInput.trim());
      if (rows.length === 0) {
        setError('초대코드를 찾을 수 없어요');
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

  return (
    <ThemedView style={styles.container}>
      {step.name === 'prologue' && (
        <View style={styles.stepBody}>
          <ThemedText type="title">버짓 앱에 오신 걸 환영해요</ThemedText>
          <ThemedText>가족 단위로 예산을 관리하는 가계부예요. 먼저 가구를 만들거나, 초대코드로 참여해주세요.</ThemedText>
          <Pressable style={styles.primaryButton} onPress={() => setStep({ name: 'household-count' })}>
            <ThemedText themeColor="background">가구 만들기 시작</ThemedText>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setStep({ name: 'join-code' })}>
            <ThemedText>초대코드로 가입</ThemedText>
          </Pressable>
        </View>
      )}

      {step.name === 'household-count' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">몇 명이 함께 사나요?</ThemedText>
          <View style={styles.row}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                style={[styles.countChip, memberCount === n && styles.countChipSelected]}
                onPress={() => selectCount(n)}>
                <ThemedText>{n}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primaryButton} onPress={() => setStep({ name: 'household-names' })}>
            <ThemedText themeColor="background">다음</ThemedText>
          </Pressable>
        </View>
      )}

      {step.name === 'household-names' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">가구원 이름을 입력해주세요</ThemedText>
          {names.map((name, i) => (
            <TextInput
              key={i}
              style={styles.input}
              placeholder={`가구원 ${i + 1} 이름`}
              value={name}
              onChangeText={(text) =>
                setNames((prev) => prev.map((n, idx) => (idx === i ? text : n)))
              }
            />
          ))}
          {error && <ThemedText themeColor="text">{error}</ThemedText>}
          <Pressable style={styles.primaryButton} onPress={submitHousehold} disabled={busy}>
            {busy ? <ActivityIndicator /> : <ThemedText themeColor="background">가족 구성 등록</ThemedText>}
          </Pressable>
        </View>
      )}

      {step.name === 'household-success' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">가족 구성이 등록됐어요!</ThemedText>
          <ThemedText>다른 가구원에게 아래 초대코드를 공유해주세요.</ThemedText>
          <ThemedText type="code" style={styles.inviteCode}>
            {step.inviteCode}
          </ThemedText>
        </View>
      )}

      {step.name === 'join-code' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">초대코드를 입력해주세요</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="초대코드"
            autoCapitalize="none"
            value={inviteCodeInput}
            onChangeText={setInviteCodeInput}
          />
          {error && <ThemedText>{error}</ThemedText>}
          <Pressable style={styles.primaryButton} onPress={submitInviteCode} disabled={busy}>
            {busy ? <ActivityIndicator /> : <ThemedText themeColor="background">확인</ThemedText>}
          </Pressable>
        </View>
      )}

      {step.name === 'join-pick' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">{step.householdName ?? '가구'}</ThemedText>
          <ThemedText>당신은 누구인가요?</ThemedText>
          {step.members.map((m) => (
            <Pressable
              key={m.member_id}
              style={[styles.secondaryButton, m.is_claimed && styles.disabledButton]}
              disabled={m.is_claimed || busy}
              onPress={() => pickMember(m.member_id, m.member_name)}>
              <ThemedText>
                {m.member_name} {m.is_claimed ? '(이미 가입됨)' : ''}
              </ThemedText>
            </Pressable>
          ))}
          {error && <ThemedText>{error}</ThemedText>}
        </View>
      )}

      {step.name === 'join-success' && (
        <View style={styles.stepBody}>
          <ThemedText type="subtitle">{step.memberName}님, 가입 완료됐어요!</ThemedText>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  stepBody: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  countChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.backgroundElement,
  },
  countChipSelected: {
    backgroundColor: Colors.light.backgroundSelected,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  primaryButton: {
    backgroundColor: '#3c87f7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: Colors.light.backgroundSelected,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
  inviteCode: {
    fontSize: 24,
    textAlign: 'center',
  },
});
