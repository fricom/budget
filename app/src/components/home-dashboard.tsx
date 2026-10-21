import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth-context';

const progressItems = [
  { label: '생활비', detail: '450,000 / 800,000', progress: 0.56 },
  { label: '저축', detail: '800,000 / 800,000  이체완료', progress: 1 },
  { label: '노후자금', detail: '0 / 400,000  이체 필요', progress: 0 },
];

const allowances = [
  { label: '지원', detail: '120,000 / 200,000', progress: 0.6 },
  { label: '윤혜', detail: '80,000 / 190,000', progress: 0.42 },
];

const expenses = [
  { date: '7/24', title: '진우 유산균', amount: '12,000원', member: '아이', tag: '자녀', tagColor: '#FFA133', tagBg: '#FFF1DE', icon: require('../../assets/images/category-child.svg') },
  { date: '7/23', title: '쿠팡 장', amount: '68,500원', member: '윤혜', tag: '생활', tagColor: '#33BFA9', tagBg: '#E3FAF7', icon: require('../../assets/images/category-living.svg') },
  { date: '7/22', title: '톨비', amount: '4,500원', member: '지원', tag: '교통', tagColor: '#8C7DF5', tagBg: '#F0EBFF', icon: require('../../assets/images/category-transport.svg') },
];

export function HomeDashboard() {
  const { session, signOut } = useAuth();
  const [selectedMember, setSelectedMember] = useState('전체');
  const filteredExpenses = selectedMember === '전체'
    ? expenses
    : expenses.filter((expense) => expense.member === selectedMember);
  const filteredAllowances = selectedMember === '전체'
    ? allowances
    : allowances.filter((allowance) => allowance.label === selectedMember);

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.accountRow}>
        <ThemedText style={styles.accountEmail} numberOfLines={1}>
          {session?.user.email}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => signOut().catch((error) => console.error('sign out failed', error))}
          style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
          <ThemedText style={styles.signOutLabel}>로그아웃</ThemedText>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <ThemedText style={styles.heroMeta}>7월 · 7/24  ·  D-7</ThemedText>
        <ThemedText style={styles.heroLabel}>이번 달 여유예산 잔액</ThemedText>
        <ThemedText style={styles.heroAmount}>1,240,000원</ThemedText>
        <View style={styles.heroSummary}>
          <ThemedText style={styles.heroSummaryText}>한 달 수입 8,300,000</ThemedText>
          <ThemedText style={styles.heroSummaryText}>고정비 1,670,000</ThemedText>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>카테고리별 진행 현황</ThemedText>
        {progressItems.map((item) => <ProgressRow key={item.label} {...item} />)}
        <View style={styles.emergencyCard}>
          <ThemedText style={styles.emergencyLabel}>비상금 잔액</ThemedText>
          <ThemedText style={styles.emergencyAmount}>1,234,000원</ThemedText>
          <ThemedText style={styles.emergencyCopy}>이번 달 목표 150,000 중 100,000 적립</ThemedText>
          <ThemedText style={styles.emergencyDanger}>이번 달 사용 50,000 (차량 수리)</ThemedText>
        </View>
        <ThemedText style={styles.allowanceLabel}>용돈</ThemedText>
        {filteredAllowances.map((item) => <ProgressRow key={item.label} {...item} />)}
      </View>

      <Pressable style={({ pressed }) => [styles.expenseButton, pressed && styles.pressed]}>
        <Image source={require('../../assets/images/expense-add.svg')} style={styles.expenseButtonIcon} />
        <ThemedText style={styles.buttonLabel}>지출 입력</ThemedText>
      </Pressable>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>최근 지출 내역</ThemedText>
        {filteredExpenses.map((expense) => (
          <View key={`${expense.date}-${expense.title}`} style={styles.expenseRow}>
            <ThemedText style={styles.expenseDate}>{expense.date}</ThemedText>
            <ThemedText style={styles.expenseTitle}>{expense.title}</ThemedText>
            <ThemedText style={styles.expenseAmount}>{expense.amount}</ThemedText>
            <View style={[styles.tag, { backgroundColor: expense.tagBg }]}>
              <Image source={expense.icon} style={styles.tagIcon} />
              <ThemedText style={[styles.tagText, { color: expense.tagColor }]}>{expense.tag}</ThemedText>
            </View>
          </View>
        ))}
        {filteredExpenses.length === 0 && (
          <ThemedText style={styles.emptyText}>선택한 가구원의 최근 지출이 없어요.</ThemedText>
        )}
        <ThemedText style={styles.link}>전체 내역 보기 →</ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>가구원 필터</ThemedText>
        <View style={styles.chips}>
          {['전체', '지원', '윤혜', '아이'].map((label) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedMember === label }}
              key={label}
              onPress={() => setSelectedMember(label)}
              style={({ pressed }) => [
                styles.chip,
                selectedMember === label && styles.chipSelected,
                pressed && styles.pressed,
              ]}>
              <ThemedText style={[styles.chipText, selectedMember === label && styles.chipTextSelected]}>{label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

function ProgressRow({ label, detail, progress }: { label: string; detail: string; progress: number }) {
  return (
    <View style={styles.progressBlock}>
      <View style={styles.progressHeader}>
        <ThemedText style={styles.progressLabel}>{label}</ThemedText>
        <ThemedText style={styles.progressDetail}>{detail}</ThemedText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 24, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 110 },
  accountRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  accountEmail: { maxWidth: 210, color: '#5C636B', fontSize: 10, lineHeight: 14 },
  signOutButton: { borderRadius: 999, borderWidth: 1, borderColor: '#D6DADF', paddingHorizontal: 10, paddingVertical: 5 },
  signOutLabel: { color: '#5C636B', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  hero: { backgroundColor: '#315EF8', borderRadius: 16, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, gap: 10, shadowColor: '#101828', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  heroMeta: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, fontWeight: '500' },
  heroLabel: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, fontWeight: '500' },
  heroAmount: { color: '#FFFFFF', fontSize: 40, lineHeight: 48, fontWeight: '600', letterSpacing: -2 },
  heroSummary: { flexDirection: 'row', gap: 16 },
  heroSummaryText: { color: '#FFFFFF', fontSize: 12, lineHeight: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, gap: 16, shadowColor: '#101828', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2 },
  sectionTitle: { color: '#16191D', fontSize: 16, lineHeight: 24, fontWeight: '600' },
  progressBlock: { gap: 6 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressLabel: { color: '#16191D', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  progressDetail: { color: '#5C636B', fontSize: 12, lineHeight: 20, fontWeight: '500' },
  progressTrack: { height: 12, borderRadius: 999, backgroundColor: '#ECEEF1', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#7694FA' },
  emergencyCard: { backgroundColor: '#315EF8', borderRadius: 16, padding: 20, gap: 6 },
  emergencyLabel: { color: '#FFFFFF', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  emergencyAmount: { color: '#FFFFFF', fontSize: 24, lineHeight: 32, fontWeight: '700', letterSpacing: -1 },
  emergencyCopy: { color: '#FFFFFF', fontSize: 12, lineHeight: 20 },
  emergencyDanger: { color: '#FFFFFF', fontSize: 12, lineHeight: 20, fontWeight: '600' },
  allowanceLabel: { color: '#16191D', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  expenseButton: { minHeight: 50, borderRadius: 10, backgroundColor: '#315EF8', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  expenseButtonIcon: { width: 20, height: 20 },
  buttonLabel: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  pressed: { opacity: 0.75 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expenseDate: { width: 30, color: '#5C636B', fontSize: 10, lineHeight: 14 },
  expenseTitle: { flex: 1, color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  expenseAmount: { color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  tagIcon: { width: 16, height: 16 },
  tagText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  link: { color: '#315EF8', fontSize: 13, lineHeight: 20, fontWeight: '500' },
  emptyText: { color: '#5C636B', fontSize: 11, lineHeight: 18, textAlign: 'center', paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, borderRadius: 999, borderWidth: 1, borderColor: '#D6DADF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: '#315EF8', backgroundColor: '#315EF8' },
  chipText: { color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF' },
});
