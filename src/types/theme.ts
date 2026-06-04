// ─── Design Tokens ────────────────────────────────────────────────────────────
// Single source of truth for every colour, radius and shadow in the app.

export const COLORS = {
  sky1:      '#e8f4ff',   // page background
  sky2:      '#c5e3ff',   // soft accent
  sky3:      '#72b8f5',   // mid-blue
  blue:      '#1a7fe8',   // primary brand blue
  blueDark:  '#1260c4',
  blueDeep:  '#0a3d8f',   // deep navy
  white:     '#ffffff',
  text:      '#1a2840',   // primary text
  sub:       '#6b8aad',   // secondary / muted text
  missed:    '#e84343',   // missed call / error
  green:     '#22c55e',   // online indicator
  border:    'rgba(26,127,232,0.12)',
  cardBg:    'rgba(255,255,255,0.88)',
  inputBg:   'rgba(232,244,255,0.6)',
} as const;

export const GRADIENTS = {
  primary:   [COLORS.blue,    COLORS.blueDeep] as [string, string],
  sky:       [COLORS.blueDeep, COLORS.blue, COLORS.sky3] as [string, string, string],
  card:      ['rgba(255,255,255,0.95)', 'rgba(232,244,255,0.85)'] as [string, string],
} as const;

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   18,
  xl:   24,
  full: 999,
} as const;

export const SHADOW = {
  card: {
    shadowColor:   COLORS.blue,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
    elevation:     6,
  },
  button: {
    shadowColor:   COLORS.blue,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    elevation:     8,
  },
} as const;