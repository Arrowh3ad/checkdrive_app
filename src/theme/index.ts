// ─────────────────────────────────────────────────────────────────────────────
// theme/index.ts  -  Design tokens for the entire CheckDrive app.
//
// Every color, spacing step, and border-radius value in the UI comes from
// here. Using a central token file means a color rebrand or dark-mode toggle
// only requires edits in this one place.
//
// `as const` tells TypeScript to treat every value as a literal type (e.g.
// the string '#1D9E75' rather than just `string`). Without it TypeScript would
// widen the types and you'd lose autocomplete and type-checking on specific
// color values when styles are read.
// ─────────────────────────────────────────────────────────────────────────────
export const theme = {
  colors: {
    // Brand green - used for primary actions, progress bars, and active states.
    primary: '#1D9E75',
    primaryDark: '#0F6E56',    // darker shade for text on light backgrounds
    primaryLight: '#E1F5EE',   // light tint for backgrounds and badges
    primaryDeep: '#085041',    // deepest shade, used for very small text on primaryLight

    // Brand purple - used for Pro features, multi-stop UI, and secondary CTAs.
    purple: '#534AB7',
    purpleDark: '#3C3489',
    purpleLight: '#EEEDFE',
    purpleBorder: '#AFA9EC',

    // Semantic colors for feedback states.
    danger: '#E24B4A',        // destructive actions, error states
    warning: '#854F0B',       // warnings; also the amber icon theme color
    warningLight: '#FAEEDA',  // amber icon theme background

    // Surface colors - iOS-inspired light mode greys.
    bgPrimary: '#FFFFFF',   // cards, inputs
    bgSecondary: '#F2F2F7', // page background, tab bars
    bgTertiary: '#E5E5EA',  // pressed/dimmed surfaces

    // Text colors with clear hierarchy.
    textPrimary: '#1C1C1E',    // headings and body copy
    textSecondary: '#6B7280',  // labels, metadata
    textTertiary: '#9CA3AF',   // hints, placeholders, disabled text

    // Border colors - three levels of visibility.
    borderPrimary: '#C7C7CC',  // prominent separators
    borderSecondary: '#D1D1D6',
    borderTertiary: '#E5E5EA', // subtle card outlines (most common)
  },

  // Spacing scale - multiply by your content's visual weight. Smaller = tighter.
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  // Border-radius scale used on cards, buttons, and chips.
  radius: {
    sm: 8,
    md: 10,
    lg: 14,
  },
} as const;
