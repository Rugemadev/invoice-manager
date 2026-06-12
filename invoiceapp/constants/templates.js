// 80 invoice templates — 5 original styles × 10 colors + 6 new styles × 5 colors each
const COLORS = [
  { name: 'Ocean Blue', primary: '#2563EB', light: '#DBEAFE', dark: '#1D4ED8', text: '#fff' },
  { name: 'Navy',       primary: '#1E3A5F', light: '#E0EAF5', dark: '#152B47', text: '#fff' },
  { name: 'Emerald',    primary: '#059669', light: '#D1FAE5', dark: '#047857', text: '#fff' },
  { name: 'Forest',     primary: '#16A34A', light: '#DCFCE7', dark: '#15803D', text: '#fff' },
  { name: 'Violet',     primary: '#7C3AED', light: '#EDE9FE', dark: '#6D28D9', text: '#fff' },
  { name: 'Purple',     primary: '#9333EA', light: '#F3E8FF', dark: '#7E22CE', text: '#fff' },
  { name: 'Crimson',    primary: '#DC2626', light: '#FEE2E2', dark: '#B91C1C', text: '#fff' },
  { name: 'Amber',      primary: '#D97706', light: '#FEF3C7', dark: '#B45309', text: '#fff' },
  { name: 'Teal',       primary: '#0F766E', light: '#CCFBF1', dark: '#0D6B63', text: '#fff' },
  { name: 'Slate',      primary: '#475569', light: '#F1F5F9', dark: '#334155', text: '#fff' },
];

const ORIGINAL_STYLES = [
  { key: 'modern',  label: 'Modern' },
  { key: 'classic', label: 'Classic' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'bold',    label: 'Bold' },
  { key: 'dark',    label: 'Elegant' },
];

// 6 new styles × 5 curated color variants = t51–t80
const NEW_STYLES = [
  { key: 'wave',      label: 'Wave',      colors: ['Ocean Blue', 'Emerald', 'Violet', 'Teal', 'Crimson'] },
  { key: 'geometric', label: 'Geometric', colors: ['Ocean Blue', 'Forest',  'Purple', 'Amber', 'Teal'] },
  { key: 'sidebar',   label: 'Sidebar',   colors: ['Ocean Blue', 'Emerald', 'Violet', 'Navy',  'Teal'] },
  { key: 'corporate', label: 'Corporate', colors: ['Navy',       'Amber',   'Crimson','Teal',  'Ocean Blue'] },
  { key: 'stripe',    label: 'Stripe',    colors: ['Ocean Blue', 'Forest',  'Purple', 'Crimson','Amber'] },
  { key: 'executive', label: 'Executive', colors: ['Ocean Blue', 'Emerald', 'Violet', 'Crimson','Teal'] },
];

const originalTemplates = ORIGINAL_STYLES.flatMap((style, si) =>
  COLORS.map((color, ci) => ({
    id: `t${String(si * 10 + ci + 1).padStart(2, '0')}`,
    name: `${color.name} · ${style.label}`,
    style: style.key,
    primaryColor: color.primary,
    lightColor:   color.light,
    darkColor:    color.dark,
    headerText:   color.text,
    previewColors: [color.primary, color.light, color.dark],
  }))
);

const newTemplates = NEW_STYLES.flatMap((style, si) =>
  style.colors.map((colorName, ci) => {
    const color = COLORS.find(c => c.name === colorName);
    return {
      id: `t${51 + si * 5 + ci}`,
      name: `${color.name} · ${style.label}`,
      style: style.key,
      primaryColor: color.primary,
      lightColor:   color.light,
      darkColor:    color.dark,
      headerText:   color.text,
      previewColors: [color.primary, color.light, color.dark],
    };
  })
);

export const TEMPLATES = [...originalTemplates, ...newTemplates];

export const STYLE_META = {
  modern:    { label: 'Modern',    isNew: false },
  classic:   { label: 'Classic',   isNew: false },
  minimal:   { label: 'Minimal',   isNew: false },
  bold:      { label: 'Bold',      isNew: false },
  dark:      { label: 'Elegant',   isNew: false },
  wave:      { label: 'Wave',      isNew: true },
  geometric: { label: 'Geometric', isNew: true },
  sidebar:   { label: 'Sidebar',   isNew: true },
  corporate: { label: 'Corporate', isNew: true },
  stripe:    { label: 'Stripe',    isNew: true },
  executive: { label: 'Executive', isNew: true },
};

export function getTemplate(id) {
  return TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0];
}
