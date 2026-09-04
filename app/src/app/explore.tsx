import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const previewItems = [
  { icon: '↗', title: '이번 달 지출 흐름', description: '예산 대비 사용 속도를 한눈에 확인해요' },
  { icon: '◒', title: '카테고리 분석', description: '우리 가족이 어디에 많이 쓰는지 알아봐요' },
  { icon: '✓', title: '저축 루틴', description: '저축과 노후자금 이체 습관을 기록해요' },
];

export default function ReportScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <ThemedText type="eyebrow" style={{ color: theme.primary }}>REPORT</ThemedText>
            <ThemedText type="title">우리 집 돈의 흐름</ThemedText>
            <ThemedText themeColor="textSecondary">가족 설정을 마치면 매달 달라지는 소비와 저축 흐름을 보여드릴게요.</ThemedText>
          </View>

          <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
            <View style={[styles.heroOrb, { backgroundColor: theme.accent }]} />
            <ThemedText type="smallBold" style={styles.onPrimaryMuted}>MONTHLY INSIGHT</ThemedText>
            <ThemedText style={styles.heroNumber}>한눈에, 명확하게</ThemedText>
            <ThemedText style={styles.onPrimaryMuted}>숫자가 쌓이면 우리 가족만의 리포트가 완성돼요.</ThemedText>
          </View>

          <View style={styles.list}>
            {previewItems.map((item) => (
              <View key={item.title} style={[styles.item, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <View style={[styles.itemIcon, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>{item.icon}</ThemedText>
                </View>
                <View style={styles.itemCopy}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">{item.description}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  scrollContent: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, paddingBottom: BottomTabInset + Spacing.six, gap: Spacing.four },
  header: { gap: Spacing.two },
  heroCard: { minHeight: 210, borderRadius: 30, padding: Spacing.four, justifyContent: 'flex-end', overflow: 'hidden', gap: Spacing.two },
  heroOrb: { position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -24, top: -50, opacity: 0.9 },
  heroNumber: { color: '#FFFFFF', fontSize: 27, lineHeight: 34, fontWeight: '700' },
  onPrimaryMuted: { color: 'rgba(255,255,255,0.76)' },
  list: { gap: Spacing.two },
  item: { minHeight: 82, borderRadius: 20, borderWidth: 1, padding: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  itemIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1, gap: 3 },
});
