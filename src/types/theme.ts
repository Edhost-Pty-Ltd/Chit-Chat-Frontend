// ─── Design Tokens — Glassmorphism Edition ────────────────────────────────────

export const COLORS = {
  // Background
  bgFrom:    '#0a2463',   // deep navy
  bgMid:     '#1a6fe8',   // vivid blue
  bgTo:      '#38bff8',   // sky cyan

  // Glass surfaces
  glass:        'rgba(255,255,255,0.12)',   // card fill
  glassBorder:  'rgba(255,255,255,0.28)',   // card border
  glassStrong:  'rgba(255,255,255,0.20)',   // hover / pressed
  glassInput:   'rgba(255,255,255,0.10)',   // input fill
  glassNav:     'rgba(10,36,99,0.55)',      // bottom nav

  // Brand
  blue:      '#1a7fe8',
  blueDark:  '#1260c4',
  blueDeep:  '#0a2463',

  // Text (on dark glass)
  textPrimary:  '#ffffff',
  textSub:      'rgba(255,255,255,0.65)',
  textMuted:    'rgba(255,255,255,0.40)',

  // Semantic
  green:   '#4ade80',
  missed:  '#f87171',
  amber:   '#fbbf24',
  white:   '#ffffff',

  // Legacy aliases (keep screens compiling without changes)
  sky1:     '#0d2d6b',
  sky2:     '#1a4fa0',
  sky3:     '#38bff8',
  text:     '#ffffff',
  sub:      'rgba(255,255,255,0.60)',
  border:   'rgba(255,255,255,0.20)',
  cardBg:   'rgba(255,255,255,0.12)',
  inputBg:  'rgba(255,255,255,0.10)',
} as const;

export const GRADIENTS = {
  // Full-screen background
  bg:      ['#0a2463', '#1a4fa0', '#38bff8'] as [string, string, string],
  // Primary action buttons
  primary: ['#38bff8', '#1a7fe8'] as [string, string],
  // Warm accent (story rings, badges)
  accent:  ['#f97316', '#ec4899'] as [string, string],
  // Subtle glass card gradient
  card:    ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'] as [string, string],
} as const;

export const GLASS = {
  // Standard frosted card
  card: {
    backgroundColor:  'rgba(255,255,255,0.12)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.28)',
    // BlurView intensity: 60
  },
  // Stronger surface (modals, headers)
  strong: {
    backgroundColor:  'rgba(255,255,255,0.20)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.35)',
  },
  // Input fields
  input: {
    backgroundColor:  'rgba(255,255,255,0.10)',
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.22)',
  },
  // Bottom nav
  nav: {
    backgroundColor:  'rgba(10,36,99,0.60)',
    borderTopWidth:    1,
    borderTopColor:    'rgba(255,255,255,0.18)',
  },
} as const;

export const RADIUS = {
  sm:   10,
  md:   14,
  lg:   20,
  xl:   26,
  full: 999,
} as const;

export const SHADOW = {
  card: {
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.25,
    shadowRadius:   20,
    elevation:      10,
  },
  button: {
    shadowColor:    '#38bff8',
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.45,
    shadowRadius:   12,
    elevation:      10,
  },
  glow: {
    shadowColor:    '#1a7fe8',
    shadowOffset:   { width: 0, height: 0 },
    shadowOpacity:  0.8,
    shadowRadius:   16,
    elevation:      12,
  },
} as const;
