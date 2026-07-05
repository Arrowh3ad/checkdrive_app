// ─────────────────────────────────────────────────────────────────────────────
// data/templates.ts  -  Built-in trip templates ("start from a template").
//
// WHY THIS EXISTS
// A new user otherwise faces an empty editor - a cold start that reads as
// "just another checklist app". Templates seed a realistic list in one tap and
// carry the app's safety positioning: every template includes the forgettable
// + safety items (kid, pet, wallet, meds, chargers), and the templates where a
// life is on the line (school run, dog outing) ship with the back-seat
// reminder pre-enabled.
//
// Items are plain label strings - NewChecklistScreen already edits items as
// string[] and generates ChecklistItem IDs at save time, so a template is just
// prefilled form state, not a Checklist. Icons/colors reuse the screen's
// preset vocabulary so a template-made list looks native to the icon picker.
// ─────────────────────────────────────────────────────────────────────────────

export type TripTemplate = {
  id: string;
  name: string;
  iconName: string; // Ionicons name (matches Checklist.iconName)
  iconBg: string;
  iconColor: string;
  startItems: string[];
  endItems: string[];
  // Safety spine: pre-enable the back-seat reminder where it matters.
  backSeatReminder?: boolean;
  backSeatMessage?: string;
};

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: 'tpl-school-run',
    name: 'School run',
    iconName: 'people-outline',
    iconBg: '#FAEEDA',
    iconColor: '#854F0B',
    startItems: [
      'Backpack & homework',
      'Lunchbox & water bottle',
      'Permission slips',
      'Sports kit',
      'Everyone buckled in',
    ],
    endItems: ['Check the back seat', 'Nothing left on the seats'],
    backSeatReminder: true,
    backSeatMessage: 'Check the back seat - is everyone out?',
  },
  {
    id: 'tpl-commute',
    name: 'Work commute',
    iconName: 'briefcase-outline',
    iconBg: '#E1F5EE',
    iconColor: '#0F6E56',
    startItems: [
      'Wallet & keys',
      'Phone & charger',
      'Laptop / work bag',
      'Badge or pass',
      'Coffee & lunch',
      'Lock the front door',
    ],
    endItems: ['Take your laptop bag', 'Headlights off', 'Lock the car'],
  },
  {
    id: 'tpl-gym',
    name: 'Gym session',
    iconName: 'fitness-outline',
    iconBg: '#EEEDFE',
    iconColor: '#534AB7',
    startItems: [
      'Gym bag & shoes',
      'Water bottle',
      'Towel',
      'Headphones',
      'Padlock',
    ],
    endItems: ['Gear out of the car'],
  },
  {
    id: 'tpl-grocery',
    name: 'Grocery run',
    iconName: 'cart-outline',
    iconBg: '#DBEAFE',
    iconColor: '#1D4ED8',
    startItems: [
      'Shopping bags',
      'Shopping list',
      'Wallet / payment',
      'Returns & coupons',
    ],
    endItems: ['All bags out of the trunk', 'Frozen stuff away first'],
  },
  {
    id: 'tpl-dog',
    name: 'Dog outing',
    iconName: 'paw-outline',
    iconBg: '#FEF9C3',
    iconColor: '#854D0E',
    startItems: [
      'Leash & harness',
      'Water & bowl',
      'Poop bags',
      'Treats',
      'Towel for muddy paws',
    ],
    endItems: ['Dog out of the car', 'Refill water at home'],
    backSeatReminder: true,
    backSeatMessage: "Check the back seat - don't forget your dog!",
  },
  {
    id: 'tpl-road-trip',
    name: 'Road trip',
    iconName: 'map-outline',
    iconBg: '#FEE2E2',
    iconColor: '#991B1B',
    startItems: [
      'License & registration',
      'Phone charger & mount',
      'Snacks & water',
      'Luggage loaded',
      'Medications',
      'Gas topped up',
      'Tire pressure checked',
    ],
    endItems: ['Valuables out of sight', 'Headlights off', 'Doors locked'],
  },
  {
    id: 'tpl-airport',
    name: 'Airport run',
    iconName: 'airplane-outline',
    iconBg: '#F3F4F6',
    iconColor: '#374151',
    startItems: [
      'Passport / ID',
      'Boarding pass on phone',
      'Luggage in trunk',
      'Chargers packed',
      'Medications',
      'House locked',
    ],
    endItems: ['Photo of your parking spot', 'Nothing left in the trunk'],
  },
];
