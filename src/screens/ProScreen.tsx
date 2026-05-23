import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';

const FEATURES = [
  {
    title: 'Unlimited checklists',
    subtitle: 'Free plan limited to 3',
  },
  {
    title: 'Multi-stop trips',
    subtitle: 'Per-stop checklists for complex routes',
  },
  {
    title: 'Geofence triggers',
    subtitle: 'Auto-launch when leaving home',
  },
  {
    title: 'No ads',
    subtitle: 'Clean, distraction-free experience',
  },
  {
    title: 'Trip history & analytics',
    subtitle: 'Full logs and completion trends',
  },
];

export function ProScreen() {
  const navigation = useNavigation();
  const { updateSettings } = useAppStore();

  function handleSubscribe() {
    Alert.alert(
      'Subscribe to Pro',
      'In production this opens the App Store / Google Play in-app purchase flow via RevenueCat or similar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Simulate Pro',
          onPress: () => {
            updateSettings({ isPro: true });
            Alert.alert('Welcome to Pro!', 'Pro features are now unlocked.', [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>CheckDrive Pro</Text>
        </View>

        {/* Hero */}
        <View style={[s.card, s.hero]}>
          <MaterialCommunityIcons name="crown" size={42} color={theme.colors.purple} />
          <Text style={s.heroTitle}>Go Pro</Text>
          <Text style={s.heroSub}>Everything you need, nothing you don't</Text>
        </View>

        {/* Feature list */}
        <View style={s.card}>
          {FEATURES.map((f, idx) => (
            <View
              key={f.title}
              style={[s.featureRow, idx < FEATURES.length - 1 && s.featureRowBorder]}
            >
              <Ionicons name="checkmark" size={18} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureSub}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Subscribe */}
        <TouchableOpacity style={s.subscribeBtn} onPress={handleSubscribe}>
          <MaterialCommunityIcons name="crown" size={16} color="#fff" />
          <Text style={s.subscribeBtnText}> Start for $2.99/month</Text>
        </TouchableOpacity>

        <Text style={s.annualNote}>
          Also available: $24.99/year (save 30%) · Cancel anytime
        </Text>
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
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 6,
  },
  heroTitle: { fontSize: 20, fontWeight: '500', color: theme.colors.textPrimary },
  heroSub: { fontSize: 14, color: theme.colors.textSecondary },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
  },
  featureRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.borderTertiary,
  },
  featureTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  featureSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },

  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  subscribeBtnText: { fontSize: 16, fontWeight: '500', color: '#fff' },
  annualNote: { textAlign: 'center', fontSize: 12, color: theme.colors.textTertiary },
});
