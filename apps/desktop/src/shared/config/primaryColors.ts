import type { PrimaryColorPreset } from '@shared/types/appearance';

export const PRIMARY_COLORS: PrimaryColorPreset[] = [
  { id: 'blue',       name: 'Blue',       nameAr: 'أزرق',     hue: 221, saturation: 83, lightness: 53 },
  { id: 'red',        name: 'Red',        nameAr: 'أحمر',     hue: 0,   saturation: 84, lightness: 60 },
  { id: 'green',      name: 'Green',      nameAr: 'أخضر',    hue: 142, saturation: 76, lightness: 36 },
  { id: 'purple',     name: 'Purple',     nameAr: 'بنفسجي',  hue: 265, saturation: 89, lightness: 58 },
  { id: 'orange',     name: 'Orange',     nameAr: 'برتقالي', hue: 24,  saturation: 95, lightness: 55 },
  { id: 'gold',       name: 'Gold',       nameAr: 'ذهبي',    hue: 43,  saturation: 100, lightness: 50 },
  { id: 'pink',       name: 'Pink',       nameAr: 'وردي',    hue: 335, saturation: 75, lightness: 60 },
  { id: 'indigo',     name: 'Indigo',     nameAr: 'نيلي',    hue: 230, saturation: 90, lightness: 60 },
  { id: 'cyan',       name: 'Cyan',       nameAr: 'سماوي',   hue: 195, saturation: 85, lightness: 50 },
  { id: 'emerald',    name: 'Emerald',    nameAr: 'زمردي',   hue: 160, saturation: 84, lightness: 39 },
  { id: 'amber',      name: 'Amber',      nameAr: 'كهرماني', hue: 38,  saturation: 92, lightness: 50 },
  { id: 'violet',     name: 'Violet',     nameAr: 'أرجواني', hue: 270, saturation: 85, lightness: 56 },
];

export function getPrimaryColor(id: string): PrimaryColorPreset | undefined {
  return PRIMARY_COLORS.find(c => c.id === id);
}

export function applyPrimaryColor(hue: number, saturation: number, lightness: number) {
  const root = document.documentElement;
  root.style.setProperty('--primary', `${hue} ${saturation}% ${lightness}%`);
  const fgLightness = lightness > 55 ? '10%' : '98%';
  root.style.setProperty('--primary-foreground', `0 0% ${fgLightness}`);
  root.style.setProperty('--ring', `${hue} ${saturation}% ${lightness}%`);
}
