// ─────────────────────────────────────────────────────────────────────────────
// screens/CarDetectionSetupScreen.tsx  -  One-time car-detection setup guide.
//
// This screen explains why the app can't auto-detect CarPlay / Android Auto
// (Apple and Google restrict SDK access to approved categories) and walks the
// user through a one-time automation setup for BOTH connect and disconnect.
//
// iOS - TWO-SHORTCUT METHOD (required for iOS 17+ / 18+)
// ─────────────────────────────────────────────────────────
// In recent iOS versions, CarPlay automations don't surface "Open URLs"
// directly in the suggested-action picker - you see only "Open App",
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
// "ASK FIRST" (Show Alert) - the recommended connect flow
// ────────────────────────────────────────────────────────
// A deep link (Open URLs) ALWAYS foregrounds the app - that can't be prevented
// from inside the app. But the shortcut can present an interactive prompt
// BEFORE the Open URLs action runs: insert a "Show Alert" action (Scripting,
// "Show Cancel Button" ON) as the first action. The automation still fires
// silently (Ask Before Running off), but iOS surfaces the alert as a tappable
// prompt - tapping OK runs Open URLs and opens the app, Cancel stops the
// shortcut and nothing opens. This gives the dismissible "notification-style"
// behavior people want while keeping a one-tap path into the checklist.
// (Confirmed working on-device with calshow://; checkdrive:// resolves the same
// way once installed as a standalone build.) Skipping the Show Alert action
// makes the app open instantly with no prompt - that's the user's choice.
//
// GEOFENCING ALTERNATIVE
// The same "Start CheckDrive" shortcut can be triggered by an Arrive/Leave
// location automation instead of CarPlay (for users without CarPlay). Caveat:
// a location automation fires for ONE specific place, so it can't follow a
// multi-stop trip that visits several different locations - CarPlay (or a
// manual start) is the better trigger for multi-stop checklists.
//
// iOS NOTIFICATION LIMITATION (vs Android)
// Unlike Android's AutomateIt "Notification" action, iOS Shortcuts' "Show
// Notification" action is fire-and-forget - you cannot attach a tap/deep-link
// to it, so its banner opens the Shortcuts app, not CheckDrive. The "Ask first"
// Show Alert flow above is the better way to get a dismissible prompt, because
// its OK button actually opens the app. The Show Notification path (see
// IOS_NOTIFY_STEPS) is kept only as a fully-passive fallback, documented with
// its tap caveat.
//
// ANDROID - BLUETOOTH TRIGGER + DEEP-LINK URL
// ────────────────────────────────────────────
// True Android Auto connection detection (androidx.car.app.connection.
// CarConnection content provider) requires native Kotlin code inside the app
// binary - it can't be set up by the user from outside. The practical
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
//   • AutomateIt by SmarterApps - free. Discrete "Bluetooth Connected" /
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
// our app for FCM (Firebase Cloud Messaging) and other system events - not
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
// `Linking.openURL('checkdrive://trigger')` does NOT work for testing on iOS -
// iOS won't route an app's own URL scheme back to itself when it's already open.
// Instead the buttons call `simulateVehicleConnect` / `simulateVehicleDisconnect`
// directly (exported from useCarDetection.ts), which run the same logic without
// going through the URL scheme.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
  Image,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

// Prebuilt iCloud Shortcut links - tapping one opens Shortcuts and adds the
// ready-made "Open URL checkdrive://…" shortcut, so users skip building it by
// hand (steps 1–5). The CarPlay automation still has to be wired manually
// (personal automations can't be shared via link).
const SHORTCUT_CONNECT_URL = 'https://www.icloud.com/shortcuts/7b126e4f25e44f7291e349dc47f9a93e';
const SHORTCUT_DISCONNECT_URL = 'https://www.icloud.com/shortcuts/9bc4c25822234379bb70daee3fda9484';
// Instant-open variants - these shortcuts open CheckDrive with no "Open CheckDrive?"
// prompt (vs the ask-first ones above). Offered as a secondary option per section.
const SHORTCUT_CONNECT_INSTANT_URL = 'https://www.icloud.com/shortcuts/690d3df5ee8d49c7ad8c7f8a3e9c03f6';
const SHORTCUT_DISCONNECT_INSTANT_URL = 'https://www.icloud.com/shortcuts/bb66da9d9ce747b1809a349b5b95ef5f';
// iOS setup screenshots - wired into the connect/disconnect step lists below.
const IMG_AUTOMATION_TAB = require('../../assets/setup-automation-tab.png');
const IMG_CARPLAY_TRIGGER = require('../../assets/setup-carplay-trigger.png');
const IMG_CARPLAY_WHEN = require('../../assets/setup-carplay-when.png');
const IMG_CONNECT_DONE = require('../../assets/setup-connect-done.png');
const IMG_DISCONNECT_DONE = require('../../assets/setup-disconnect-done.png');
import { simulateVehicleConnect, simulateVehicleDisconnect } from '../hooks/useCarDetection';
import * as CarBluetooth from '../../modules/car-bluetooth';
import type { CarDevice } from '../../modules/car-bluetooth';

// ── Step data ─────────────────────────────────────────────────────────────────

// iOS connect - the prebuilt "Start CheckDrive" shortcut is added in one tap via
// the iCloud link (button above the steps), so the only manual work left is
// wiring the CarPlay automation. (The old 1–5 "build the shortcut by hand" steps
// are gone - the share link replaces them.)
const IOS_CONNECT_STEPS: Step[] = [
  {
    n: '1',
    title: 'Add the ready-made "Enter car" shortcut',
    detail:
      'Tap the button below - it adds the shortcut in one tap, no building it by hand. iOS may ' +
      'show an "untrusted shortcut" review; that\'s normal, scroll down and tap "Add Shortcut".',
    action: { label: 'Add the "Enter car" shortcut', url: SHORTCUT_CONNECT_URL },
  },
  {
    n: '2',
    title: 'Open the Automation tab → "+" → New Automation',
    detail:
      'In Shortcuts, switch to the Automation tab (not Library), tap "+", then "New Automation".',
    image: IMG_AUTOMATION_TAB,
  },
  {
    n: '3',
    title: 'Choose "CarPlay" as the trigger',
    detail: 'Scroll the trigger list and pick CarPlay.',
    image: IMG_CARPLAY_TRIGGER,
  },
  {
    n: '4',
    title: 'Pick "Is Connected" and "Run Immediately"',
    detail:
      'Select "Is Connected", then choose "Run Immediately" so it fires silently - that\'s the ' +
      'newer iOS replacement for the old "Ask Before Running" toggle. Leave "Notify When Run" ' +
      'off and tap Next.',
    image: IMG_CARPLAY_WHEN,
  },
  {
    n: '5',
    title: 'Add Action → "Run Shortcut" → your CheckDrive shortcut → Done',
    detail:
      'Add a "Run Shortcut" action and pick the shortcut you added (e.g. "Open CheckDrive on ' +
      'CarPlay connect"). Tap Done - it now runs every time CarPlay connects.',
    image: IMG_CONNECT_DONE,
  },
];

// iOS disconnect - same shape: add the prebuilt exit shortcut via the link, then
// wire the "Is Disconnected" automation.
const IOS_DISCONNECT_STEPS: Step[] = [
  {
    n: '1',
    title: 'Add the ready-made "Exit car" shortcut',
    detail:
      'Tap the button below to add the disconnect shortcut. Same "Add Shortcut" review as before.',
    action: { label: 'Add the "Exit car" shortcut', url: SHORTCUT_DISCONNECT_URL },
  },
  {
    n: '2',
    title: 'New Automation → CarPlay → "Is Disconnected"',
    detail:
      'Same as the connect automation (Automation tab → "+" → New Automation → CarPlay), but ' +
      'pick "Is Disconnected", set "Run Immediately", and leave "Notify When Run" off.',
  },
  {
    n: '3',
    title: 'Add Action → "Run Shortcut" → your exit shortcut → Done',
    detail:
      'Add "Run Shortcut" and pick your exit shortcut (e.g. "Open CheckDrive on CarPlay ' +
      'disconnect"). CheckDrive now posts your arrival / back-seat reminder whenever CarPlay ' +
      'disconnects.',
    image: IMG_DISCONNECT_DONE,
  },
];

// iOS "quieter" variant - a Shortcut whose only action is "Show Notification".
// IMPORTANT iOS LIMITATION: Shortcuts' Show Notification action is fire-and-
// forget - you CANNOT attach a tap/deep-link action to it, so tapping the
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
      'iOS can\'t deep-link a Show Notification on tap, so tapping it opens the Shortcuts ' +
      'app - it\'s a passive reminder. For a tap that opens your checklist, use the "Open ' +
      'URLs" method above instead.',
  },
];

// One-time Android permissions step - shared by Automate and Tasker, NOT
// needed for Bixby Routines (Bixby is a system app and isn't subject to the
// same battery / overlay restrictions). Shown once at the top of the Android
// section rather than duplicated inside every tool's dropdown.
const ANDROID_PERMISSIONS_STEP = {
  title: 'Grant permissions to your automation app (one-time)',
  detail:
    'Not needed for Bixby Routines (system app). For any installed app (e.g. ' +
    'AutomateIt), without these the trigger silently fails when the screen is off:\n\n' +
    '① Draw over other apps - Settings → Apps → [app] → Advanced → Display over ' +
    'other apps → Allow.\n\n' +
    '② Unrestricted battery - Settings → Apps → [app] → Battery → Unrestricted.\n\n' +
    'Manufacturer extras: Samsung - also enable Auto-start. Xiaomi - Security → ' +
    'Autostart. OnePlus - check Battery Optimization.',
};

// ── Automate by LlamaLab (free) - SHELVED ────────────────────────────────────
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
    title: 'Add the detector - "Bluetooth connected?" set to "When changed"',
    detail:
      'Tap + → Bluetooth → "Bluetooth connected?" - this is the "check if connected" ' +
      'block you found, the one with Yes/No outputs. Open it and set:\n' +
      '  Device:  tap the field → Pick device → your car\n' +
      '  Trigger: When changed   (NOT "Immediately")\n\n' +
      'Heads-up: the "Bluetooth connect" and "Bluetooth disconnect" blocks you also saw ' +
      'are ACTIONS that make your phone connect/disconnect - they don\'t detect the car, ' +
      'so ignore them. "Bluetooth connected?" with "When changed" is the detector: it ' +
      'fires every time the car connects OR disconnects.',
  },
  {
    n: '3',
    title: 'Add the connect launcher - "App start", NOT "App broadcast send"',
    detail:
      'Automate has no plain "URL" block (that\'s why you only found "App broadcast"). ' +
      'Tap + → Apps → "App start" - this launches an app by intent. Set:\n' +
      '  Action:   android.intent.action.VIEW\n' +
      '  Data URI: checkdrive://trigger\n' +
      'Leave Package / Class blank so Android resolves it to CheckDrive by the scheme.\n\n' +
      'Do NOT use "App broadcast send" - it routes through Android\'s broadcast system ' +
      '(where CheckDrive\'s Firebase receivers live) and will NOT open the app.',
  },
  {
    n: '4',
    title: 'Add the disconnect launcher - a second "App start"',
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
      'disconnect link when it drops - no second flow needed.\n\n' +
      'If "App start" is hard to configure, AutomateIt (above) is the simpler route.',
  },
];
*/

// ── AutomateIt by SmarterApps (free) - the one documented tool ───────────────
// Rule-based (Trigger + Action) with discrete "Bluetooth Connected" /
// "Bluetooth Disconnected" triggers. CONFIRMED WORKING (per testing):
//   Action = "Launch Intent", component type = Activity (NOT Broadcast),
//   Advanced → Action = android.intent.action.VIEW, Data = checkdrive://…
// BOTH Advanced fields are required - leaving Action blank won't resolve the
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
      'Choose the "Launch Intent" action, then:\n' +
      '  • Component type: Activity (NOT Broadcast)\n' +
      '  • Tap "Advanced"\n' +
      '  • Action:  android.intent.action.VIEW\n' +
      '  • Data:  checkdrive://trigger\n\n' +
      'Both Advanced fields are required.'
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
      'Same action as the connect rule - "Launch Intent", component type Activity (not ' +
      'Broadcast), Advanced → Action = android.intent.action.VIEW - but set Data to:  ' +
      'checkdrive://disconnect',
  },
  {
    n: '3',
    title: 'Save and enable',
    detail:
      'Save it and confirm both rules are enabled in "My Rules".',
  },
];

// Quieter variant - same rules, but the action is "Notification" instead of
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
      'CheckDrive opens only when you tap it - so it won\'t interrupt your maps or music.',
  },
];

// ── Tasker (paid, joaomgcd) - SHELVED ────────────────────────────────────────
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
      'Search "Tasker" - the real one is published by joaomgcd (icon is a stylized ' +
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
      'Tasker prompts for a task - tap "New Task +" and name it "CheckDrive Connect". ' +
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
      'profile should be on - it\'s now armed.',
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

// ── Bixby Routines (Samsung only, built-in) - SHELVED ────────────────────────
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
      'CheckDrive - use AutomateIt or Automate instead.',
  },
  {
    n: '4',
    title: 'Save the routine',
    detail:
      'Name it "CheckDrive: car connect" and save. It runs immediately and silently - ' +
      'no extra battery or overlay permissions required since it\'s a system feature.',
  },
];

const ANDROID_BIXBY_DISCONNECT_STEPS = [
  {
    n: '1',
    title: 'Add a second routine - Disconnected from specific device',
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
      {/* Body is rendered conditionally - the un-rendered state takes zero
          vertical space, so the collapsed card is just the title row. */}
      {expanded && <View style={s.collapsibleBody}>{children}</View>}
    </View>
  );
}

// Numbered step list - extracted because we render six of these on the Android
// tab (three tools × connect/disconnect) plus two on iOS. Inlining the JSX in
// every spot would triple the size of the render function for no benefit.
type Step = {
  n: string;
  title: string;
  detail: string;
  image?: ImageSourcePropType;
  // Optional tappable button rendered under the detail (e.g. "Add the shortcut")
  // so the step is actionable in place - in both the list and slideshow views.
  action?: { label: string; url: string };
};

// Optional screenshot under a step. Sized in explicit POINTS, not "100%": a
// percentage width didn't reliably constrain these large (~960px) PNGs - the
// image kept its intrinsic width and ran off-screen. boxW = screen width minus
// the scroll (16*2) and card (16*2) padding and the step-number column (24 +
// 12 gap). Height is derived from the asset's own ratio so it never distorts.
function StepImage({ source }: { source: ImageSourcePropType }) {
  const { width: screenW } = useWindowDimensions();
  const meta = Image.resolveAssetSource(source);
  const boxW = Math.max(0, screenW - 100);
  const ratio = meta && meta.width ? meta.height / meta.width : 1;
  return (
    <Image
      source={source}
      style={[s.stepImage, { width: boxW, height: Math.round(boxW * ratio) }]}
      resizeMode="contain"
    />
  );
}

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
          {/* minWidth:0 lets this flex column shrink below its content's
              intrinsic size - without it, a wide screenshot (≈960px) sets an
              auto min-width floor and pushes the row off-screen. */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.stepTitle}>{step.title}</Text>
            <Text style={s.stepDetail}>{step.detail}</Text>
            {step.action && (
              <TouchableOpacity
                style={s.stepActionBtn}
                onPress={() => Linking.openURL(step.action!.url)}
              >
                <Ionicons name="add-circle-outline" size={15} color="#fff" />
                <Text style={s.stepActionBtnText}>  {step.action.label}</Text>
              </TouchableOpacity>
            )}
            {step.image && <StepImage source={step.image} />}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Step slideshow ────────────────────────────────────────────────────────────
// Full-screen "walk me through it" mode: one step per swipeable slide, big
// screenshot, giant Next button. Same paging-ScrollView pattern as Onboarding -
// no carousel dependency. This is the dumbed-down path for people who bounce
// off the written list.
function StepSlideshow({
  title,
  steps,
  visible,
  onClose,
}: {
  title: string;
  steps: Step[];
  visible: boolean;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === steps.length - 1;
  // Cap the screenshot so title + detail + buttons always fit under it.
  const imgW = width - 48;
  const imgMaxH = Math.round(height * 0.42);

  // Reset to slide 1 every time the slideshow opens.
  useEffect(() => {
    if (visible) {
      setPage(0);
      // Modal content mounts after `visible` flips, so defer the scroll a tick.
      setTimeout(() => scrollRef.current?.scrollTo({ x: 0, animated: false }), 0);
    }
  }, [visible]);

  function go(delta: number) {
    const next = page + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      onClose();
      return;
    }
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.slideshowSafe}>
        {/* Header: title + step counter + close */}
        <View style={s.slideshowTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.slideshowTitle}>{title}</Text>
            <Text style={s.slideshowCounter}>
              Step {page + 1} of {steps.length}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={26} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / width);
            if (p !== page) setPage(p);
          }}
        >
          {steps.map((step) => {
            const meta = step.image ? Image.resolveAssetSource(step.image) : null;
            const ratio = meta && meta.width ? meta.height / meta.width : 1;
            const h = Math.min(Math.round(imgW * ratio), imgMaxH);
            return (
              <ScrollView
                key={step.n}
                style={{ width }}
                contentContainerStyle={s.slideshowSlide}
                showsVerticalScrollIndicator={false}
              >
                <Text style={s.slideshowStepTitle}>{step.title}</Text>
                {step.image && (
                  <Image
                    source={step.image}
                    style={[s.slideshowImage, { width: imgW, height: h }]}
                    resizeMode="contain"
                  />
                )}
                <Text style={s.slideshowDetail}>{step.detail}</Text>
                {step.action && (
                  <TouchableOpacity
                    style={[s.nativeBtn, { alignSelf: 'stretch' }]}
                    onPress={() => Linking.openURL(step.action!.url)}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#fff" />
                    <Text style={s.nativeBtnText}>  {step.action.label}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            );
          })}
        </ScrollView>

        {/* Page dots */}
        <View style={s.slideshowDots}>
          {steps.map((_, i) => (
            <View key={i} style={[s.slideshowDot, i === page && s.slideshowDotActive]} />
          ))}
        </View>

        {/* Back / Next */}
        <View style={s.slideshowActions}>
          {page > 0 ? (
            <TouchableOpacity style={s.slideshowBackBtn} onPress={() => go(-1)}>
              <Text style={s.slideshowBackText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <TouchableOpacity style={s.slideshowNextBtn} onPress={() => go(1)}>
            <Text style={s.slideshowNextText}>{last ? 'Done' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Native car detection (Android, beta) ─────────────────────────────────────
// The recommended Android path: CheckDrive watches the car's Bluetooth itself via
// CompanionDeviceManager, so no third-party automation app is needed. The user
// picks their car once from the system dialog; the native module persists it and
// fires connect/disconnect from then on. Renders a graceful "unavailable" note on
// devices without CDM support (below Android 12), and nothing at all while the
// support probe is in flight. On iOS this whole screen shows the Shortcuts tab,
// so this component only ever mounts on the Android tab.
function NativeDetectSection() {
  const [supported, setSupported] = useState<boolean | null>(null);
  // Multiple cars can be watched at once, so this is a list (not a single car).
  const [cars, setCars] = useState<CarDevice[]>([]);
  const [busy, setBusy] = useState(false);
  // Paired-device picker: the bonded devices, whether the sheet is open, and
  // which rows are checked (multi-select — you can add several cars at once).
  const [bonded, setBonded] = useState<CarDevice[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Probe support + load any previously-linked cars on mount. `alive` guards
  // against setting state after unmount (the async calls can outlive the screen).
  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await CarBluetooth.isSupported();
      if (!alive) return;
      setSupported(ok);
      if (ok) {
        const t = await CarBluetooth.getTargets();
        if (alive) setCars(t);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // BLUETOOTH_CONNECT is needed to receive ACL connect/disconnect broadcasts;
  // POST_NOTIFICATIONS (API 33+) lets the fallback notification show.
  async function ensurePermissions(): Promise<boolean> {
    try {
      const perms: string[] = [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT];
      if (typeof Platform.Version === 'number' && Platform.Version >= 33) {
        perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      const res = await PermissionsAndroid.requestMultiple(perms as any);
      return perms.every(
        (p) => res[p as keyof typeof res] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  }

  async function handlePick() {
    setBusy(true);
    try {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'CheckDrive needs the Nearby devices / Bluetooth permission to detect your car. ' +
            'Enable it in Settings → Apps → CheckDrive → Permissions, then try again.'
        );
        return;
      }
      const picked = await CarBluetooth.associateCar();
      setCars(await CarBluetooth.getTargets());
      Alert.alert(
        'Car added',
        `CheckDrive will now watch "${picked.name ?? picked.address}". Connect to it to test - ` +
          'you should get a notification (or the app opens, per your settings).'
      );
    } catch (e: any) {
      // ERR_CANCELLED = the user backed out of the system picker; stay quiet.
      if (e?.code !== 'ERR_CANCELLED') {
        Alert.alert(
          'Couldn’t link the car',
          e?.message ?? 'Something went wrong opening the device picker.'
        );
      }
    } finally {
      setBusy(false);
    }
  }

  // Primary path: pick the car from the phone's already-paired devices. A car
  // used with Android Auto is always bonded, so it's guaranteed to be in this
  // list - unlike the CDM scan (handlePick), which won't show a paired,
  // non-discoverable car.
  async function handleChoosePaired() {
    setBusy(true);
    try {
      const granted = await ensurePermissions();
      if (!granted) {
        Alert.alert(
          'Permission needed',
          'CheckDrive needs the Nearby devices / Bluetooth permission to see your paired car. ' +
            'Enable it in Settings → Apps → CheckDrive → Permissions, then try again.'
        );
        return;
      }
      const devices = await CarBluetooth.getBondedDevices();
      if (devices.length === 0) {
        Alert.alert(
          'No paired devices',
          'Pair your phone with your car’s Bluetooth first (in your phone’s Bluetooth settings), ' +
            'then come back and choose it here.'
        );
        return;
      }
      setBonded(devices);
      setSelected(new Set());
      setPickerVisible(true);
    } finally {
      setBusy(false);
    }
  }

  // Toggle a device's checkbox in the multi-select picker.
  function toggleSelected(address: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      return next;
    });
  }

  // Save every checked paired device as a watched car. Detection runs off these
  // saved addresses via the manifest ACL receiver - no CDM association needed.
  async function applySelection() {
    setPickerVisible(false);
    for (const addr of selected) {
      const d = bonded.find((b) => b.address === addr);
      if (d) await CarBluetooth.addCar(d.address, d.name);
    }
    setSelected(new Set());
    setCars(await CarBluetooth.getTargets());
  }

  function handleForget(target: CarDevice) {
    Alert.alert('Forget this car?', `Stop watching "${target.name ?? target.address}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Forget',
        style: 'destructive',
        onPress: async () => {
          await CarBluetooth.forgetCar(target.address);
          setCars(await CarBluetooth.getTargets());
        },
      },
    ]);
  }

  // Still probing - render nothing to avoid a flash of the wrong state.
  if (supported === null) return null;

  if (!supported) {
    return (
      <View style={s.nativeCard}>
        <Text style={s.infoTitle}>Native detection unavailable</Text>
        <Text style={s.infoText}>
          This device doesn’t support the system companion-device picker (it needs Android 12 or
          newer). Use the manual automation steps below instead.
        </Text>
      </View>
    );
  }

  // Cars already watched are managed in the list, not the add-sheet.
  const availableToAdd = bonded.filter((d) => !cars.some((c) => c.address === d.address));

  return (
    <View style={s.nativeCard}>
      <View style={s.nativeBadgeRow}>
        <Ionicons name="sparkles" size={13} color={theme.colors.primaryDeep} />
        <Text style={s.nativeBadge}>Easiest · no extra app</Text>
      </View>
      <Text style={s.infoTitle}>Let CheckDrive watch your car’s Bluetooth</Text>
      <Text style={s.infoText}>
        Pick your car - or several - once from your paired Bluetooth devices and CheckDrive detects
        them directly, no AutomateIt or Shortcuts needed. On connect you’ll get a “tap to run your
        checklist” notification (Pro can auto-open the default list instead, via Settings).
      </Text>

      {cars.length > 0 ? (
        <>
          {cars.map((c) => (
            <View key={c.address} style={s.carRow}>
              <Ionicons name="bluetooth" size={16} color={theme.colors.primaryDeep} />
              <View style={{ flex: 1 }}>
                <Text style={s.carName}>{c.name ?? 'Paired device'}</Text>
                <Text style={s.carAddr}>{c.address}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleForget(c)}
                disabled={busy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={theme.colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={s.nativeBtnRow}>
            <TouchableOpacity
              style={[s.nativeBtn, s.nativeBtnGhost]}
              onPress={handleChoosePaired}
              disabled={busy}
            >
              <Text style={s.nativeBtnGhostText}>Add another car</Text>
            </TouchableOpacity>
          </View>
          {/* Fallback for a car that isn't paired yet: the CDM discovery scan. */}
          <TouchableOpacity onPress={handlePick} disabled={busy} style={s.scanLink}>
            <Text style={s.scanLinkText}>Car not listed? Scan for a device</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity style={s.nativeBtn} onPress={handleChoosePaired} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="bluetooth" size={16} color="#fff" />
                <Text style={s.nativeBtnText}>  Choose from paired devices</Text>
              </>
            )}
          </TouchableOpacity>
          {/* Fallback for a car that isn't paired yet: the CDM discovery scan. */}
          <TouchableOpacity onPress={handlePick} disabled={busy} style={s.scanLink}>
            <Text style={s.scanLinkText}>Car not listed? Scan for a device</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Paired-device picker sheet. Check every car to watch, then Add. Cars
          already watched are managed in the list above, so they're hidden here. */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={s.pickerBackdrop} onPress={() => setPickerVisible(false)}>
          <Pressable style={s.pickerSheet} onPress={() => {}}>
            <Text style={s.pickerTitle}>Add your cars</Text>
            <Text style={s.pickerSub}>Check every Bluetooth device CheckDrive should watch.</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {availableToAdd.length === 0 ? (
                <Text style={[s.infoText, { paddingVertical: 12 }]}>
                  All your paired devices are already added.
                </Text>
              ) : (
                availableToAdd.map((d, idx) => {
                  const on = selected.has(d.address);
                  return (
                    <TouchableOpacity
                      key={d.address}
                      style={[s.pickerRow, idx < availableToAdd.length - 1 && s.pickerRowBorder]}
                      onPress={() => toggleSelected(d.address)}
                    >
                      <Ionicons
                        name={on ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={on ? theme.colors.primary : theme.colors.textTertiary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.pickerName}>{d.name ?? 'Unnamed device'}</Text>
                        <Text style={s.pickerAddr}>{d.address}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
            {availableToAdd.length > 0 && (
              <TouchableOpacity
                style={[s.nativeBtn, selected.size === 0 && { opacity: 0.5 }]}
                onPress={applySelection}
                disabled={selected.size === 0}
              >
                <Text style={s.nativeBtnText}>
                  {selected.size > 0
                    ? `Add ${selected.size} ${selected.size === 1 ? 'car' : 'cars'}`
                    : 'Select cars to add'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.pickerCancel} onPress={() => setPickerVisible(false)}>
              <Text style={s.pickerCancelText}>
                {availableToAdd.length === 0 ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function CarDetectionSetupScreen() {
  const navigation = useNavigation();
  // Which step slideshow is open (iOS walkthrough mode), if any.
  const [slideshow, setSlideshow] = useState<null | 'connect' | 'disconnect'>(null);

  // Show ONLY the current platform's instructions. We deliberately don't expose
  // the other platform's steps: an iPhone user can't set up Android detection on
  // their device, and surfacing "install from Google Play" / Android Auto inside
  // the iOS app is both useless UX and an App Store review risk (references to
  // another mobile platform). Each section below is gated on Platform.OS.
  const isIOS = Platform.OS === 'ios';

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

        {/* Explanation card - answers "why can't the app do this automatically?"
            Platform-specific so the iOS copy never references Android Auto. */}
        <View style={s.card}>
          <Text style={s.infoTitle}>Why can't the app detect my car automatically?</Text>
          <Text style={s.infoText}>
            {isIOS
              ? "Apple restricts CarPlay SDK access to approved app categories (navigation, " +
                "audio, etc.). The safest solution is to wire up a one-time Shortcuts " +
                "automation - it takes about 5 minutes and works reliably."
              : "Android restricts background access to car-connection events. The safest " +
                "option is to let CheckDrive watch your car's Bluetooth directly, or wire up a " +
                "one-time automation - it takes about 5 minutes and works reliably."}
          </Text>
        </View>

        {/* ──────────────────────────────────────────────────────────────────
            iOS - single tool (Shortcuts), connect/disconnect as sections.
            Only ever rendered on iOS devices.
            ────────────────────────────────────────────────────────────── */}
        {isIOS && (
          <>
            <Text style={s.sectionLabel}>Connect automation</Text>

            <TouchableOpacity
              style={s.nativeBtn}
              onPress={() => Linking.openURL(SHORTCUT_CONNECT_URL)}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={s.nativeBtnText}>  Add the "Enter car" shortcut</Text>
            </TouchableOpacity>
            <Text style={s.urlHint}>
              Fastest path - adds the ready-made shortcut in one tap (no building it by hand). iOS
              may show an "untrusted shortcut" review; that's normal, tap Add Shortcut. Then wire
              the automation in the steps below.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(SHORTCUT_CONNECT_INSTANT_URL)}
              style={s.scanLink}
            >
              <Text style={s.scanLinkText}>No prompt? Add the instant-open version</Text>
            </TouchableOpacity>

            <Collapsible title="Why a shortcut, and does it interrupt me?">
              <Text style={s.noteText}>
                iOS won't let a CarPlay automation open an app directly, so it runs a tiny shortcut
                that does. The ready-made "Enter car" shortcut shows a quick "Open CheckDrive?"
                prompt when you connect - tap OK to open, or dismiss it - so it never just barges
                in. (Want it to open instantly with no prompt? Use the instant-open version of the
                shortcut.)
              </Text>
            </Collapsible>

            <TouchableOpacity style={s.slideshowOpenBtn} onPress={() => setSlideshow('connect')}>
              <Ionicons name="play-circle-outline" size={18} color={theme.colors.primaryDeep} />
              <Text style={s.slideshowOpenText}>  Show me how, step by step</Text>
            </TouchableOpacity>

            <Collapsible title="Prefer written steps?">
              <StepList steps={IOS_CONNECT_STEPS} />
            </Collapsible>

            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Connect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://trigger</Text>
              </View>
              <Text style={s.urlHint}>The ready-made shortcut already uses this - shown for reference / troubleshooting.</Text>
            </View>

            <Text style={s.sectionLabel}>Disconnect automation</Text>

            <TouchableOpacity
              style={s.nativeBtn}
              onPress={() => Linking.openURL(SHORTCUT_DISCONNECT_URL)}
            >
              <Ionicons name="add-circle-outline" size={16} color="#fff" />
              <Text style={s.nativeBtnText}>  Add the "Exit car" shortcut</Text>
            </TouchableOpacity>
            <Text style={s.urlHint}>
              Adds the ready-made disconnect shortcut. Then wire it to the "Is Disconnected"
              automation, same as connect.
            </Text>
            <TouchableOpacity
              onPress={() => Linking.openURL(SHORTCUT_DISCONNECT_INSTANT_URL)}
              style={s.scanLink}
            >
              <Text style={s.scanLinkText}>No prompt? Add the instant-open version</Text>
            </TouchableOpacity>

            <View style={s.noteCard}>
              <Ionicons name="information-circle" size={16} color={theme.colors.primary} />
              <Text style={s.noteText}>
                Same as connect, but choose "Is Disconnected" as the trigger and run the
                "Stop CheckDrive" shortcut. Without it, the arrival / back-seat reminder won't fire
                automatically when you unplug.
              </Text>
            </View>

            <TouchableOpacity
              style={s.slideshowOpenBtn}
              onPress={() => setSlideshow('disconnect')}
            >
              <Ionicons name="play-circle-outline" size={18} color={theme.colors.primaryDeep} />
              <Text style={s.slideshowOpenText}>  Show me how, step by step</Text>
            </TouchableOpacity>

            <Collapsible title="Prefer written steps?">
              <StepList steps={IOS_DISCONNECT_STEPS} />
            </Collapsible>

            <View style={s.urlCard}>
              <Text style={s.urlLabel}>Disconnect URL</Text>
              <View style={s.urlRow}>
                <Text style={s.urlText} selectable>checkdrive://disconnect</Text>
              </View>
              <Text style={s.urlHint}>The ready-made shortcut already uses this - shown for reference / troubleshooting.</Text>
            </View>

            {/* iOS notification options + the deep-link-opens-app reality,
                parallel to the Android "Will this pop the app open?" note. */}
            <Text style={s.sectionLabel}>Notification options</Text>

            <Collapsible title="Will this open the app every time?">
              <Text style={s.noteText}>
                A deep link always opens the app on iOS - that part can't be changed - but the
                ready-made shortcut shows a quick "Open CheckDrive?" prompt first, so the app only
                opens when you tap OK. Tap Cancel and nothing launches.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Once it opens, it posts a "tap to run your
                checklist" notification </Text>that deep-links into your list. Pro users can turn on
                "Open my checklist on connect" in Settings to skip that and jump straight into their
                default list instead.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Want zero prompts (instant open)? </Text>
                Use the instant-open version of the shortcut instead of the ask-first one.
              </Text>
            </Collapsible>

            <Collapsible title="Trigger on a location instead of CarPlay (geofencing)">
              <Text style={s.noteText}>
                No CarPlay? You can run the same "Start CheckDrive" shortcut from a location
                automation. In the Automation tab, choose{' '}
                <Text style={{ fontWeight: '600' }}>Arrive </Text>or{' '}
                <Text style={{ fontWeight: '600' }}>Leave </Text>as the trigger, pick the place
                (e.g. Home or Work), then Run Shortcut → "Start CheckDrive" and turn off "Ask
                Before Running".{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Heads-up on multi-stop: </Text>a location
                automation only fires for the one place you picked, so it can't follow a
                multi-stop trip that visits several different addresses. CarPlay (or starting
                the checklist by hand) is the better trigger for multi-stop runs.
              </Text>
            </Collapsible>

            <Collapsible title="Fully passive: banner only, no app (limited)">
              <Text style={s.noteText}>
                <Text style={{ fontWeight: '600' }}>The ask-first shortcut above is the better
                way </Text>to get a dismissible prompt, because its OK button actually opens
                your checklist. This Show Notification path is only for a fully passive banner:
                it posts a reminder without opening CheckDrive, but iOS won't let that banner
                deep-link, so tapping it opens the Shortcuts app - not your checklist. Use it
                only if you truly want a no-tap reminder and don't mind that the tap goes
                nowhere useful.
              </Text>
              <StepList steps={IOS_NOTIFY_STEPS} />
            </Collapsible>
          </>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            Android - three tools, each in its own dropdown. Common pieces
            (intro, warning, copyable URLs, permissions) are pulled to the top
            so the user sees them without having to open every dropdown. Only
            ever rendered on Android devices (never exposed in the iOS app).
            ────────────────────────────────────────────────────────────── */}
        {!isIOS && (
          <>
            {/* Recommended path: native CDM detection, no third-party app.
                Renders itself conditionally based on device support. */}
            <NativeDetectSection />

            <Text style={s.sectionLabel}>Or set it up manually</Text>

            <Collapsible title="Do I need to install anything?">
              <Text style={s.noteText}>
                <Text style={{ fontWeight: '600' }}>You don't have to do any of this. </Text>
                CheckDrive works fine without automation - just open the app yourself when you
                get in the car. The steps below are only for hands-free auto-launch.{'\n\n'}
                We document one app in detail: <Text style={{ fontWeight: '600' }}>AutomateIt
                by SmarterApps </Text>(free). It has simple, separate "Bluetooth
                connected/disconnected" triggers, so it's the easiest to follow.{'\n\n'}
                Other automation apps (Tasker, Automate by LlamaLab, MacroDroid, etc.) work
                too - the intent recipe is the same in all of them - but you'll set those up
                yourself. See "Prefer a different automation app?" below for the recipe.{'\n\n'}
                Why can't the app do this on its own? Android Auto and Bluetooth-event detection
                require native Java/Kotlin code that's not available in the current build. These
                tools act as a permitted intermediary - they listen for the car's Bluetooth
                connection and fire a deep-link URL that opens CheckDrive.
              </Text>
            </Collapsible>

            {/* <View style={s.warnCard}>
              <Ionicons name="warning-outline" size={16} color={theme.colors.warning} />
              <Text style={s.warnText}>
                <Text style={{ fontWeight: '600' }}>Standalone build required. </Text>
                This only works with the app installed from Google Play or an EAS Build -
                not through Expo Go.
              </Text>
            </View> */}

            {/* Copyable URLs - the two deep links every automation app fires. */}
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

            {/* Sets expectations: firing the deep link opens the app - that's
                inherent to VIEW intents. Explains the in-app toggle and points
                to the AutomateIt "Notification" variant for those who want it
                quiet. */}
            <Collapsible title="Will this pop the app open every time?">
              <Text style={s.noteText}>
                Yes - by design. The checkdrive:// link is a deep link, and opening the
                app is exactly what a deep link does, so firing it directly always brings
                CheckDrive to the foreground.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Once open, it posts a "tap to run your
                checklist" notification </Text>that deep-links into your list. Pro users can turn
                on "Open my checklist on connect" in Settings to jump straight into their default
                list instead.{'\n\n'}
                <Text style={{ fontWeight: '600' }}>Want it fully quiet (no app launch)? </Text>
                Use the "Quieter: notification instead of opening" steps in the AutomateIt
                section below - its Notification action shows an alert whose tap opens
                CheckDrive, so nothing launches until you tap.
              </Text>
            </Collapsible>

            <Text style={s.sectionLabel}>Set up the automation</Text>

            {/* Permissions live in their own collapsible - keeping them outside
                the tool dropdown avoids cluttering the steps. */}
            <Collapsible title="One-time permissions (installed apps)">
              <Text style={s.noteText}>{ANDROID_PERMISSIONS_STEP.detail}</Text>
            </Collapsible>

            {/* AutomateIt is the one documented tool - default-expanded. It has
                the simplest discrete connect/disconnect triggers and is the
                confirmed-working setup. Connect, disconnect, and the quieter
                notification variant are all sub-sections here. */}
            <Collapsible
              title="AutomateIt by SmarterApps - free (recommended)"
              defaultExpanded
            >
              <Text style={s.subSectionLabel}>Connect setup</Text>
              <StepList steps={ANDROID_AUTOMATEIT_CONNECT_STEPS} />
              <Text style={s.subSectionLabel}>Disconnect setup</Text>
              <StepList steps={ANDROID_AUTOMATEIT_DISCONNECT_STEPS} />
              <Text style={s.subSectionLabel}>Quieter: notification instead of opening</Text>
              <StepList steps={ANDROID_AUTOMATEIT_NOTIFY_STEPS} />
            </Collapsible>

            {/* Universal recipe for any other automation app - we don't document
                them step-by-step, but the intent fields are always the same. */}
            <Collapsible title="Prefer a different automation app?">
              <Text style={s.noteText}>
                Any app that can run an action when a specific Bluetooth device connects or
                disconnects will work - Tasker, Automate by LlamaLab, MacroDroid, and others.
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

            {/* Bixby Routines - SHELVED until testable on a Samsung device.
                Re-activate by uncommenting the ANDROID_BIXBY_* arrays above and
                this Collapsible:
            <Collapsible title="Bixby Routines - Samsung only, built-in">
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

      {/* iOS walkthrough slideshows - mounted once, opened via the
          "Show me how" buttons in each section. */}
      {isIOS && (
        <>
          <StepSlideshow
            title="Connect automation"
            steps={IOS_CONNECT_STEPS}
            visible={slideshow === 'connect'}
            onClose={() => setSlideshow(null)}
          />
          <StepSlideshow
            title="Disconnect automation"
            steps={IOS_DISCONNECT_STEPS}
            visible={slideshow === 'disconnect'}
            onClose={() => setSlideshow(null)}
          />
        </>
      )}
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

  // Amber warning callout - Android prerequisites, shown once before connect steps
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

  // Native-detection card - the recommended Android path. Slightly stronger
  // border/tint than a plain card so it reads as the primary call to action.
  nativeCard: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  nativeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nativeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primaryDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nativeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  nativeBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  nativeBtnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  nativeBtnGhost: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
  },
  nativeBtnGhostText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '500' },
  carRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.bgPrimary,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  carName: { fontSize: 14, fontWeight: '500', color: theme.colors.textPrimary },
  carAddr: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  carLinkedPill: {
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  carLinkedPillText: { fontSize: 11, fontWeight: '600', color: theme.colors.primaryDeep },

  // Secondary "scan instead" link under the primary paired-devices button.
  scanLink: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  scanLinkText: { fontSize: 13, fontWeight: '500', color: theme.colors.primaryDeep },

  // Paired-device picker (bottom sheet) - mirrors the HomeScreen ⋮ menu pattern.
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: theme.colors.bgPrimary,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  pickerTitle: { fontSize: 16, fontWeight: '600', color: theme.colors.textPrimary },
  pickerSub: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, marginBottom: 8 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  pickerRowBorder: { borderBottomWidth: 0.5, borderBottomColor: theme.colors.borderTertiary },
  pickerName: { fontSize: 15, fontWeight: '500', color: theme.colors.textPrimary },
  pickerAddr: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  pickerCancel: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  pickerCancelText: { fontSize: 15, fontWeight: '500', color: theme.colors.textSecondary },

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
  stepImage: {
    marginTop: 8,
    borderRadius: theme.radius.sm,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    backgroundColor: theme.colors.bgSecondary,
  },

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

  // Inline "add the shortcut" button under a step's detail text.
  stepActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  stepActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // "Show me how, step by step" - opens the slideshow walkthrough.
  slideshowOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 0.5,
    borderColor: '#5DCAA5',
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  slideshowOpenText: { color: theme.colors.primaryDeep, fontSize: 14, fontWeight: '600' },

  // Full-screen slideshow walkthrough
  slideshowSafe: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  slideshowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  slideshowTitle: { fontSize: 17, fontWeight: '600', color: theme.colors.textPrimary },
  slideshowCounter: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  slideshowSlide: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 14,
  },
  slideshowStepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  slideshowDetail: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  slideshowImage: {
    borderRadius: theme.radius.lg,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    backgroundColor: theme.colors.bgSecondary,
  },
  slideshowDots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  slideshowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.borderSecondary },
  slideshowDotActive: { backgroundColor: theme.colors.primary, width: 20 },
  slideshowActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  slideshowBackBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  slideshowBackText: { fontSize: 15, fontWeight: '500', color: theme.colors.textSecondary },
  slideshowNextBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  slideshowNextText: { fontSize: 16, fontWeight: '600', color: '#fff' },

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
