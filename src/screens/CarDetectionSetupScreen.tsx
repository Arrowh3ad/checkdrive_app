// ─────────────────────────────────────────────────────────────────────────────
// screens/CarDetectionSetupScreen.tsx  —  One-time car-detection setup guide.
//
// This screen explains why the app can't auto-detect CarPlay / Android Auto
// (Apple and Google restrict SDK access to approved categories) and walks the
// user through a one-time automation setup for BOTH connect and disconnect.
//
// iOS — TWO-SHORTCUT METHOD (required for iOS 17+ / 18+)
// ─────────────────────────────────────────────────────────
// In recent iOS versions, CarPlay automations don't surface "Open URLs"
// directly in the suggested-action picker — you see only "Open App",
// "New Shortcut", "Run Shortcut", etc. The solution is to put the URL-opening
// logic in a separate regular shortcut, then have the automation run that
// shortcut. This indirection always works because regular shortcuts have the
// full action library available, and "Run Shortcut" is always available inside
// automations.
//
// Two shortcuts + two automations are needed:
//   "Start CheckDrive" shortcut  → checkdrive://trigger
//   "Stop CheckDrive" shortcut   → checkdrive://disconnect
//   Automation: CarPlay Is Connected    → Run "Start CheckDrive"
//   Automation: CarPlay Is Disconnected → Run "Stop CheckDrive"
//
// iOS NOTIFICATION LIMITATION (vs Android)
// Unlike Android's AutomateIt "Notification" action, iOS Shortcuts' "Show
// Notification" action is fire-and-forget — you cannot attach a tap/deep-link
// to it, so its banner opens the Shortcuts app, not CheckDrive. The actionable
// "tap to open my checklist" notification on iOS is the one CheckDrive itself
// posts after the Open URLs deep link (the app opens briefly, then with "Open
// app on connect" off it just notifies). See IOS_NOTIFY_STEPS for the quieter
// but passive Show Notification path, documented with that caveat.
//
// ANDROID — BLUETOOTH TRIGGER + DEEP-LINK URL
// ────────────────────────────────────────────
// True Android Auto connection detection (androidx.car.app.connection.
// CarConnection content provider) requires native Kotlin code inside the app
// binary — it can't be set up by the user from outside. The practical
// alternative for the managed Expo workflow is a user-side automation app
// that listens for a Bluetooth-connect/-disconnect event and fires the
// CheckDrive deep-link URL.
//
// ONLY AutomateIt is documented step-by-step (it's the confirmed-working tool
// with the simplest discrete triggers). Automate, Tasker, and Bixby step data
// are kept SHELVED (commented out) below in case we want them back. Other apps
// are covered by a "Prefer a different automation app?" dropdown that gives the
// universal intent recipe rather than per-app menus.
//
//   • AutomateIt by SmarterApps — free. Discrete "Bluetooth Connected" /
//     "Bluetooth Disconnected" triggers (two rules). CONFIRMED action:
//     "Launch Intent" → component type Activity (NOT Broadcast) → Advanced →
//     Action = android.intent.action.VIEW, Data = checkdrive://… . BOTH Advanced
//     fields are required. The quieter variant swaps "Launch Intent" for the
//     "Notification" action, configured identically (tap opens the app).
//
//   • Universal recipe (any app): trigger on the car's BT connect/disconnect;
//     action = start an Activity intent with Action=android.intent.action.VIEW
//     and Data=checkdrive://trigger (or checkdrive://disconnect). NOT a broadcast.
//
// WHY URL go / Send Intent, NOT "SEND APP BROADCAST" OR "OPEN WEBSITE"?
// "Send app broadcast" routes through Android's broadcast system, used by
// our app for FCM (Firebase Cloud Messaging) and other system events — not
// for launching. "Open Website" hands the URL to a browser, which may
// intercept custom schemes. URL go (Automate) and Send Intent with VIEW
// action (Tasker) both fire android.intent.action.VIEW with checkdrive://
// data, which Android resolves directly to CheckDrive's deep-link handler.
//
// WHY NOT GOOGLE ASSISTANT ROUTINES?
// Routines don't support arbitrary URL scheme launching. The "start/stop
// driving" triggers also require Android Auto to be active, not just
// Bluetooth. Routines are also being deprecated in favour of Gemini (2026).
//
// TEST BUTTONS
// `Linking.openURL('checkdrive://trigger')` does NOT work for testing on iOS —
// iOS won't route an app's own URL scheme back to itself when it's already open.
// Instead the buttons call `simulateVehicleConnect` / `simulateVehicleDisconnect`
// directly (exported from useCarDetection.ts), which run the same logic without
// going through the URL scheme.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { simulateVehicleConnect, simulateVehicleDisconnect } from '../hooks/useCarDetection';

// ── Step data ─────────────────────────────────────────────────────────────────

// iOS connect — two-shortcut method (steps 1–4: create the shortcut,
// steps 5–7: create the automation that runs it).
const IOS_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Open Shortcuts → tap "+" to create a new shortcut',
    detail:
      'Go to the "My Shortcuts" tab (not Automation). Tap the "+" button in the top-right corner to create a new blank shortcut.',
  },
  {
    n: '2',
    title: 'Tap "Add Action" → search "URL" → add it',
    detail:
      'In the shortcut editor, tap "Add Action". Search for "URL" (it\'s in the Web category). Add it, then type the deep link: checkdrive://trigger',
  },
  {
    n: '3',
    title: 'Tap "Add Action" again → search "Open URLs" → add it',
    detail:
      '"Open URLs" will automatically use the URL you typed in the previous step. You should now see two actions stacked: URL → Open URLs.',
  },
  {
    n: '4',
    title: 'Name the shortcut "Start CheckDrive" → tap Done',
    detail:
      'Tap the shortcut\'s title at the top of the editor to rename it. Then tap Done. You can test it right now — tapping the shortcut should open CheckDrive.',
  },
  {
    n: '5',
    title: 'Go to Automation tab → "+" → New Automation → CarPlay',
    detail:
      'Switch to the Automation tab. Tap "+" → "New Automation". Scroll through the trigger list to find "CarPlay", then select "Is Connected".',
  },
  {
    n: '6',
    title: 'Tap "Add Action" → search "Run Shortcut" → select "Start CheckDrive"',
    detail:
      'Tap "Add Action" inside the automation editor. Search for "Run Shortcut", add it, then tap the "Shortcut" placeholder and choose "Start CheckDrive" from your shortcuts list.',
  },
  {
    n: '7',
    title: 'Turn off "Ask Before Running" → tap Done',
    detail:
      'At the bottom of the automation editor, toggle off "Ask Before Running" (and "Notify When Run" if shown). This lets CheckDrive open automatically whenever CarPlay connects.',
  },
];

// iOS disconnect — same two-shortcut pattern but with the disconnect URL
// and the "Is Disconnected" trigger. Kept shorter since the user already
// understands the pattern from the connect setup above.
const IOS_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'Open Shortcuts → tap "+" to create another new shortcut',
    detail:
      'Same as before — go to "My Shortcuts" tab, tap "+". This shortcut will send the disconnect signal.',
  },
  {
    n: '2',
    title: 'Add "URL" action → type checkdrive://disconnect → add "Open URLs"',
    detail:
      'Same two-action pattern: URL action with checkdrive://disconnect, then Open URLs. Name the shortcut "Stop CheckDrive" and tap Done.',
  },
  {
    n: '3',
    title: 'Automation tab → "+" → New Automation → CarPlay → Is Disconnected',
    detail:
      'Same flow as the connect automation, but choose "Is Disconnected" as the CarPlay trigger instead of "Is Connected".',
  },
  {
    n: '4',
    title: 'Add Action → "Run Shortcut" → select "Stop CheckDrive" → turn off "Ask Before Running" → Done',
    detail:
      'CheckDrive will now send an arrival reminder notification whenever CarPlay unplugs, so you don\'t forget your end-of-trip checklist.',
  },
];

// iOS "quieter" variant — a Shortcut whose only action is "Show Notification".
// IMPORTANT iOS LIMITATION: Shortcuts' Show Notification action is fire-and-
// forget — you CANNOT attach a tap/deep-link action to it, so tapping the
// banner opens the Shortcuts app, not CheckDrive. It's therefore a passive
// reminder. The actionable "tap to open my checklist" notification on iOS is
// the one CheckDrive itself posts via the Open URLs method (the app opens
// briefly, then with "Open app on connect" off it just notifies). The steps
// below document the Show Notification path honestly, caveat included.
const IOS_NOTIFY_STEPS = [
  {
    n: '1',
    title: 'New shortcut → add "Show Notification"',
    detail:
      'Shortcuts → "My Shortcuts" tab → tap "+". Tap "Add Action", search for ' +
      '"Show Notification", and add it.',
  },
  {
    n: '2',
    title: 'Set the notification text and name it',
    detail:
      'Type the body, e.g. "Time for your CheckDrive checklist." Tap "Show More" if you ' +
      'want to set a title or turn the sound off. Rename the shortcut to "CheckDrive ' +
      'Reminder" and tap Done.',
  },
  {
    n: '3',
    title: 'Run it from the CarPlay automation',
    detail:
      'In your "CarPlay Is Connected" automation, use Run Shortcut → "CheckDrive Reminder" ' +
      'instead of "Start CheckDrive". Turn off "Ask Before Running". (Make a second one with ' +
      '"Is Disconnected" if you want an arrival reminder too.)',
  },
  {
    n: '4',
    title: 'Heads-up: the tap opens Shortcuts, not CheckDrive',
    detail:
      'iOS won\'t let a Show Notification action deep-link on tap, so tapping this banner ' +
      'opens the Shortcuts app — it\'s just a reminder to open CheckDrive yourself. If you ' +
      'want the notification\'s tap to actually open your checklist, use the "Open URLs" ' +
      'method above instead: CheckDrive opens briefly and posts its own tappable ' +
      'notification, and with "Open app on connect" off in Settings it won\'t jump into a ' +
      'checklist — it just notifies.',
  },
];

// One-time Android permissions step — shared by Automate and Tasker, NOT
// needed for Bixby Routines (Bixby is a system app and isn't subject to the
// same battery / overlay restrictions). Shown once at the top of the Android
// section rather than duplicated inside every tool's dropdown.
const ANDROID_PERMISSIONS_STEP = {
  title: 'Grant permissions to your automation app (one-time)',
  detail:
    'Skip this for Bixby Routines — it\'s a system app and doesn\'t need these. ' +
    'For any installed app (AutomateIt, Automate, or Tasker), without these settings ' +
    'the trigger silently fails when the screen is off.\n\n' +
    '① Draw Over Other Apps — Settings → Apps → [your automation app] → Advanced ' +
    '→ Display over other apps → Allow.\n\n' +
    '② Unrestricted battery — Settings → Apps → [app] → Battery → Unrestricted ' +
    '(look for "Optimize battery usage" if you don\'t see this directly).\n\n' +
    'Manufacturer extras: on Samsung also enable Auto-start in the same battery menu. ' +
    'On Xiaomi go to Security → Autostart. On OnePlus check Battery Optimization in ' +
    'the system Battery settings.',
};

// ── Automate by LlamaLab (free) — SHELVED ────────────────────────────────────
// Removed from the UI to keep the screen focused on the one confirmed-working
// tool (AutomateIt). The universal intent recipe is now summarized in the
// "Prefer a different automation app?" dropdown instead. Kept here in case we
// want to document Automate in detail again later.
// TO RE-ACTIVATE: uncomment this block and add a matching <Collapsible> in the
// render section (search "SHELVED").
/*
const ANDROID_AUTOMATE_STEPS = [
  {
    n: '1',
    title: 'Install Automate and create a new flow',
    detail:
      'Install "Automate" by LlamaLab from Google Play (free). Tap the + button to ' +
      'create a new flow, tap the title bar and name it "CheckDrive car".',
  },
  {
    n: '2',
    title: 'Add the detector — "Bluetooth connected?" set to "When changed"',
    detail:
      'Tap + → Bluetooth → "Bluetooth connected?" — this is the "check if connected" ' +
      'block you found, the one with Yes/No outputs. Open it and set:\n' +
      '  Device:  tap the field → Pick device → your car\n' +
      '  Trigger: When changed   (NOT "Immediately")\n\n' +
      'Heads-up: the "Bluetooth connect" and "Bluetooth disconnect" blocks you also saw ' +
      'are ACTIONS that make your phone connect/disconnect — they don\'t detect the car, ' +
      'so ignore them. "Bluetooth connected?" with "When changed" is the detector: it ' +
      'fires every time the car connects OR disconnects.',
  },
  {
    n: '3',
    title: 'Add the connect launcher — "App start", NOT "App broadcast send"',
    detail:
      'Automate has no plain "URL" block (that\'s why you only found "App broadcast"). ' +
      'Tap + → Apps → "App start" — this launches an app by intent. Set:\n' +
      '  Action:   android.intent.action.VIEW\n' +
      '  Data URI: checkdrive://trigger\n' +
      'Leave Package / Class blank so Android resolves it to CheckDrive by the scheme.\n\n' +
      'Do NOT use "App broadcast send" — it routes through Android\'s broadcast system ' +
      '(where CheckDrive\'s Firebase receivers live) and will NOT open the app.',
  },
  {
    n: '4',
    title: 'Add the disconnect launcher — a second "App start"',
    detail:
      'Add another "App start" block with the same Action but:\n' +
      '  Data URI: checkdrive://disconnect',
  },
  {
    n: '5',
    title: 'Wire the Yes / No branches and loop them back',
    detail:
      'Connect the arrows:\n' +
      '  Begin → Bluetooth connected?\n' +
      '  Yes output → App start (checkdrive://trigger)\n' +
      '  No output  → App start (checkdrive://disconnect)\n\n' +
      'Then draw an arrow from EACH App start block back to the "Bluetooth connected?" ' +
      'block\'s input, so after firing it loops around and waits for the next change. ' +
      'Yes = car just connected; No = car just disconnected.',
  },
  {
    n: '6',
    title: 'Start the flow',
    detail:
      'Tap back, then tap the play button under the flow on Automate\'s home screen. ' +
      'This one flow now opens CheckDrive when your car connects and fires the ' +
      'disconnect link when it drops — no second flow needed.\n\n' +
      'If "App start" is hard to configure, AutomateIt (above) is the simpler route.',
  },
];
*/

// ── AutomateIt by SmarterApps (free) — the one documented tool ───────────────
// Rule-based (Trigger + Action) with discrete "Bluetooth Connected" /
// "Bluetooth Disconnected" triggers. CONFIRMED WORKING (per testing):
//   Action = "Launch Intent", component type = Activity (NOT Broadcast),
//   Advanced → Action = android.intent.action.VIEW, Data = checkdrive://…
// BOTH Advanced fields are required — leaving Action blank won't resolve the
// custom scheme. The quieter variant swaps "Launch Intent" for the
// "Notification" action, configured identically, so nothing opens until the
// user taps the notification.
const ANDROID_AUTOMATEIT_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Install AutomateIt and start a new rule',
    detail:
      'Install "AutomateIt" by SmarterApps from Google Play (free). Open it, go to ' +
      '"My Rules" and tap + (or "Create New Rule").',
  },
  {
    n: '2',
    title: 'Trigger: Bluetooth Device Connected → your car',
    detail:
      'Choose the "Bluetooth Device Connected" trigger, then pick your car\'s Bluetooth ' +
      'device so it only fires for your car.',
  },
  {
    n: '3',
    title: 'Action: Launch Intent → Activity → Advanced → Action + Data',
    detail:
      'Choose the "Launch Intent" action. Then:\n' +
      '  • Set the component type to Activity (NOT Broadcast)\n' +
      '  • Tap "Advanced"\n' +
      '  • In the "Action" field, enter:  android.intent.action.VIEW\n' +
      '  • In the "Data" field, enter:  checkdrive://trigger\n\n' +
      'Both fields are required — the Action MUST be android.intent.action.VIEW and the ' +
      'Data is the checkdrive:// link. Together they form the VIEW intent Android routes ' +
      'straight to CheckDrive. Picking Broadcast instead of Activity would send it into ' +
      'Android\'s broadcast system (where the Firebase receivers live) and would NOT open ' +
      'the app.',
  },
  {
    n: '4',
    title: 'Save and enable the rule',
    detail:
      'Save the rule and make sure its toggle is on in "My Rules".',
  },
];

const ANDROID_AUTOMATEIT_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'New rule → Trigger: Bluetooth Device Disconnected → your car',
    detail:
      'Create a second rule with the "Bluetooth Device Disconnected" trigger, and pick ' +
      'the same car device.',
  },
  {
    n: '2',
    title: 'Action: Launch Intent → Activity → Advanced → Action + Data',
    detail:
      'Same action as the connect rule — "Launch Intent", component type Activity (not ' +
      'Broadcast), Advanced → Action = android.intent.action.VIEW — but set Data to:  ' +
      'checkdrive://disconnect',
  },
  {
    n: '3',
    title: 'Save and enable',
    detail:
      'Save it and confirm both rules are enabled in "My Rules".',
  },
];

// Quieter variant — same rules, but the action is "Notification" instead of
// "Launch Intent". The notification's launch settings are filled in identically
// (Activity / Action = VIEW / Data = checkdrive://…), so tapping it opens
// CheckDrive while nothing pops up on its own.
const ANDROID_AUTOMATEIT_NOTIFY_STEPS = [
  {
    n: '1',
    title: 'Build the rules as above, but pick "Notification"',
    detail:
      'Prefer a notification over the app opening? Create the same two rules (Bluetooth ' +
      'connected / disconnected → your car), but for the action choose "Notification" ' +
      'instead of "Launch Intent".',
  },
  {
    n: '2',
    title: 'Fill in the launch settings the same way',
    detail:
      'Configure the Notification action exactly like the intent one:\n' +
      '  • component type Activity (NOT Broadcast)\n' +
      '  • Advanced → Action = android.intent.action.VIEW\n' +
      '  • Advanced → Data = checkdrive://trigger  (or checkdrive://disconnect)',
  },
  {
    n: '3',
    title: 'Result: nothing opens until you tap',
    detail:
      'On connect/disconnect you now get a notification instead of the app launching. ' +
      'CheckDrive opens only when you tap it — so it won\'t interrupt your maps or music.',
  },
];

// ── Tasker (paid, joaomgcd) — SHELVED ────────────────────────────────────────
// Removed from the UI to keep the screen focused on AutomateIt. The universal
// intent recipe (which is identical to Tasker's Send Intent) is summarized in
// the "Prefer a different automation app?" dropdown. Kept here for reference.
// TO RE-ACTIVATE: uncomment this block and add matching <Collapsible>s in the
// render section (search "SHELVED").
/*
const ANDROID_TASKER_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Install Tasker by joaomgcd from Google Play (~$3.50)',
    detail:
      'Search "Tasker" — the real one is published by joaomgcd (icon is a stylized ' +
      'square/gear). If you don\'t see Net under Event in step 2, open Tasker → ' +
      'Preferences and turn off "Beginner Mode".',
  },
  {
    n: '2',
    title: 'New Profile → Event → Net → BT Connected',
    detail:
      'On the Profiles tab, tap + → Event → Net → BT Connected. Tap the Device field ' +
      'and choose your car\'s Bluetooth name from the dropdown (leave blank only if you ' +
      'want it to fire for any Bluetooth connection). Tap back.',
  },
  {
    n: '3',
    title: 'Linked Task → System → Send Intent',
    detail:
      'Tasker prompts for a task — tap "New Task +" and name it "CheckDrive Connect". ' +
      'Tap + to add an action → System → Send Intent. Fill in only:\n' +
      '  Action: android.intent.action.VIEW\n' +
      '  Data:   checkdrive://trigger\n' +
      '  Target: Activity\n\n' +
      'Leave Cat, MIME Type, Extras, Package, Class, Flags all blank.',
  },
  {
    n: '4',
    title: 'Save and arm the profile',
    detail:
      'Tap back arrows until you\'re on the Profiles list. The toggle next to your ' +
      'profile should be on — it\'s now armed.',
  },
];

const ANDROID_TASKER_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'New Profile → Event → Net → BT Disconnected',
    detail:
      'Same as the connect profile, but choose "BT Disconnected" as the event. Pick the ' +
      'same car device.',
  },
  {
    n: '2',
    title: 'New Task → Send Intent with the disconnect URL',
    detail:
      'New Task + → name it "CheckDrive Disconnect" → + → System → Send Intent:\n' +
      '  Action: android.intent.action.VIEW\n' +
      '  Data:   checkdrive://disconnect\n' +
      '  Target: Activity',
  },
  {
    n: '3',
    title: 'Save',
    detail:
      'Tap back to the Profiles list. Both profiles should now be armed.',
  },
];
*/

// ── Bixby Routines (Samsung only, built-in) — SHELVED ────────────────────────
// Commented out until it can be tested on a Samsung device. Bixby's URL-launch
// support varies by One UI version/region, and there's currently no Samsung
// phone available to verify the "Open URL" action accepts custom schemes.
// TO RE-ACTIVATE: uncomment this block, then uncomment the matching Bixby
// <Collapsible> in the Android render section below (search "SHELVED").
/*
const ANDROID_BIXBY_CONNECT_STEPS = [
  {
    n: '1',
    title: 'Open Modes and Routines (or Bixby Routines)',
    detail:
      'On your Samsung phone open Settings → search for "Modes and Routines" (newer One UI) ' +
      'or "Bixby Routines" (older). Tap the Routines tab → + to add a new routine.',
  },
  {
    n: '2',
    title: 'If: Bluetooth device → Connected to specific device → your car',
    detail:
      'Tap "If" → + → Connectivity → Bluetooth device → Connected to specific device → ' +
      'pick your car from the list. Tap Done.',
  },
  {
    n: '3',
    title: 'Then: Open URL → checkdrive://trigger',
    detail:
      'Tap "Then" → +Add action → search for "Open URL" or "Open a webpage". Enter:\n' +
      '  checkdrive://trigger\n\n' +
      'Caveat: some One UI versions only accept http:// or https:// in this field. ' +
      'If your phone rejects the custom scheme, Bixby Routines won\'t work for ' +
      'CheckDrive — use AutomateIt or Automate instead.',
  },
  {
    n: '4',
    title: 'Save the routine',
    detail:
      'Name it "CheckDrive: car connect" and save. It runs immediately and silently — ' +
      'no extra battery or overlay permissions required since it\'s a system feature.',
  },
];

const ANDROID_BIXBY_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'Add a second routine — Disconnected from specific device',
    detail:
      'Routines tab → + → "If" → Connectivity → Bluetooth device → Disconnected from ' +
      'specific device → pick your car.',
  },
  {
    n: '2',
    title: 'Then: Open URL → checkdrive://disconnect',
    detail:
      'Same Open URL action as the connect routine, but with URL:\n' +
      '  checkdrive://disconnect',
  },
  {
    n: '3',
    title: 'Save as "CheckDrive: car disconnect"',
    detail:
      'Both routines should now appear in your Routines list.',
  },
];
*/

// ── Collapsible note ──────────────────────────────────────────────────────────
// Small inline component used to tuck long explanations behind a tap-to-expand
// header, so the screen isn't a wall of text by default. Collapsed by default
// to minimize visual noise; the user can open whichever one is relevant. Local
// `expanded` state keeps each note independent.
function Collapsible({
  title,
  defaultExpanded = false,
  children,
}: {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={s.collapsibleCard}>
      <TouchableOpacity
        style={s.collapsibleHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <Ionicons name="information-circle" size={16} color={theme.colors.primaryDeep} />
        <Text style={s.collapsibleTitle}>{title}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.primaryDeep}
        />
      </TouchableOpacity>
      {/* Body is rendered conditionally — the un-rendered state takes zero
          vertical space, so the collapsed card is just the title row. */}
      {expanded && <View style={s.collapsibleBody}>{children}</View>}
    </View>
  );
}

// Numbered step list — extracted because we render six of these on the Android
// tab (three tools × connect/disconnect) plus two on iOS. Inlining the JSX in
// every spot would triple the size of the render function for no benefit.
type Step = { n: string; title: string; detail: string };
function StepList({ steps }: { steps: Step[] }) {
  return (
    <View style={s.card}>
      {steps.map((step, idx) => (
        <View
          key={step.n}
          style={[s.stepRow, idx < steps.length - 1 && s.stepRowBorder]}
        >
          <View style={s.stepNum}>
            <Text style={s.stepNumText}>{step.n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.stepTitle}>{step.title}</Text>
            <Text style={s.stepDetail}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function CarDetectionSetupScreen() {
  const navigation = useNavigation();

  // Union type `'ios' | 'android'` constrains the tab state to exactly those
  // two strings — TypeScript will error if anything else is assigned.
  // Default to the current platform so the right instructions show first.
  const [tab, setTab] = useState<'ios' | 'android'>(
    Platform.OS === 'android' ? 'android' : 'ios'
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Topbar */}
        <View style={s.topbar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <Text style={s.title}>Car Detection Setup</Text>
        </View>

        {/* Explanation card — answers "why can't the app do this automatically?" */}
        <View style={s.card}>
          <Text style={s.infoTitle}>Why can't the app detect my car automatically?</Text>
          <Text style={s.infoText}>
            Apple restricts CarPlay SDK access to approved app categories (navigation, audio,
            etc.). Android Auto has similar restrictions for background apps. The safest
            cross-platform solution is to wire up a one-time automation using your OS's built-in
            tools — it takes about 5 minutes and works reliably.
          </Text>
        </View>

        {/* Platform tabs — same segmented-control pattern used in ChecklistRunScreen */}
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'ios' && s.tabActive]}
            onPress={() => setTab('ios')}
          >
            <Ionicons
              name="logo-apple"
              size={14}
              color={tab === 'ios' ? theme.colors.textPrimary : theme.colors.textSecondary}
            />
            <Text style={[s.tabText, tab === 'ios' && s.tabTextActive]}>iOS (Shortcuts)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'android' && s.tabActive]}
            onPress={() => setTab('android')}
          >
            <Ionicons
              name="logo-android"
              size={14}
              color={tab === 'android' ? theme.colors.textPrimary : theme.colors.textSecondary}
            />
            <Text style={[s.tabText, tab === 'android' && s.tabTextActive]}>
              Android
            </Text>
          </TouchableOpacity>
        </View>

        {/* ──────────────────────────────────────────────────────────────────
            iOS tab — single tool (Shortcuts), connect/disconnect as sections
            ────────────────────────────────────────────────────────────── */}
        {tab === 'ios' && (
          <>
            <Text style={s.sectionLabel}>Connect automation</Text>

            <Collapsible title="Why two shortcuts?">
              <Text style={s.noteText}>
                On iOS 17+ / 18, CarPlay automations don't show "Open URLs" directly. Steps 1–4
                create a standalone shortcut; steps 5–7 wire it to CarPlay. This works on all
                recent iOS versions.
              </Text>
            </Collapsible>

            <StepList steps={IOS_CONNECT_STEPS} />

            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Connect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://trigger</Text>
              </View>
              <Text style={s.urlHint}>Long-press to copy · Paste this into the URL action</Text>
            </View>

            <Text style={s.sectionLabel}>Disconnect automation</Text>

            <View style={s.noteCard}>
              <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
              <Text style={s.noteText}>
                Same two-shortcut approach as above, but with "Is Disconnected" as the trigger
                and checkdrive://disconnect as the URL. Without this, the arrival reminder
                notification won't fire automatically when you unplug CarPlay.
              </Text>
            </View>

            <StepList steps={IOS_DISCONNECT_STEPS} />

            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Disconnect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://disconnect</Text>
              </View>
              <Text style={s.urlHint}>Long-press to copy · Paste this into the URL action</Text>
            </View>

            {/* iOS notification options + the deep-link-opens-app reality,
                parallel to the Android "Will this pop the app open?" note. */}
            <Text style={s.sectionLabel}>Notification options</Text>

            <Collapsible title="Will this open the app every time?">
              <Text style={s.noteText}>
                With the "Open URLs" method above, yes — opening the app is exactly what a
                deep link does on iOS, just like on Android.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>By default it just notifies once open </Text>
                — it won't drop you into a checklist. To open the app directly instead, turn
                on "Open app on connect" in Settings: Pro opens your default checklist, free
                opens the home screen.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Want a banner without the app opening? </Text>
                Use the "Quieter" steps below — but note iOS has a real limitation here that
                Android doesn't (the notification's tap can't open CheckDrive).
              </Text>
            </Collapsible>

            <Collapsible title="Quieter: notification instead of opening">
              <Text style={s.noteText}>
                A Shortcut whose only action is "Show Notification" posts a banner without
                opening CheckDrive. The catch: iOS won't let that banner deep-link, so
                tapping it opens Shortcuts — it's a passive reminder, not a one-tap into your
                checklist. (For a tappable notification, use the "Open URLs" method above and
                leave "Open app on connect" off — CheckDrive opens briefly and posts its own
                tappable notification.)
              </Text>
              <StepList steps={IOS_NOTIFY_STEPS} />
            </Collapsible>
          </>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            Android tab — three tools, each in its own dropdown. Common pieces
            (intro, warning, copyable URLs, permissions) are pulled to the top
            so the user sees them without having to open every dropdown.
            ────────────────────────────────────────────────────────────── */}
        {tab === 'android' && (
          <>
            <Collapsible title="Do I need to install anything?">
              <Text style={s.noteText}>
                <Text style={{ fontWeight: '600' }}>You don't have to do any of this. </Text>
                CheckDrive works fine without automation — just open the app yourself when you
                get in the car. The steps below are only for hands-free auto-launch.{'\n\n'}
                We document one app in detail: <Text style={{ fontWeight: '600' }}>AutomateIt
                by SmarterApps </Text>(free). It has simple, separate "Bluetooth
                connected/disconnected" triggers, so it's the easiest to follow.{'\n\n'}
                Other automation apps (Tasker, Automate by LlamaLab, MacroDroid, etc.) work
                too — the intent recipe is the same in all of them — but you'll set those up
                yourself. See "Prefer a different automation app?" below for the recipe.{'\n\n'}
                Why can't the app do this on its own? Android Auto and Bluetooth-event detection
                require native Java/Kotlin code that's not available in the current build. These
                tools act as a permitted intermediary — they listen for the car's Bluetooth
                connection and fire a deep-link URL that opens CheckDrive.
              </Text>
            </Collapsible>

            <View style={s.warnCard}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.warning} />
              <Text style={s.warnText}>
                <Text style={{ fontWeight: '600' }}>Standalone build required. </Text>
                This only works with the app installed from Google Play or an EAS Build —
                not through Expo Go.
              </Text>
            </View>

            {/* Copyable URLs — the two deep links every automation app fires. */}
            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Connect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://trigger</Text>
              </View>
              <Text style={s.urlHint}>Long-press to copy</Text>
            </View>

            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Disconnect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://disconnect</Text>
              </View>
              <Text style={s.urlHint}>Long-press to copy</Text>
            </View>

            {/* Sets expectations: firing the deep link opens the app — that's
                inherent to VIEW intents. Explains the in-app toggle and points
                to the AutomateIt "Notification" variant for those who want it
                quiet. */}
            <Collapsible title="Will this pop the app open every time?">
              <Text style={s.noteText}>
                Yes — by design. The checkdrive:// link is a deep link, and opening the
                app is exactly what a deep link does, so firing it directly always brings
                CheckDrive to the foreground.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>By default it just posts a notification </Text>
                once open — it won't drop you into a checklist. To open the app directly
                instead, turn on "Open app on connect" in Settings: Pro opens your default
                checklist, free opens the home screen.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Want it fully quiet (no app launch)? </Text>
                Use the "Quieter: notification instead of opening" steps in the AutomateIt
                section below — its Notification action shows an alert whose tap opens
                CheckDrive, so nothing launches until you tap.
              </Text>
            </Collapsible>

            <Text style={s.sectionLabel}>Set up the automation</Text>

            {/* Permissions live in their own collapsible — keeping them outside
                the tool dropdown avoids cluttering the steps. */}
            <Collapsible title="One-time permissions (installed apps)">
              <Text style={s.noteText}>{ANDROID_PERMISSIONS_STEP.detail}</Text>
            </Collapsible>

            {/* AutomateIt is the one documented tool — default-expanded. It has
                the simplest discrete connect/disconnect triggers and is the
                confirmed-working setup. Connect, disconnect, and the quieter
                notification variant are all sub-sections here. */}
            <Collapsible
              title="AutomateIt by SmarterApps — free (recommended)"
              defaultExpanded
            >
              <Text style={s.subSectionLabel}>Connect setup</Text>
              <StepList steps={ANDROID_AUTOMATEIT_CONNECT_STEPS} />
              <Text style={s.subSectionLabel}>Disconnect setup</Text>
              <StepList steps={ANDROID_AUTOMATEIT_DISCONNECT_STEPS} />
              <Text style={s.subSectionLabel}>Quieter: notification instead of opening</Text>
              <StepList steps={ANDROID_AUTOMATEIT_NOTIFY_STEPS} />
            </Collapsible>

            {/* Universal recipe for any other automation app — we don't document
                them step-by-step, but the intent fields are always the same. */}
            <Collapsible title="Prefer a different automation app?">
              <Text style={s.noteText}>
                Any app that can run an action when a specific Bluetooth device connects or
                disconnects will work — Tasker, Automate by LlamaLab, MacroDroid, and others.
                The menus differ, but the recipe is always the same:{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Trigger: </Text>your car's Bluetooth
                connects (make a second rule for disconnects).{'\n'}
                <Text style={{ fontWeight: '600' }}>Action: </Text>launch/start an Activity
                intent (NOT a broadcast) with:{'\n'}
                {'   '}Action: android.intent.action.VIEW{'\n'}
                {'   '}Data:   checkdrive://trigger{'\n'}
                {'   '}(use checkdrive://disconnect for the disconnect rule){'\n\n'}
                If the app has its own "show notification" action, point that notification's
                tap at the same intent for the quiet, no-auto-launch behavior. You'll need to
                find the equivalent menus in your chosen app yourself.
              </Text>
            </Collapsible>

            {/* Bixby Routines — SHELVED until testable on a Samsung device.
                Re-activate by uncommenting the ANDROID_BIXBY_* arrays above and
                this Collapsible:
            <Collapsible title="Bixby Routines — Samsung only, built-in">
              <Text style={s.subSectionLabel}>Connect setup</Text>
              <StepList steps={ANDROID_BIXBY_CONNECT_STEPS} />
              <Text style={s.subSectionLabel}>Disconnect setup</Text>
              <StepList steps={ANDROID_BIXBY_DISCONNECT_STEPS} />
            </Collapsible>
            */}
          </>
        )}

        {/* ── Test buttons ─────────────────────────────────────────────────── */}
        {/* These call the exported simulator functions directly rather than
            opening the URL scheme, because iOS won't route an app's own URL
            scheme back to itself when it's already running in the foreground. */}
        <View style={s.testBtnRow}>
          <TouchableOpacity style={s.testBtn} onPress={() => simulateVehicleConnect()}>
            <Ionicons name="flash" size={14} color={theme.colors.primary} />
            <Text style={[s.testBtnText, { color: theme.colors.primary }]}> Test connect</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.testBtn} onPress={() => simulateVehicleDisconnect()}>
            <Ionicons name="flash-off" size={14} color={theme.colors.textSecondary} />
            <Text style={s.testBtnText}> Test disconnect</Text>
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
    paddingVertical: 12,
    gap: 0,
  },
  infoTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 8 },
  infoText: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 19 },

  // Amber warning callout — Android prerequisites, shown once before connect steps
  warnCard: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 0.5,
    borderColor: '#D4A24C',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 13, color: theme.colors.warning, lineHeight: 18 },

  // Green info callout that appears above each section on the iOS tab
  noteCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: 13, color: theme.colors.primaryDeep, lineHeight: 18 },

  // Collapsible variant of noteCard: same color treatment, column layout so a
  // tappable header sits above an optional body. Default state is collapsed so
  // the screen reads as a tidy list of titles; users expand only what they need.
  collapsibleCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collapsibleTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primaryDeep,
  },
  // Padding only on top so the body sits a touch away from the header row.
  // `gap` spaces multi-element bodies (e.g. a tool dropdown that contains a
  // sub-label, step card, sub-label, step card stack).
  collapsibleBody: { marginTop: 10, gap: 10 },

  // Smaller, looser-tracked label used inside per-tool collapsibles to mark
  // the "Connect setup" / "Disconnect setup" sections inside the dropdown.
  // Distinct from `sectionLabel` (which is the top-level uppercase header)
  // so the visual hierarchy reads: SECTION → tool → connect/disconnect.
  subSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primaryDeep,
    marginTop: 2,
  },

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    gap: 5,
    borderRadius: theme.radius.sm,
  },
  tabActive: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
  tabTextActive: { color: theme.colors.textPrimary },

  stepRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  stepRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    // Prevent the number circle from shrinking when the detail text is long
    flexShrink: 0,
  },
  stepNumText: { fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark },
  stepTitle: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary, marginBottom: 3 },
  stepDetail: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },

  urlCard: {
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  urlLabel: { fontSize: 12, fontWeight: '500', color: theme.colors.textSecondary },
  urlRow: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  urlText: {
    // Use a monospace font appropriate for each platform.
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    color: theme.colors.primaryDark,
  },
  urlHint: { fontSize: 12, color: theme.colors.textTertiary },

  // Side-by-side test buttons at the bottom of the screen
  testBtnRow: { flexDirection: 'row', gap: 8 },
  testBtn: {
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
  testBtnText: { fontSize: 13, fontWeight: '500', color: theme.colors.textSecondary },
});
