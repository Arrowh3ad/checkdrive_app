// ─────────────────────────────────────────────────────────────────────────────
// screens/ParkingScreen.tsx  —  "Where did I park?" — latest spot + history.
//
// Parking records are captured by the native car-bluetooth service when the car
// disconnects (Android), and synced into the store by useCarDetection. This
// screen just presents them:
//   • Latest spot — time, "Open in Maps", and (Pro) a photo + note of the spot.
//   • History — older spots (Pro). Free users see only the latest, with an
//     upgrade nudge for photos/notes/history.
//
// "Open in Maps" uses a platform geo/maps URL — no map SDK or API key needed.
// Photos reuse the same expo-image-picker + legacy FileSystem pattern as the
// custom checklist icon, copying into the app's document dir for a stable URI.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Linking,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as CarBluetooth from '../../modules/car-bluetooth';
import { useAppStore } from '../store/useAppStore';
import { ParkingRecord } from '../types';
import { theme } from '../theme';

// Compact relative time, falling back to an absolute date for older spots.
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

// Opens the coordinates in the platform's maps app. Falls back to a Google Maps
// web URL if the native scheme can't be handled.
function openInMaps(rec: ParkingRecord) {
  const label = encodeURIComponent('Parked car');
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${rec.lat},${rec.lng}&q=${label}`
      : `geo:${rec.lat},${rec.lng}?q=${rec.lat},${rec.lng}(${label})`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${rec.lat},${rec.lng}`
    );
  });
}

export function ParkingScreen() {
  const navigation = useNavigation();
  const { parking, settings, updateParkingRecord, deleteParkingRecord } = useAppStore();
  const isPro = settings.isPro;

  const latest: ParkingRecord | undefined = parking[0];
  const history = parking.slice(1);

  function requireProThen(action: () => void) {
    if (!isPro) {
      Alert.alert('Pro feature', 'Upgrade to Pro to add photos and notes to your parking spots.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Upgrade', onPress: () => (navigation as any).navigate('Pro') },
      ]);
      return;
    }
    action();
  }

  async function addPhoto(rec: ParkingRecord) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera needed', 'Allow camera access to snap a photo of your parking spot.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;
    try {
      const dir = FileSystem.documentDirectory + 'parking/';
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = dir + `park-${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: result.assets[0].uri, to: dest });
      updateParkingRecord(rec.id, { photoUri: dest });
    } catch {
      Alert.alert('Couldn’t save photo', 'Something went wrong saving the photo.');
    }
  }

  // Manually capture the current spot — also the way to test capture without a
  // real car disconnect. The saved fix flows back through the onParkingSaved
  // listener (in useCarDetection) into the store, so this screen updates itself.
  async function saveCurrentSpot() {
    if (Platform.OS === 'android') {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (res !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Location needed', 'Allow location access to save where you parked.');
        return;
      }
    }
    const started = await CarBluetooth.captureParkingNow();
    if (!started) {
      Alert.alert(
        'Not available here',
        'Saving your spot needs the installed app (not Expo Go) on Android 12+.'
      );
      return;
    }
    Alert.alert('Saving your spot', 'Grabbing your current location — it’ll appear here in a moment.');
  }

  function confirmDelete(rec: ParkingRecord) {
    Alert.alert('Delete this spot?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteParkingRecord(rec.id) },
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
          <Text style={s.title}>Where did I park?</Text>
        </View>

        {/* Manual capture — works without a car disconnect (also the test path). */}
        {Platform.OS === 'android' && (
          <TouchableOpacity style={s.saveSpotBtn} onPress={saveCurrentSpot}>
            <Ionicons name="pin" size={16} color="#fff" />
            <Text style={s.saveSpotText}>  Save my current spot</Text>
          </TouchableOpacity>
        )}

        {!latest ? (
          // ── Empty state ──────────────────────────────────────────────────
          <View style={s.emptyCard}>
            <Ionicons name="car-outline" size={36} color={theme.colors.textTertiary} />
            <Text style={s.emptyTitle}>No parking saved yet</Text>
            <Text style={s.emptyText}>
              With the parking finder on, CheckDrive saves your spot automatically when your car
              disconnects. Park once and it’ll show up here.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Latest spot ─────────────────────────────────────────────── */}
            <Text style={s.sectionLabel}>Latest spot</Text>
            <View style={s.card}>
              <View style={s.latestHead}>
                <View style={s.pin}>
                  <Ionicons name="location" size={18} color={theme.colors.primaryDeep} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.latestTime}>{timeAgo(latest.savedAt)}</Text>
                  <Text style={s.coords}>
                    {latest.lat.toFixed(5)}, {latest.lng.toFixed(5)}
                  </Text>
                </View>
              </View>

              {latest.photoUri && (
                <Image source={{ uri: latest.photoUri }} style={s.photo} resizeMode="cover" />
              )}

              {/* Note — editable for Pro, hidden prompt for free */}
              {isPro ? (
                <TextInput
                  key={latest.id}
                  style={s.noteInput}
                  placeholder="Add a note (e.g. Level 3, B12)"
                  placeholderTextColor={theme.colors.textTertiary}
                  defaultValue={latest.note}
                  onEndEditing={(e) =>
                    updateParkingRecord(latest.id, { note: e.nativeEvent.text.trim() || undefined })
                  }
                  returnKeyType="done"
                  maxLength={120}
                />
              ) : null}

              <TouchableOpacity style={s.primaryBtn} onPress={() => openInMaps(latest)}>
                <Ionicons name="navigate" size={16} color="#fff" />
                <Text style={s.primaryBtnText}>  Open in Maps</Text>
              </TouchableOpacity>

              <View style={s.secondaryRow}>
                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={() => requireProThen(() => addPhoto(latest))}
                >
                  <Ionicons name="camera-outline" size={15} color={theme.colors.textPrimary} />
                  <Text style={s.secondaryBtnText}>
                    {latest.photoUri ? ' Retake photo' : ' Add photo'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => confirmDelete(latest)}>
                  <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                  <Text style={[s.secondaryBtnText, { color: theme.colors.danger }]}> Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Pro upsell for free users ───────────────────────────────── */}
            {!isPro && (
              <TouchableOpacity style={s.upsell} onPress={() => (navigation as any).navigate('Pro')}>
                <Ionicons name="lock-closed" size={14} color={theme.colors.purpleDark} />
                <Text style={s.upsellText}>
                  Upgrade to Pro to add photos & notes and keep your parking history.
                </Text>
              </TouchableOpacity>
            )}

            {/* ── History (Pro only) ──────────────────────────────────────── */}
            {isPro && history.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Earlier spots</Text>
                {history.map((rec) => (
                  <View key={rec.id} style={s.historyRow}>
                    <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.historyTime}>{timeAgo(rec.savedAt)}</Text>
                      {rec.note ? <Text style={s.historyNote}>{rec.note}</Text> : null}
                    </View>
                    <TouchableOpacity onPress={() => openInMaps(rec)} style={s.historyAction}>
                      <Ionicons name="navigate-outline" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(rec)} style={s.historyAction}>
                      <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </>
        )}
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
    padding: 16,
    gap: 12,
  },
  latestHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  latestTime: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary },
  coords: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  photo: { width: '100%', height: 160, borderRadius: theme.radius.md },
  noteInput: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textPrimary,
  },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  secondaryBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.textPrimary },

  upsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.purpleLight,
    borderWidth: 0.5,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  upsellText: { flex: 1, fontSize: 13, color: theme.colors.purpleDark, lineHeight: 18 },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyTime: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  historyNote: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  historyAction: { padding: 6 },

  saveSpotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  saveSpotText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  emptyCard: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    padding: 28,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  emptyText: { fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
