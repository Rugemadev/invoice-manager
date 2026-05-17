// 50 invoice/proforma templates — 5 styles × 10 color families
const STYLES = ['modern', 'classic', 'minimal', 'bold', 'dark'];
const COLORS = [
  { name: 'Ocean Blue',   primary: '#2563EB', light: '#DBEAFE', dark: '#1D4ED8', text: '#fff' },
  { name: 'Navy',         primary: '#1E3A5F', light: '#E0EAF5', dark: '#152B47', text: '#fff' },
  { name: 'Emerald',      primary: '#059669', light: '#D1FAE5', dark: '#047857', text: '#fff' },
  { name: 'Forest',       primary: '#16A34A', light: '#DCFCE7', dark: '#15803D', text: '#fff' },
  { name: 'Violet',       primary: '#7C3AED', light: '#EDE9FE', dark: '#6D28D9', text: '#fff' },
  { name: 'Purple',       primary: '#9333EA', light: '#F3E8FF', dark: '#7E22CE', text: '#fff' },
  { name: 'Crimson',      primary: '#DC2626', light: '#FEE2E2', dark: '#B91C1C', text: '#fff' },
  { name: 'Amber',        primary: '#D97706', light: '#FEF3C7', dark: '#B45309', text: '#fff' },
  { name: 'Teal',         primary: '#0F766E', light: '#CCFBF1', dark: '#0D6B63', text: '#fff' },
  { name: 'Slate',        primary: '#475569', light: '#F1F5F9', dark: '#334155', text: '#fff' },
];

const STYLE_LABELS = {
  modern:  'Modern',
  classic: 'Classic',
  minimal: 'Minimal',
  bold:    'Bold',
  dark:    'Elegant',
};

export const TEMPLATES = STYLES.flatMap((style, si) =>
  COLORS.map((color, ci) => ({
    id: `t${String(si * 10 + ci + 1).padStart(2, '0')}`,
    name: `${color.name} · ${STYLE_LABELS[style]}`,
    style,
    primaryColor: color.primary,
    lightColor:   color.light,
    darkColor:    color.dark,
    headerText:   color.text,
    previewColors: [color.primary, color.light, color.dark],
  }))
);

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
}
