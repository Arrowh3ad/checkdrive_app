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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/useAppStore';
import { theme } from '../theme';
import { generateId } from '../utils/ids';

export function NewChecklistScreen() {
  const navigation = useNavigation();
  const { addChecklist, settings } = useAppStore();

  const [name, setName] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [geofence, setGeofence] = useState(false);
  const [endOfTrip, setEndOfTrip] = useState(true);
  const [itemInput, setItemInput] = useState('');
  const [items, setItems] = useState<string[]>([]);

  function addItem() {
    const val = itemInput.trim();
    if (!val) return;
    setItems((prev) => [...prev, val]);
    setItemInput('');
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a name for this checklist.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Items required', 'Add at least one item to your checklist.');
      return;
    }
    addChecklist({
      name: name.trim(),
      iconName: 'list-outline',
      iconBg: theme.colors.primaryLight,
      iconColor: theme.colors.primaryDark,
      startItems: items.map((label) => ({ id: generateId(), label })),
      endItems: [],
      stops: [],
      isMultiStop: false,
      autoDetect,
      geofenceEnabled: geofence,
      endOfTripEnabled: endOfTrip,
    });
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Topbar */}
          <View style={s.topbar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.title}>New checklist</Text>
          </View>

          {/* Name */}
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

          {/* Triggers */}
          <View style={s.card}>
            <Text style={s.cardSectionLabel}>Trigger settings</Text>
            <ToggleRow
              title="Auto-detect CarPlay / Android Auto"
              subtitle="Opens checklist when car connected"
              value={autoDetect}
              onToggle={setAutoDetect}
            />
            <ToggleRow
              title={`Geofence trigger ${!settings.isPro ? '(Pro)' : ''}`}
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
            <ToggleRow
              title="End of trip checklist"
              subtitle="Separate checklist on arrival"
              value={endOfTrip}
              onToggle={setEndOfTrip}
            />
          </View>

          {/* Items */}
          <View style={s.card}>
            <View style={s.itemsHeader}>
              <Text style={s.cardSectionLabel}>Items</Text>
              <Text style={s.itemCount}>
                {items.length} item{items.length !== 1 ? 's' : ''}
              </Text>
            </View>
            {items.length > 0 && (
              <View style={s.chipsWrap}>
                {items.map((label, idx) => (
                  <View key={idx} style={s.chip}>
                    <Text style={s.chipText}>{label}</Text>
                    <TouchableOpacity onPress={() => removeItem(idx)} hitSlop={8}>
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
                value={itemInput}
                onChangeText={setItemInput}
                onSubmitEditing={addItem}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={s.addBtn} onPress={addItem}>
                <Ionicons name="add" size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Pro upsell */}
          <View style={s.proBanner}>
            <View style={{ flex: 1 }}>
              <Text style={s.proTitle}>
                <Ionicons name="star" size={13} /> Multi-stop trips
              </Text>
              <Text style={s.proSub}>Add multiple stops with per-stop checklists</Text>
            </View>
            <TouchableOpacity
              style={s.proBtn}
              onPress={() => (navigation as any).navigate('Pro')}
            >
              <Text style={s.proBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={s.btnRow}>
            <TouchableOpacity style={s.btnSecondary} onPress={() => navigation.goBack()}>
              <Text style={s.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnPrimary} onPress={save}>
              <Ionicons name="checkmark-circle" size={15} color="#fff" />
              <Text style={s.btnPrimaryText}> Save checklist</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
        <Text style={[t.rowTitle, disabled && { opacity: 0.5 }]}>{title}</Text>
        <Text style={t.rowSub}>{subtitle}</Text>
      </View>
    </View>
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

const t = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  rowTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  rowSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
});
