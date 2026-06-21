// ─────────────────────────────────────────────────────────────────────────────
// screens/Onboarding.tsx  -  First-run swipeable intro (4 slides).
//
// Shown once on first launch (gated by settings.onboardingSeen in HomeScreen).
// Plain horizontal paging ScrollView - no carousel dependency. The last slide
// offers a shortcut into car-detection setup, which is the one step new users
// get stuck on (tester feedback).
//
// Slides 1-3 show cropped app screenshots (assets/onboard-*.png); slide 4
// (hands-free) stays an icon - it's an automation concept, not a single screen.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  image?: ImageSourcePropType;
};

const SLIDES: Slide[] = [
  {
    icon: 'checkmark-done-circle-outline',
    title: 'Never forget the essentials',
    body: 'CheckDrive gives you a quick checklist for every trip, so you catch what you’d forget before you pull out of the driveway.',
    image: require('../../assets/onboard-run.png'),
  },
  {
    icon: 'remove-circle-outline',
    title: 'Skip what doesn’t apply',
    body: 'Not every item matters on every trip. Tap skip to set one aside - it won’t count against your score, so your progress stays fair.',
    image: require('../../assets/onboard-skip.png'),
  },
  {
    icon: 'create-outline',
    title: 'Make it yours',
    body: 'Build your own lists or start from the samples. Add your start and end items, pick an icon and color, and edit any list anytime.',
    image: require('../../assets/onboard-create.png'),
  },
  {
    icon: 'car-outline',
    title: 'Hands-free, and more',
    body: 'Set up car detection so your list pops up automatically when you get in the car. Plus a back-seat reminder when you park, and trip history to track what you’ve done.',
  },
];

// Each slide shows either its cropped app screenshot or, for the hands-free
// slide, the fallback icon. Screenshots are sized in explicit points from the
// slide width so they can't overflow, with height from the asset's own ratio.
function SlideVisual({ slide, maxW }: { slide: Slide; maxW: number }) {
  if (!slide.image) {
    return (
      <View style={s.iconWrap}>
        <Ionicons name={slide.icon} size={64} color={theme.colors.primary} />
      </View>
    );
  }
  const meta = Image.resolveAssetSource(slide.image);
  const ratio = meta && meta.width ? meta.height / meta.width : 1;
  return (
    <Image
      source={slide.image}
      style={[s.slideImage, { width: maxW, height: Math.round(maxW * ratio) }]}
      resizeMode="contain"
    />
  );
}

export function Onboarding({
  visible,
  onDone,
}: {
  visible: boolean;
  // setup=true → user asked to jump into car-detection setup after finishing.
  onDone: (setup: boolean) => void;
}) {
  const { width } = useWindowDimensions();
  // Image width: slide content width (screen minus the 32pt side padding each
  // side), capped so it doesn't get oversized on large phones.
  const imgW = Math.min(width - 64, 340);
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  }

  function next() {
    if (last) {
      onDone(false);
      return;
    }
    scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => onDone(false)}>
      <SafeAreaView style={s.safe}>
        {/* Skip - top right, always available */}
        <View style={s.top}>
          <TouchableOpacity onPress={() => onDone(false)} hitSlop={10}>
            <Text style={s.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
        >
          {SLIDES.map((slide) => (
            <View key={slide.title} style={[s.slide, { width }]}>
              <SlideVisual slide={slide} maxW={imgW} />
              <Text style={s.title}>{slide.title}</Text>
              <Text style={s.body}>{slide.body}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Page dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[s.dot, i === page && s.dotActive]} />
          ))}
        </View>

        {/* Actions */}
        <View style={s.actions}>
          {last && (
            <TouchableOpacity style={s.setupBtn} onPress={() => onDone(true)}>
              <Ionicons name="car-outline" size={16} color={theme.colors.primary} />
              <Text style={s.setupBtnText}>  Set up car detection</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.nextBtn} onPress={next}>
            <Text style={s.nextBtnText}>{last ? 'Get started' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bgPrimary },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 8 },
  skip: { fontSize: 15, color: theme.colors.textSecondary, fontWeight: '500' },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: { fontSize: 24, fontWeight: '600', color: theme.colors.textPrimary, textAlign: 'center' },
  body: { fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  slideImage: {
    borderRadius: theme.radius.lg,
    borderWidth: 0.5,
    borderColor: theme.colors.borderTertiary,
    marginBottom: 8,
  },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.borderSecondary },
  dotActive: { backgroundColor: theme.colors.primary, width: 20 },

  actions: { paddingHorizontal: 24, paddingBottom: 16, gap: 10 },
  setupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 0.5,
    borderColor: theme.colors.borderSecondary,
    backgroundColor: theme.colors.bgPrimary,
  },
  setupBtnText: { fontSize: 15, fontWeight: '500', color: theme.colors.primary },
  nextBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  nextBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
