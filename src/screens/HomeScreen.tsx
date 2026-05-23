import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { useCarDetection } from '../hooks/useCarDetection';
import { theme } from '../theme';
import { RootStackParamList } from '../types';
import { formatTimeAgo } from '../utils/time';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { checklists, tripLogs, settings, connectedToVehicle } = useAppStore();
  const { simulateConnect, simulateDisconnect } = useCarDetection();

  const recentLogs = tripLogs.slice(0, 3);
  const tripsThisWeek = tripLogs.filter((l) => {
    return Date.now() - new Date(l.timestamp).getTime() < 7 * 86400000;
  }).length;
  const completionRate =
    tripLogs.length > 0
      ? Math.round((tripLogs.filter((l) => l.isComplete).length / tripLogs.length) * 100)
      : 0;

  function onChecklistPress(id: string, isMultiStop: boolean) {
    navigation.navigate(isMultiStop ? 'MultiStop' : 'ChecklistRun', { checklistId: id });
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Topbar */}
        <View style={s.topbar}>
          <MaterialCommunityIcons name="steering" size={22} color={theme.colors.primary} />
          <Text style={s.title}>CheckDrive</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Vehicle Detection Banner */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[s.detectBanner, !connectedToVehicle && s.detectBannerOff]}
          onPress={() => {
            if (!connectedToVehicle) return;
            const cl = checklists.find((c) => c.autoDetect);
            if (cl) onChecklistPress(cl.id, cl.isMultiStop);
          }}
        >
          <Ionicons
            name={connectedToVehicle ? 'wifi' : 'wifi-off'}
            size={28}
            color={connectedToVehicle ? theme.colors.primaryDark : theme.colors.textTertiary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[s.detectTitle, !connectedToVehicle && s.detectTitleOff]}>
              {connectedToVehicle ? 'CarPlay connected' : 'No car connected'}
            </Text>
            <Text style={[s.detectSub, !connectedToVehicle && s.detectSubOff]}>
              {connectedToVehicle
                ? 'Tap to run your checklist'
                : 'Connect CarPlay or Android Auto'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.simBtn}
            onPress={connectedToVehicle ? simulateDisconnect : simulateConnect}
          >
            <Text style={s.simBtnText}>Simulate</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Setup link */}
        <TouchableOpacity onPress={() => navigation.navigate('CarDetectionSetup')}>
          <Text style={s.setupLink}>
            <Ionicons name="information-circle-outline" size={13} /> Set up auto-detection →
          </Text>
        </TouchableOpacity>

        {/* Ad banner */}
        {!settings.isPro && (
          <View style={s.adBanner}>
            <Text style={s.adText}>Advertisement — upgrade to Pro to remove</Text>
          </View>
        )}

        {/* My checklists */}
        <Text style={s.sectionLabel}>My checklists</Text>
        <View style={s.card}>
          {checklists.map((cl, idx) => (
            <TouchableOpacity
              key={cl.id}
              style={[s.clRow, idx < checklists.length - 1 && s.clRowBorder]}
              onPress={() => onChecklistPress(cl.id, cl.isMultiStop)}
            >
              <View style={[s.clIcon, { backgroundColor: cl.iconBg }]}>
                <Ionicons name={cl.iconName as any} size={18} color={cl.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.clName}>{cl.name}</Text>
                <Text style={s.clMeta}>
                  {cl.isMultiStop
                    ? `${cl.stops.length} stops · ${cl.stops.reduce(
                        (a, st) => a + st.items.length,
                        0
                      )} items · Multi-stop mode`
                    : `${cl.startItems.length} items · ${
                        cl.endOfTripEnabled ? 'Start + end' : 'Start only'
                      } · Auto-trigger ${cl.autoDetect ? 'on' : 'off'}`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={s.btn} onPress={() => navigation.navigate('NewChecklist')}>
          <Ionicons name="add" size={16} color={theme.colors.textPrimary} />
          <Text style={s.btnText}> New checklist</Text>
        </TouchableOpacity>

        {/* Recent trips */}
        <Text style={s.sectionLabel}>Recent trips</Text>
        <View style={s.card}>
          {recentLogs.length === 0 ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>
              No trips yet — start your first checklist!
            </Text>
          ) : (
            recentLogs.map((log, idx) => (
              <View
                key={log.id}
                style={[s.logRow, idx < recentLogs.length - 1 && s.logRowBorder]}
              >
                <View
                  style={[
                    s.logDot,
                    { backgroundColor: log.isComplete ? theme.colors.primary : theme.colors.danger },
                  ]}
                />
                <Text style={s.logName}>{log.checklistName}</Text>
                <Text style={s.logMeta}>
                  {formatTimeAgo(log.timestamp)} · {log.checkedCount}/{log.totalCount}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* Stats */}
        <View style={s.statGrid}>
          <View style={s.statCard}>
            <Text style={s.statVal}>{tripsThisWeek}</Text>
            <Text style={s.statLabel}>Trips this week</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statVal, { color: theme.colors.primary }]}>{completionRate}%</Text>
            <Text style={s.statLabel}>Completion rate</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgSecondary },
  scroll: { padding: 16, gap: 12 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '500', color: theme.colors.textPrimary },
  iconBtn: { padding: 6 },

  detectBanner: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detectBannerOff: {
    backgroundColor: theme.colors.bgSecondary,
    borderColor: theme.colors.borderTertiary,
  },
  detectTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.primaryDeep },
  detectTitleOff: { color: theme.colors.textSecondary },
  detectSub: { fontSize: 12, color: theme.colors.primaryDark, marginTop: 2 },
  detectSubOff: { color: theme.colors.textTertiary },
  simBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  simBtnText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  setupLink: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: -4,
  },

  adBanner: {
    backgroundColor: theme.colors.bgTertiary,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderSecondary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adText: { fontSize: 12, color: theme.colors.textTertiary },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 2,
  },
  card: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  clRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  clRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  clIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  clMeta: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  btnText: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  logRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logName: { flex: 1, fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },
  logMeta: { fontSize: 12, color: theme.colors.textSecondary },

  statGrid: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  statVal: { fontSize: 22, fontWeight: '500', color: theme.colors.textPrimary },
  statLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
});
