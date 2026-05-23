import React, { useState } from 'react';
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
import { RootStackParamList, Stop } from '../types';

type Route = RouteProp<RootStackParamList, 'MultiStop'>;

export function MultiStopScreen() {
  const navigation = useNavigation();
  const { params } = useRoute<Route>();
  const { checklists, addTripLog } = useAppStore();

  const checklist = checklists.find((c) => c.id === params.checklistId);

  const [stopIndex, setStopIndex] = useState(() => {
    const idx = checklist?.stops.findIndex((s) => s.status === 'current') ?? 0;
    return idx >= 0 ? idx : 0;
  });
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const currentStop = checklist?.stops.find((s) => s.status === 'current');
    const init: Record<string, boolean> = {};
    currentStop?.checkedItems.forEach((id) => { init[id] = true; });
    return init;
  });

  if (!checklist) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={{ padding: 20 }}>Checklist not found.</Text>
      </SafeAreaView>
    );
  }

  const stops = checklist.stops;
  const currentStop = stops[stopIndex];
  const totalItems = stops.reduce((a, st) => a + st.items.length, 0);
  const doneStops = stopIndex;
  const pct = stops.length > 0 ? Math.round((doneStops / stops.length) * 100) : 0;

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function advance() {
    const checkedCount = currentStop.items.filter((it) => checked[it.id]).length;
    if (stopIndex < stops.length - 1) {
      // Move to next stop — reset checked state for that stop
      const nextStop = stops[stopIndex + 1];
      const nextChecked: Record<string, boolean> = {};
      nextStop.checkedItems?.forEach((id) => { nextChecked[id] = true; });
      setChecked(nextChecked);
      setStopIndex(stopIndex + 1);
    } else {
      // All stops done
      addTripLog({
        checklistId: checklist.id,
        checklistName: checklist.name,
        checkedCount,
        totalCount: totalItems,
        timestamp: new Date().toISOString(),
        isComplete: true,
      });
      Alert.alert('Trip complete!', 'All stops checked off.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    }
  }

  function badgeStyle(stop: Stop, idx: number) {
    if (idx < stopIndex) return s.badgeDone;
    if (idx === stopIndex) return s.badgeCurrent;
    return s.badgeTodo;
  }
  function badgeText(idx: number) {
    if (idx < stopIndex) return 'Done';
    if (idx === stopIndex) return 'Now';
    return 'Upcoming';
  }
  function badgeTextStyle(idx: number) {
    if (idx < stopIndex) return s.badgeDoneText;
    if (idx === stopIndex) return s.badgeCurrentText;
    return s.badgeTodoText;
  }

  const isLastStop = stopIndex === stops.length - 1;

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

        {/* Progress */}
        <View style={s.card}>
          <View style={s.progressRow}>
            <Text style={s.progressText}>Stop {stopIndex + 1} of {stops.length} · In progress</Text>
            <Text style={[s.progressText, { color: theme.colors.purple, fontWeight: '500' }]}>
              Active
            </Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* Stop timeline */}
        <View style={s.card}>
          {stops.map((stop, idx) => (
            <View key={stop.id} style={s.stopRow}>
              <View style={s.stopDotCol}>
                <View
                  style={[
                    s.stopDot,
                    idx < stopIndex && s.stopDotDone,
                    idx === stopIndex && s.stopDotCurrent,
                    idx > stopIndex && s.stopDotUpcoming,
                  ]}
                />
                {idx < stops.length - 1 && <View style={s.stopLine} />}
              </View>
              <View style={s.stopInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.stopName}>{stop.name}</Text>
                  <View style={[s.badge, badgeStyle(stop, idx)]}>
                    <Text style={[s.badgeText, badgeTextStyle(idx)]}>{badgeText(idx)}</Text>
                  </View>
                </View>
                <Text style={s.stopSub}>
                  {idx < stopIndex
                    ? `${stop.items.length} items checked`
                    : stop.subtitle}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Current stop checklist */}
        {currentStop && (
          <View style={[s.card, s.currentCard]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Ionicons name="location" size={14} color={theme.colors.purple} />
              <Text style={s.currentLabel}>Current stop: {currentStop.name}</Text>
            </View>
            {currentStop.items.map((item, idx) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.checkRow,
                  idx < currentStop.items.length - 1 && s.checkRowBorder,
                ]}
                onPress={() => toggle(item.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.checkbox,
                    checked[item.id] && s.checkboxChecked,
                  ]}
                >
                  {checked[item.id] && (
                    <Ionicons name="checkmark" size={13} color="#fff" />
                  )}
                </View>
                <Text style={[s.checkLabel, checked[item.id] && s.checkLabelDone]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Advance button */}
        <TouchableOpacity style={s.btnPrimary} onPress={advance}>
          <Ionicons
            name={isLastStop ? 'checkmark-circle' : 'arrow-forward'}
            size={16}
            color="#fff"
          />
          <Text style={s.btnPrimaryText}>
            {isLastStop ? ' Complete trip' : ' Continue to next stop'}
          </Text>
        </TouchableOpacity>
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
    paddingVertical: 12,
  },
  currentCard: { borderWidth: 1.5, borderColor: theme.colors.purpleBorder },

  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: theme.colors.textSecondary },
  barTrack: {
    height: 6,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: theme.colors.purple, borderRadius: 3 },

  stopRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  stopDotCol: { alignItems: 'center', width: 16 },
  stopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 2,
  },
  stopDotDone: { backgroundColor: theme.colors.primary },
  stopDotCurrent: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  stopDotUpcoming: { backgroundColor: theme.colors.borderSecondary },
  stopLine: { width: 2, flex: 1, backgroundColor: theme.colors.borderTertiary, marginTop: 2 },
  stopInfo: { flex: 1, paddingBottom: 12 },
  stopName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  stopSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radius.md },
  badgeDone: { backgroundColor: theme.colors.primaryLight },
  badgeCurrent: { backgroundColor: theme.colors.purpleLight },
  badgeTodo: { backgroundColor: theme.colors.bgSecondary },
  badgeText: { fontSize: 11, fontWeight: '500' },
  badgeDoneText: { color: theme.colors.primaryDeep },
  badgeCurrentText: { color: theme.colors.purpleDark },
  badgeTodoText: { color: theme.colors.textSecondary },

  currentLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.purple },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
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
    backgroundColor: theme.colors.purple,
    borderColor: theme.colors.purple,
  },
  checkLabel: { flex: 1, fontSize: 15, color: theme.colors.textPrimary },
  checkLabelDone: { color: theme.colors.textTertiary, textDecorationLine: 'line-through' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.purple,
  },
  btnPrimaryText: { fontSize: 15, fontWeight: '500', color: '#fff' },
});
