// ─────────────────────────────────────────────────────────────────────────────
// screens/NewChecklistScreen.tsx  —  Create or edit a checklist.
//
// DUAL MODE
// The screen operates in two modes depending on whether `route.params.checklistId`
// is present:
//   • CREATE mode (no param) — all fields start empty / at defaults.
//   • EDIT mode (param present) — all fields are pre-filled from the existing
//     checklist; tapping Save calls `updateChecklist()` instead of `addChecklist()`.
//
// FORM SECTIONS
//   1. Name — free-text input
//   2. Appearance — icon picker (12 Ionicons presets), Color swatches (8 themes),
//      and optional custom photo via expo-image-picker
//   3. Trip mode — multi-stop toggle (Pro-gated)
//   4. Trigger settings — auto-detect, geofence (Pro), end-of-trip tab
//   5. Items / Stops — changes layout based on isMultiStop:
//        • Regular: two ItemsCard components (start items, end items)
//        • Multi-stop: a stop editor with per-stop name + item inputs
//
// CUSTOM PHOTO
// When the user picks a photo from their library, we copy it into
// `FileSystem.documentDirectory + 'checklist-icons/'`. This gives us a stable
// URI that remains valid across app restarts (the picker's temporary asset URI
// does not persist). The stable URI is stored as `iconUri` in the checklist.
//
// ITEM STATE
// Items are stored as plain `string[]` during editing (just labels, no IDs).
// IDs are generated only at save time to keep the editing state minimal.
// The `EditableStop` type mirrors this: items are strings, not ChecklistItems.
//
// NAVIGATION
// Reached from HomeScreen (new or via ⋮ menu → Edit).
// Params: `{ checklistId?: string }` — present only in edit mode.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import { RootStackParamList, StopStatus } from '../types';
import { generateId } from '../utils/ids';

type Route = RouteProp<RootStackParamList, 'NewChecklist'>;

// ── Appearance constants ──────────────────────────────────────────────────────

// The 12 preset icons shown in the icon grid (Ionicons outline variants).
const PRESET_ICONS: string[] = [
  'briefcase-outline', 'people-outline', 'location-outline', 'car-outline',
  'map-outline',       'home-outline',   'school-outline',   'medical-outline',
  'bag-handle-outline','cart-outline',   'airplane-outline', 'fitness-outline',
];

// The 8 color themes. Each theme is a `{ bg, color }` pair — bg is the icon's
// background square, color is the icon foreground (also used for the checkmark
// inside the swatch).
const PRESET_THEMES = [
  { bg: '#E1F5EE', color: '#0F6E56' }, // green
  { bg: '#EEEDFE', color: '#534AB7' }, // purple
  { bg: '#FAEEDA', color: '#854F0B' }, // amber
  { bg: '#DBEAFE', color: '#1D4ED8' }, // blue
  { bg: '#FCE7F3', color: '#9D174D' }, // pink
  { bg: '#FEE2E2', color: '#991B1B' }, // red
  { bg: '#F3F4F6', color: '#374151' }, // slate
  { bg: '#FEF9C3', color: '#854D0E' }, // yellow
];

// ── Local edit type for stops ─────────────────────────────────────────────────
// Stores items as plain strings (not ChecklistItems) during editing so the form
// state is simpler. IDs are generated only when the data is saved to the store.
type EditableStop = {
  id: string;
  name: string;
  items: string[];
  itemInput: string; // the uncommitted text currently in the "Add item" TextInput
};

// ── Screen ────────────────────────────────────────────────────────────────────

export function NewChecklistScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const { addChecklist, updateChecklist, checklists, settings } = useAppStore();

  // Determine if we're in edit mode by checking for a checklistId param.
  const editId = route.params?.checklistId;
  const editingChecklist = editId ? checklists.find((cl) => cl.id === editId) : undefined;
  const isEditing = !!editingChecklist;

  // ── Form state ─────────────────────────────────────────────────────────────
  // All state is initialized from the existing checklist in edit mode, or from
  // sensible defaults in create mode.

  const [name, setName] = useState(editingChecklist?.name ?? '');
  const [autoDetect, setAutoDetect] = useState(editingChecklist?.autoDetect ?? true);
  const [geofence, setGeofence] = useState(editingChecklist?.geofenceEnabled ?? false);
  const [endOfTrip, setEndOfTrip] = useState(editingChecklist?.endOfTripEnabled ?? true);
  const [isMultiStop, setIsMultiStop] = useState(editingChecklist?.isMultiStop ?? false);

  // Appearance state — icon, background color, and optional custom photo.
  const [selectedIcon, setSelectedIcon] = useState(
    editingChecklist?.iconName ?? 'list-outline'
  );
  const [selectedBg, setSelectedBg] = useState(
    editingChecklist?.iconBg ?? PRESET_THEMES[0].bg
  );
  const [selectedIconColor, setSelectedIconColor] = useState(
    editingChecklist?.iconColor ?? PRESET_THEMES[0].color
  );
  // Stable local file URI set after the user picks a photo; undefined = no custom photo.
  const [iconUri, setIconUri] = useState<string | undefined>(editingChecklist?.iconUri);

  // Regular mode item lists — stored as string labels, IDs generated at save time.
  const [startItemInput, setStartItemInput] = useState('');
  const [startItems, setStartItems] = useState<string[]>(
    editingChecklist?.startItems.map((i) => i.label) ?? []
  );
  const [endItemInput, setEndItemInput] = useState('');
  const [endItems, setEndItems] = useState<string[]>(
    editingChecklist?.endItems.map((i) => i.label) ?? []
  );

  // Multi-stop mode — initialized with one blank stop for create mode, or
  // the existing stops mapped to the editable format.
  const [stops, setStops] = useState<EditableStop[]>(
    editingChecklist?.isMultiStop && editingChecklist.stops.length > 0
      ? editingChecklist.stops.map((s) => ({
          id: s.id,
          name: s.name,
          items: s.items.map((i) => i.label),
          itemInput: '',
        }))
      : [{ id: generateId(), name: '', items: [], itemInput: '' }]
  );

  // ── Appearance helpers ──────────────────────────────────────────────────────

  async function pickCustomPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission required',
        'Allow photo library access to use a custom icon.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      // `MediaTypeOptions` is the correct API for expo-image-picker 55.x (SDK 55).
      // `MediaType` (the newer enum) doesn't exist in this version and would throw
      // "Cannot read property 'Images' of undefined" at runtime.
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],  // force square crop so the icon circle looks right
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    // The picker returns a temporary URI that won't persist across app restarts.
    // Copy to the app's document directory for a stable, persistent URI.
    const dir = FileSystem.documentDirectory + 'checklist-icons/';
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const destUri = dir + `icon-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: destUri });

    setIconUri(destUri);
  }

  function clearCustomPhoto() {
    setIconUri(undefined);
  }

  // Selecting a preset theme clears the custom photo — the two are mutually exclusive.
  function selectTheme(bg: string, color: string) {
    setSelectedBg(bg);
    setSelectedIconColor(color);
    setIconUri(undefined);
  }

  function selectIcon(iconName: string) {
    setSelectedIcon(iconName);
    setIconUri(undefined); // switching to a preset clears the custom photo
  }

  // ── Item helpers ────────────────────────────────────────────────────────────

  function addStartItem() {
    const val = startItemInput.trim();
    if (!val) return;
    setStartItems((prev) => [...prev, val]);
    setStartItemInput('');
  }
  function removeStartItem(idx: number) {
    setStartItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function addEndItem() {
    const val = endItemInput.trim();
    if (!val) return;
    setEndItems((prev) => [...prev, val]);
    setEndItemInput('');
  }
  function removeEndItem(idx: number) {
    setEndItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Stop helpers ────────────────────────────────────────────────────────────

  function addStop() {
    setStops((prev) => [...prev, { id: generateId(), name: '', items: [], itemInput: '' }]);
  }
  function removeStop(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }
  function updateStopName(stopId: string, val: string) {
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, name: val } : s)));
  }
  function updateStopInput(stopId: string, val: string) {
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, itemInput: val } : s)));
  }
  function addStopItem(stopId: string) {
    setStops((prev) =>
      prev.map((s) => {
        if (s.id !== stopId) return s;
        const val = s.itemInput.trim();
        if (!val) return s;
        return { ...s, items: [...s.items, val], itemInput: '' };
      })
    );
  }
  function removeStopItem(stopId: string, itemIdx: number) {
    setStops((prev) =>
      prev.map((s) =>
        s.id === stopId ? { ...s, items: s.items.filter((_, i) => i !== itemIdx) } : s
      )
    );
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  function save() {
    // Validate required fields before writing to the store.
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a checklist name.');
      return;
    }
    // Free plan checklist cap — checked again here in case the user navigated
    // directly to this screen without going through the HomeScreen guard.
    if (!settings.isPro && !isEditing && checklists.length >= 3) {
      Alert.alert(
        'Checklist limit reached',
        'Free plan allows up to 3 checklists. Upgrade to Pro for unlimited.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Upgrade', onPress: () => (navigation as any).navigate('Pro') },
        ]
      );
      return;
    }
    if (isMultiStop) {
      if (stops.length === 0) {
        Alert.alert('Stops required', 'Add at least one stop.');
        return;
      }
      if (stops.every((s) => s.items.length === 0)) {
        Alert.alert('Items required', 'Add at least one item to a stop.');
        return;
      }
    } else if (startItems.length === 0) {
      Alert.alert('Items required', 'Add at least one start item.');
      return;
    }

    // Build the Checklist payload. Generate IDs for items/stops at this point —
    // the editing state stored only labels.
    const data = {
      name: name.trim(),
      iconName: selectedIcon,
      iconBg: selectedBg,
      iconColor: selectedIconColor,
      iconUri,
      // Multi-stop checklists use `stops` instead of `startItems`/`endItems`.
      startItems: isMultiStop ? [] : startItems.map((label) => ({ id: generateId(), label })),
      endItems:   isMultiStop ? [] : endItems.map((label) => ({ id: generateId(), label })),
      stops: isMultiStop
        ? stops.map((es, idx) => ({
            id: es.id,
            name: es.name.trim() || `Stop ${idx + 1}`, // fallback name if left blank
            subtitle: `${es.items.length} item${es.items.length !== 1 ? 's' : ''}`,
            items: es.items.map((label) => ({ id: generateId(), label })),
            // First stop starts as 'current'; subsequent stops start as 'upcoming'.
            status: (idx === 0 ? 'current' : 'upcoming') as StopStatus,
            checkedItems: [],
          }))
        : [],
      isMultiStop,
      autoDetect,
      geofenceEnabled: geofence,
      // Multi-stop trips don't have a separate end-of-trip tab.
      endOfTripEnabled: isMultiStop ? false : endOfTrip,
    };

    if (isEditing && editingChecklist) {
      updateChecklist(editingChecklist.id, data);
    } else {
      addChecklist(data);
    }
    navigation.goBack();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      {/* KeyboardAvoidingView pushes content up when the soft keyboard appears,
          preventing the active TextInput from being hidden behind the keyboard.
          Only needed on iOS; Android handles this natively via windowSoftInputMode. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          // `handled` allows taps on Touchable elements to dismiss the keyboard
          // without also triggering the scroll gesture.
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Topbar ────────────────────────────────────────────────────── */}
          <View style={s.topbar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            {/* Title reflects the current mode */}
            <Text style={s.title}>{isEditing ? 'Edit checklist' : 'New checklist'}</Text>
          </View>

          {/* ── Name input ────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.inputLabel}>Checklist name</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Morning commute"
              placeholderTextColor={theme.colors.textTertiary}
              value={name}
              onChangeText={setName}
              returnKeyType="done"
            />
          </View>

          {/* ── Appearance ────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.cardSectionLabel}>Appearance</Text>

            {/* Live 56×56 preview of the current icon selection */}
            <View style={ap.previewRow}>
              <View style={[ap.preview, { backgroundColor: iconUri ? '#fff' : selectedBg }]}>
                {iconUri ? (
                  <Image source={{ uri: iconUri }} style={ap.previewImage} resizeMode="cover" />
                ) : (
                  <Ionicons name={selectedIcon as any} size={28} color={selectedIconColor} />
                )}
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={ap.previewLabel}>
                  {iconUri
                    ? 'Custom photo'
                    : selectedIcon.replace('-outline', '').replace(/-/g, ' ')}
                </Text>
                <TouchableOpacity style={ap.photoBtn} onPress={pickCustomPhoto}>
                  <Ionicons name="image-outline" size={14} color={theme.colors.purple} />
                  <Text style={ap.photoBtnText}>
                    {' '}{iconUri ? 'Change photo' : 'Use custom photo'}
                  </Text>
                </TouchableOpacity>
                {iconUri && (
                  <TouchableOpacity onPress={clearCustomPhoto}>
                    <Text style={ap.clearText}>Clear photo</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Preset icon grid — 4 columns */}
            <Text style={ap.sectionLabel}>Icon</Text>
            <View style={ap.iconGrid}>
              {PRESET_ICONS.map((icon) => {
                // An icon is "active" when it's selected AND no custom photo overrides it.
                const active = selectedIcon === icon && !iconUri;
                return (
                  <TouchableOpacity
                    key={icon}
                    style={[
                      ap.iconCell, 
                     
                      active && { backgroundColor: selectedBg }
                    ]}
                    onPress={() => selectIcon(icon)}
                  >
                    {/* Wrap the icon in an absolute fill to force correct Flexbox centering */}
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons
                        name={icon as any}
                        size={20}
                        color={active ? selectedIconColor : theme.colors.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Color theme swatches */}
            <Text style={ap.sectionLabel}>Color</Text>
            <View style={ap.themeRow}>
              {PRESET_THEMES.map((t) => {
                const active = selectedBg === t.bg && !iconUri;
                return (
                  <TouchableOpacity
                    key={t.bg}
                    style={[
                      ap.swatch,
                      { backgroundColor: t.bg },
                      active && ap.swatchActive,
                    ]}
                    onPress={() => selectTheme(t.bg, t.color)}
                  >
                    {/* Checkmark shows which color is selected */}
                    {active && (
                      <Ionicons name="checkmark" size={13} color={t.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Trip mode ─────────────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.cardSectionLabel}>Trip mode</Text>
            <ToggleRow
              title={`Multi-stop trip${!settings.isPro ? ' (Pro)' : ''}`}
              subtitle="Per-stop checklists with CarPlay auto-advance"
              value={isMultiStop}
              onToggle={(v) => {
                if (!settings.isPro) {
                  // Show the upsell dialog without changing state.
                  Alert.alert(
                    'Pro feature',
                    'Upgrade to Pro to create multi-stop trips.',
                    [
                      { text: 'Not now', style: 'cancel' },
                      { text: 'Upgrade', onPress: () => (navigation as any).navigate('Pro') },
                    ]
                  );
                  return;
                }
                setIsMultiStop(v);
              }}
              disabled={!settings.isPro}
            />
          </View>

          {/* ── Trigger settings ──────────────────────────────────────────── */}
          <View style={s.card}>
            <Text style={s.cardSectionLabel}>Trigger settings</Text>
            <ToggleRow
              title="Auto-detect CarPlay / Android Auto"
              subtitle="Opens checklist when car connected"
              value={autoDetect}
              onToggle={setAutoDetect}
            />
            <ToggleRow
              title={`Geofence trigger${!settings.isPro ? ' (Pro)' : ''}`}
              subtitle="Trigger when leaving home location"
              value={geofence}
              onToggle={(v) => {
                if (!settings.isPro) {
                  Alert.alert('Pro feature', 'Upgrade to Pro to use geofence triggers.');
                  return;
                }
                setGeofence(v);
              }}
              disabled={!settings.isPro}
            />
            {/* End-of-trip toggle is hidden for multi-stop mode — they don't have separate tabs */}
            {!isMultiStop && (
              <ToggleRow
                title="End of trip checklist"
                subtitle="Separate checklist on arrival"
                value={endOfTrip}
                onToggle={setEndOfTrip}
              />
            )}
          </View>

          {/* ── Regular mode: start items ──────────────────────────────────── */}
          {!isMultiStop && (
            <ItemsCard
              label="Start items"
              items={startItems}
              input={startItemInput}
              onInputChange={setStartItemInput}
              onAdd={addStartItem}
              onRemove={removeStartItem}
            />
          )}

          {/* ── Regular mode: end items (only when endOfTrip is on) ──────────── */}
          {!isMultiStop && endOfTrip && (
            <ItemsCard
              label="End items"
              items={endItems}
              input={endItemInput}
              onInputChange={setEndItemInput}
              onAdd={addEndItem}
              onRemove={removeEndItem}
            />
          )}

          {/* ── Multi-stop: stops editor ───────────────────────────────────── */}
          {isMultiStop && (
            <View style={s.card}>
              <Text style={s.cardSectionLabel}>Stops</Text>
              {stops.map((stop, idx) => (
                <View key={stop.id} style={[se.stopCard, idx > 0 && se.stopCardBorder]}>
                  <View style={se.stopHeader}>
                    <Text style={se.stopLabel}>Stop {idx + 1}</Text>
                    {/* Don't allow removing the last stop */}
                    {stops.length > 1 && (
                      <TouchableOpacity onPress={() => removeStop(stop.id)}>
                        <Ionicons name="trash-outline" size={15} color={theme.colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={s.textInput}
                    placeholder={`Stop name (e.g. "Gas station")`}
                    placeholderTextColor={theme.colors.textTertiary}
                    value={stop.name}
                    onChangeText={(v) => updateStopName(stop.id, v)}
                    returnKeyType="done"
                  />
                  {/* Chips for already-added items */}
                  {stop.items.length > 0 && (
                    <View style={s.chipsWrap}>
                      {stop.items.map((label, itemIdx) => (
                        <View key={itemIdx} style={s.chip}>
                          <Text style={s.chipText}>{label}</Text>
                          <TouchableOpacity
                            onPress={() => removeStopItem(stop.id, itemIdx)}
                            hitSlop={8}
                          >
                            <Ionicons name="close" size={13} color={theme.colors.textTertiary} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {/* Add-item row: TextInput + "+" button */}
                  <View style={s.addRow}>
                    <TextInput
                      style={[s.textInput, { flex: 1 }]}
                      placeholder="Add item..."
                      placeholderTextColor={theme.colors.textTertiary}
                      value={stop.itemInput}
                      onChangeText={(v) => updateStopInput(stop.id, v)}
                      onSubmitEditing={() => addStopItem(stop.id)}
                      returnKeyType="done"
                      blurOnSubmit={false} // keep keyboard open after submitting
                    />
                    <TouchableOpacity style={s.addBtn} onPress={() => addStopItem(stop.id)}>
                      <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={se.addStopBtn} onPress={addStop}>
                <Ionicons name="add" size={15} color={theme.colors.purple} />
                <Text style={se.addStopText}> Add stop</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pro upsell banner — shown in create mode for free users */}
          {!settings.isPro && !isEditing && (
            <View style={s.proBanner}>
              <View style={{ flex: 1 }}>
                <Text style={s.proTitle}>
                  <Ionicons name="star" size={13} /> Multi-stop, geofencing & more
                </Text>
                <Text style={s.proSub}>Unlock with Pro — $2.99/mo</Text>
              </View>
              <TouchableOpacity
                style={s.proBtn}
                onPress={() => (navigation as any).navigate('Pro')}
              >
                <Text style={s.proBtnText}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Save / Cancel ────────────────────────────────────────────── */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.goBack()}>
              <Text style={s.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={save}>
              <Ionicons name="checkmark-circle" size={15} color="#fff" />
              <Text style={s.btnPrimaryText}>
                {' '}{isEditing ? 'Save changes' : 'Save checklist'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Reusable card for an item list (Start items / End items in regular mode).
// Extracted to avoid duplicating the chip-list + add-row layout.
function ItemsCard({
  label,
  items,
  input,
  onInputChange,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <View style={s.card}>
      <View style={s.itemsHeader}>
        <Text style={s.cardSectionLabel}>{label}</Text>
        <Text style={s.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>
      {items.length > 0 && (
        <View style={s.chipsWrap}>
          {items.map((item, idx) => (
            <View key={idx} style={s.chip}>
              <Text style={s.chipText}>{item}</Text>
              <TouchableOpacity onPress={() => onRemove(idx)} hitSlop={8}>
                <Ionicons name="close" size={13} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <View style={s.addRow}>
        <TextInput
          style={[s.textInput, { flex: 1 }]}
          placeholder="Add item..."
          placeholderTextColor={theme.colors.textTertiary}
          value={input}
          onChangeText={onInputChange}
          onSubmitEditing={onAdd}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <TouchableOpacity style={s.addBtn} onPress={onAdd}>
          <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Reusable labelled toggle row shared between the Trip mode and Trigger sections.
function ToggleRow({
  title,
  subtitle,
  value,
  onToggle,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={t.row}>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.borderSecondary, true: theme.colors.primary }}
        thumbColor="#fff"
        disabled={disabled}
      />
      <View style={{ flex: 1 }}>
        {/* Dim the label when disabled so the Pro-gating is visually obvious */}
        <Text style={[t.rowTitle, disabled && { opacity: 0.45 }]}>{title}</Text>
        <Text style={t.rowSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

// ── StyleSheets ────────────────────────────────────────────────────────────────

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
    gap: 10,
  },
  inputLabel: { fontSize: 13, color: theme.colors.textSecondary },
  textInput: {
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.bgPrimary,
  },
  cardSectionLabel: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  itemsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemCount: { fontSize: 12, color: theme.colors.textSecondary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.md,
  },
  chipText: { fontSize: 13, color: theme.colors.textPrimary },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addBtn: {
    padding: 9,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },

  proBanner: {
    backgroundColor: theme.colors.purpleLight,
    borderWidth: 0.5,
    borderColor: theme.colors.purpleBorder,
    borderRadius: theme.radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.purpleDark },
  proSub: { fontSize: 12, color: theme.colors.purple, marginTop: 2 },
  proBtn: {
    backgroundColor: theme.colors.purple,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  proBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  btnRow: { flexDirection: 'row', gap: 8 },
  btnSecondary: {
    flex: 1,
    padding: 11,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
    alignItems: 'center',
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




// Appearance card styles
const ap = StyleSheet.create({
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  preview: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // clips the custom photo to the rounded rect
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  previewImage: { width: 56, height: 56 },
  previewLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    textTransform: 'capitalize',
  },
  photoBtn: { flexDirection: 'row', alignItems: 'center' },
  photoBtnText: { fontSize: 13, color: theme.colors.purple, fontWeight: '500' },
  clearText: { fontSize: 12, color: theme.colors.danger },
  sectionLabel: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  // 4-column icon grid: `22%` width + `gap: 8` fills the card horizontally.
// 4-column icon grid
  iconGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8, 
    // Add this to distribute the leftover space evenly
    justifyContent: 'space-between' 
  },
  iconCell: {
    // 23% * 4 = 92%, leaving 8% for the 3 gaps. 
    // This perfectly fits 4 columns without overflowing to 3.
    width: '23%', 
    
    // Hardcode a rectangular height instead of a square aspect ratio.
    // 48 to 52 is usually the sweet spot for these kinds of touch targets.
    height: 48, 
    
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bgSecondary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  // Active swatch gets a thicker border so it stands out.
  swatchActive: { borderWidth: 2, borderColor: theme.colors.textSecondary },
});

// Stop editor styles (used inside the multi-stop section)
const se = StyleSheet.create({
  stopCard: { paddingTop: 12, gap: 8 },
  stopCardBorder: { borderTopWidth: 0.5, borderTopColor: theme.colors.borderTertiary },
  stopHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stopLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  addStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: theme.colors.borderTertiary,
  },
  addStopText: { fontSize: 14, fontWeight: '500', color: theme.colors.purple },
});

// ToggleRow styles
const t = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
});
