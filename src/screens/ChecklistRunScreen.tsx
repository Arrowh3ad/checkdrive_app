import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import { RootStackParamList } from '../types';

type Route = RouteProp<RootStackParamList, 'ChecklistRun'>;

export function ChecklistRunScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { checklists, addTripLog } = useAppStore();

  const checklist = checklists.find((c) => c.id === params.checklistId);
  const [activeTab, setActiveTab] = useState<'start' | 'end'>('start');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  if (!checklist) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ padding: 20, color: theme.colors.textPrimary }}>Checklist not found.</Text>
      </SafeAreaView>
    );
  }

  const items = activeTab === 'start' ? checklist.startItems : checklist.endItems;
  const checkedCount = items.filter((it) => checked[it.id]).length;
  const pct = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function resetAll() {
    setChecked({});
  }

  function switchTab(tab: 'start' | 'end') {
    setActiveTab(tab);
    setChecked({});
  }

  function markDone() {
    addTripLog({
      checklistId: checklist.id,
      checklistName: checklist.name,
      checkedCount,
      totalCount: items.length,
      timestamp: new Date().toISOString(),
      isComplete: checkedCount === items.length,
    });
    Alert.alert('Trip complete!', `${checkedCount}/${items.length} items checked.`, [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title} numberOfLines={1}>{checklist.name}</Text>
        </View>

        {/* Tab switcher */}
        {checklist.endOfTripEnabled && (
          <View style={s.tabs}>
            <TouchableOpacity
              style={[s.tab, activeTab === 'start' && s.tabActive]}
              onPress={() => switchTab('start')}
            >
              <Text style={[s.tabText, activeTab === 'start' && s.tabTextActive]}>
                Start of trip
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, activeTab === 'end' && s.tabActive]}
              onPress={() => switchTab('end')}
            >
              <Text style={[s.tabText, activeTab === 'end' && s.tabTextActive]}>
                End of trip
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress */}
        <View style={s.card}>
          <View style={s.progressRow}>
            <Text style={s.progressText}>{checkedCount} of {items.length} checked</Text>
            <Text style={s.progressPct}>{pct}%</Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* Items */}
        <View style={s.card}>
          {items.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, paddingVertical: 8 }}>
              No items for this tab. Add them in edit mode.
            </Text>
          ) : (
            items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[s.checkRow, idx < items.length - 1 && s.checkRowBorder]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, checked[item.id] && s.checkboxChecked]}>
                  {checked[item.id] && (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  )}
                </View>
                <Text style={[s.checkLabel, checked[item.id] && s.checkLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Actions */}
        <View style={s.btnRow}>
          <TouchableOpacity style={s.btnSecondary} onPress={resetAll}>
            <Ionicons name="refresh" size={15} color={theme.colors.textPrimary} />
            <Text style={s.btnSecondaryText}> Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnPrimary} onPress={markDone}>
            <Ionicons name="checkmark-circle" size={15} color="#fff" />
            <Text style={s.btnPrimaryText}> Done</Text>
          </TouchableOpacity>
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

  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.textPrimary },

  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.colors.textSecondary },
  progressPct: { fontSize: 12, color: theme.colors.textSecondary },
  barTrack: {
    height: 6,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  checkRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkLabel: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  checkLabelDone: { color: theme.colors.textTertiary, textDecorationLine: 'line-through' },

  btnRow: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  btnSecondaryText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 11,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  btnPrimaryText: { fontSize: 14, fontWeight: '500', color: '#fff' },
});
