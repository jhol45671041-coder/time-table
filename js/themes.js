/**
 * Theme registry. Each entry carries the colours needed to draw a truthful
 * mini-preview inside the Styles studio, independent of the active theme.
 */
export const THEMES = [
  {
    id: 'aurora', name: 'Aurora', family: 'Dark', blurb: 'Indigo glass, gradient light — the house default.',
    mode: 'dark',
    preview: { bg: '#0b0d1a', panel: 'rgba(255,255,255,.07)', text: '#eef0ff', muted: '#a5abc9', accent: '#8b7cff', accent2: '#3fd9c2', line: 'rgba(255,255,255,.14)', radius: 14 },
  },
  {
    id: 'midnight', name: 'Midnight', family: 'Dark', blurb: 'Deep navy with a cold cyan edge. Very calm at night.',
    mode: 'dark',
    preview: { bg: '#04070f', panel: 'rgba(126,186,255,.08)', text: '#e6f0ff', muted: '#93a9c6', accent: '#41b0f5', accent2: '#3ad7e8', line: 'rgba(140,190,255,.18)', radius: 14 },
  },
  {
    id: 'neon', name: 'Neon Grid', family: 'Dark', blurb: 'Cyberpunk terminal: acid green on black with a scan grid.',
    mode: 'dark',
    preview: { bg: '#06060a', panel: 'rgba(10,255,190,.07)', text: '#dcfff2', muted: '#7f9c92', accent: '#00ff9d', accent2: '#ff4fd8', line: 'rgba(0,255,178,.28)', radius: 6 },
  },
  {
    id: 'forest', name: 'Forest', family: 'Dark', blurb: 'Mossy greens, low contrast, easy on the eyes.',
    mode: 'dark',
    preview: { bg: '#07110d', panel: 'rgba(190,255,220,.07)', text: '#e9f6ee', muted: '#9ab7a7', accent: '#5cc98f', accent2: '#a9cf5f', line: 'rgba(190,255,220,.16)', radius: 14 },
  },
  {
    id: 'slate', name: 'Slate', family: 'Dark', blurb: 'Neutral corporate dark. No gradients, tight corners.',
    mode: 'dark',
    preview: { bg: '#101317', panel: 'rgba(255,255,255,.05)', text: '#e9ecef', muted: '#9aa4ae', accent: '#4d9fe8', accent2: '#5fb8c9', line: 'rgba(255,255,255,.12)', radius: 9 },
  },
  {
    id: 'daylight', name: 'Daylight', family: 'Light', blurb: 'Crisp white and blue. The safe choice for projectors.',
    mode: 'light',
    preview: { bg: '#f5f7fc', panel: '#ffffff', text: '#101828', muted: '#5b6478', accent: '#2f62f0', accent2: '#1191b8', line: 'rgba(16,24,40,.14)', radius: 14 },
  },
  {
    id: 'mint', name: 'Mint', family: 'Light', blurb: 'Fresh teal-green with generous rounding.',
    mode: 'light',
    preview: { bg: '#f1fbf6', panel: '#ffffff', text: '#0c2a21', muted: '#4e7265', accent: '#157a5b', accent2: '#1b8ba8', line: 'rgba(9,60,44,.16)', radius: 16 },
  },
  {
    id: 'sunset', name: 'Sunset', family: 'Light', blurb: 'Warm peach and coral — friendly, a little retro.',
    mode: 'light',
    preview: { bg: '#fff6ef', panel: '#fffcf9', text: '#382015', muted: '#7d5b4a', accent: '#f0522a', accent2: '#f2a413', line: 'rgba(120,60,30,.18)', radius: 14 },
  },
  {
    id: 'paper', name: 'Paper', family: 'Light', blurb: 'Academic cream, serif type, ruled like a register.',
    mode: 'light',
    preview: { bg: '#f6f1e4', panel: '#fffdf6', text: '#23201a', muted: '#6b6455', accent: '#254f7d', accent2: '#a63a25', line: 'rgba(70,55,25,.3)', radius: 3 },
  },
  {
    id: 'clay', name: 'Clay', family: 'Soft', blurb: 'Neumorphic: surfaces pressed out of soft grey clay.',
    mode: 'light',
    preview: { bg: '#e7e9f0', panel: '#e7e9f0', text: '#2c3242', muted: '#6b7284', accent: '#6a63d8', accent2: '#4aa3b8', line: 'rgba(120,132,158,.2)', radius: 18, neu: true },
  },
  {
    id: 'candy', name: 'Candy', family: 'Playful', blurb: 'Pastel pink and lilac, extra-round, good for juniors.',
    mode: 'light',
    preview: { bg: '#fff4fa', panel: '#ffffff', text: '#3b2340', muted: '#82618a', accent: '#f0489c', accent2: '#8b6cf5', line: 'rgba(140,60,110,.18)', radius: 22 },
  },
  {
    id: 'brutalist', name: 'Brutalist', family: 'Bold', blurb: 'Black rules, hard shadows, mono type. Zero decoration.',
    mode: 'light',
    preview: { bg: '#f4f2ec', panel: '#ffffff', text: '#0a0a0a', muted: '#3c3c3c', accent: '#ffe600', accent2: '#ff2fb3', line: '#0a0a0a', radius: 0, brutal: true },
  },
];

export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.id, t]));

export const DENSITIES = [
  { id: 'compact', name: 'Compact', note: 'Fit a whole week on one screen' },
  { id: 'cosy', name: 'Cosy', note: 'The balanced default' },
  { id: 'roomy', name: 'Roomy', note: 'Bigger blocks, easier to read' },
];

export const FONTS = [
  { id: 'auto', name: 'Auto', note: 'Let each theme pick its own face' },
  { id: 'grotesk', name: 'Grotesk', note: 'Neutral UI sans' },
  { id: 'humanist', name: 'Humanist', note: 'Warmer, slightly calligraphic' },
  { id: 'serif', name: 'Serif', note: 'Academic register feel' },
  { id: 'mono', name: 'Mono', note: 'Terminal / engineering' },
];

export const ACCENT_PRESETS = [
  { name: 'Indigo', hue: 249 }, { name: 'Azure', hue: 210 }, { name: 'Teal', hue: 178 },
  { name: 'Emerald', hue: 152 }, { name: 'Lime', hue: 92 }, { name: 'Amber', hue: 40 },
  { name: 'Coral', hue: 14 }, { name: 'Rose', hue: 340 }, { name: 'Orchid', hue: 292 },
  { name: 'Violet', hue: 268 },
];

/** Pick a coherent random look — used by "Surprise me". */
export function randomStyle(seed = Date.now()) {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const theme = pick(THEMES);
  return {
    theme: theme.id,
    accent: rnd() < 0.55 ? null : Math.floor(rnd() * 360),
    density: pick(DENSITIES).id,
    font: pick(FONTS.filter((f) => f.id !== 'auto')).id,
    glass: theme.mode === 'dark' ? rnd() < 0.85 : rnd() < 0.3,
    grain: rnd() < 0.5,
    motion: true,
  };
}
