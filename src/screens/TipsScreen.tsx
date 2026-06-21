// ─────────────────────────────────────────────────────────────────────────────
// screens/TipsScreen.tsx  -  Tips & Tricks reference.
//
// A static list of the app's non-obvious features (edit/duplicate in the ⋮
// menu, skipping items, default checklist, etc.). Reached from Settings - it's
// a revisitable reference, NOT an onboarding slide. Users don't read onboarding
// instructions, but they do go looking for help in Settings, so that's where a
// "how do I..." reference belongs.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Tip = { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string };

// Only genuinely non-obvious features - the things hidden in menus or that a
// first-time user wouldn't stumble onto. No "tap a checklist to start it"
// filler; that's self-evident.
const TIPS: Tip[] = [
  {
    icon: 'ellipsis-vertical',
    title: 'Edit or duplicate a list',
    detail: 'Tap the ⋮ menu on any checklist on the home screen to rename, edit, duplicate, or delete it.',
  },
  {
    icon: 'remove-circle-outline',
    title: 'Skip items that don’t apply',
    detail: 'During a trip, tap the ⊖ next to an item. Skipped items don’t count against your score.',
  },
  {
    icon: 'star-outline',
    title: 'Set a default checklist',
    detail: 'Mark a list as default from its ⋮ menu. With Pro it opens automatically when you connect to your car.',
  },
  {
    icon: 'alert-circle-outline',
    title: 'Back-seat reminder',
    detail: 'Turn it on for a checklist to get an urgent “check the back seat” alert when you park.',
  },
  {
    icon: 'navigate-outline',
    title: 'Multi-stop trips',
    detail: 'Switch a checklist to multi-stop for per-stop lists that advance as you drive.',
  },
  {
    icon: 'play-circle-outline',
    title: 'Replay the tutorial',
    detail: 'Reopen the welcome intro anytime from Settings.',
  },
];

export function TipsScreen() {
  const navigation = useNavigation();
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ── Topbar ─────────────────────────────────────────────────────── */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>Tips & Tricks</Text>
        </View>

        <View style={s.card}>
          {TIPS.map((tip, idx) => (
            <View key={tip.title} style={[s.row, idx < TIPS.length - 1 && s.rowBorder]}>
              <View style={s.iconWrap}>
                <Ionicons name={tip.icon} size={18} color={theme.colors.primaryDeep} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.tipTitle}>{tip.title}</Text>
                <Text style={s.tipDetail}>{tip.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 4 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 2 },
  tipDetail: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
});
