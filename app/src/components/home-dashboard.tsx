import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

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
  { date: '7/24', title: '진우 유산균', amount: '12,000원', tag: '🧸 자녀', tagColor: '#FFA133', tagBg: '#FFF1DE' },
  { date: '7/23', title: '쿠팡 장', amount: '68,500원', tag: '🧺 생활', tagColor: '#33BFA9', tagBg: '#E3FAF7' },
  { date: '7/22', title: '톨비', amount: '4,500원', tag: '🚗 교통', tagColor: '#8C7DF5', tagBg: '#F0EBFF' },
];

export function HomeDashboard() {
  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <ThemedText style={styles.heroMeta}>7월 · 7/24  ·  D-7</ThemedText>
        <ThemedText style={styles.heroLabel}>이번 달 여유예산 잔액</ThemedText>
        <ThemedText style={styles.heroAmount}>1,240,000원</ThemedText>
        <View style={styles.heroSummary}>
          <ThemedText style={styles.heroSummaryText}>총소득 8,300,000</ThemedText>
          <ThemedText style={styles.heroSummaryText}>고정비 1,670,000</ThemedText>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>카테고리별 진행 현황</ThemedText>
        {progressItems.map((item) => <ProgressRow key={item.label} {...item} />)}
        <View style={styles.emergencyCard}>
          <ThemedText style={styles.emergencyAmount}>1,234,000원</ThemedText>
          <ThemedText style={styles.emergencyCopy}>이번 달 목표 150,000 중 100,000 적립</ThemedText>
          <ThemedText style={styles.emergencyDanger}>이번 달 사용 50,000 (차량 수리)</ThemedText>
        </View>
        <ThemedText style={styles.allowanceLabel}>용돈</ThemedText>
        {allowances.map((item) => <ProgressRow key={item.label} {...item} />)}
      </View>

      <Pressable style={({ pressed }) => [styles.expenseButton, pressed && styles.pressed]}>
        <ThemedText style={styles.buttonLabel}>+ 지출 입력</ThemedText>
      </Pressable>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>최근 지출 내역</ThemedText>
        {expenses.map((expense) => (
          <View key={`${expense.date}-${expense.title}`} style={styles.expenseRow}>
            <ThemedText style={styles.expenseDate}>{expense.date}</ThemedText>
            <ThemedText style={styles.expenseTitle}>{expense.title}</ThemedText>
            <ThemedText style={styles.expenseAmount}>{expense.amount}</ThemedText>
            <View style={[styles.tag, { backgroundColor: expense.tagBg }]}>
              <ThemedText style={[styles.tagText, { color: expense.tagColor }]}>{expense.tag}</ThemedText>
            </View>
          </View>
        ))}
        <ThemedText style={styles.link}>전체 내역 보기 →</ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.sectionTitle}>가구원 필터</ThemedText>
        <View style={styles.chips}>
          {['전체', '지원', '윤혜', '아이'].map((label, index) => (
            <View key={label} style={[styles.chip, index === 0 && styles.chipSelected]}>
              <ThemedText style={[styles.chipText, index === 0 && styles.chipTextSelected]}>{label}</ThemedText>
            </View>
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
  page: { gap: 18, paddingHorizontal: 15, paddingTop: 44, paddingBottom: 110 },
  hero: { backgroundColor: '#4285F4', borderRadius: 16, paddingHorizontal: 15, paddingTop: 14, paddingBottom: 18, gap: 6, shadowColor: '#1740D9', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 28, elevation: 8 },
  heroMeta: { color: '#D9E5FF', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  heroLabel: { color: '#D9E5FF', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  heroAmount: { color: '#FFFFFF', fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.4 },
  heroSummary: { flexDirection: 'row', gap: 16 },
  heroSummaryText: { color: '#D9E5FF', fontSize: 9, lineHeight: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 15, gap: 12, shadowColor: '#1A264D', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 2 },
  sectionTitle: { color: '#16191D', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  progressBlock: { gap: 5 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  progressLabel: { color: '#16191D', fontSize: 11, lineHeight: 15, fontWeight: '600' },
  progressDetail: { color: '#5C636B', fontSize: 10, lineHeight: 14, fontWeight: '500' },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: '#ECEEF1', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#4285F4' },
  emergencyCard: { backgroundColor: '#4285F4', borderRadius: 16, padding: 15, gap: 4 },
  emergencyAmount: { color: '#FFFFFF', fontSize: 23, lineHeight: 30, fontWeight: '800' },
  emergencyCopy: { color: '#FFFFFF', fontSize: 10, lineHeight: 14 },
  emergencyDanger: { color: '#D40F22', fontSize: 10, lineHeight: 14, fontWeight: '600' },
  allowanceLabel: { color: '#16191D', fontSize: 11, lineHeight: 15, fontWeight: '500' },
  expenseButton: { minHeight: 48, borderRadius: 10, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  expenseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expenseDate: { width: 30, color: '#5C636B', fontSize: 10, lineHeight: 14 },
  expenseTitle: { flex: 1, color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  expenseAmount: { color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '600' },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { fontSize: 9, lineHeight: 12, fontWeight: '600' },
  link: { color: '#4285F4', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 32, borderRadius: 999, borderWidth: 1, borderColor: '#D6DADF', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipSelected: { borderColor: '#4285F4', backgroundColor: '#4285F4' },
  chipText: { color: '#16191D', fontSize: 11, lineHeight: 16, fontWeight: '500' },
  chipTextSelected: { color: '#FFFFFF' },
});
