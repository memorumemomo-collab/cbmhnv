/**
 * Validates whether a given string is a valid HEX color code (#RGB or #RRGGBB).
 */
export function isValidHexColor(hex: string): boolean {
  if (!hex) return false;
  const trimmed = hex.trim();
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(trimmed);
}

/**
 * Normalizes 3-char HEX to 6-char HEX with leading #
 */
export function normalizeHexColor(hex: string): string {
  let clean = hex.trim();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(clean)) {
    const r = clean[1];
    const g = clean[2];
    const b = clean[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return clean.toUpperCase();
}

/**
 * Calculates perceived luminance (0 to 1) for contrast awareness
 */
export function getLuminance(hex: string): number {
  if (!isValidHexColor(hex)) return 1;
  const fullHex = normalizeHexColor(hex).slice(1);
  const r = parseInt(fullHex.substring(0, 2), 16) / 255;
  const g = parseInt(fullHex.substring(2, 4), 16) / 255;
  const b = parseInt(fullHex.substring(4, 6), 16) / 255;

  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Predefined reader themes with 3 colors:
 * 1. bgColor (背景色)
 * 2. textColor (文字色1: タイトル・本文)
 * 3. subTextColor (文字色2: 日付・概要・メタ情報・補助文字)
 */
export interface ColorPreset {
  name: string;
  label: string;
  bgColor: string;
  textColor: string;
  subTextColor: string;
  description: string;
}

export const READER_COLOR_PRESETS: ColorPreset[] = [
  {
    name: 'pure-white',
    label: '純白紙 (Pure White)',
    bgColor: '#FFFFFF',
    textColor: '#1A1A1A',
    subTextColor: '#737373',
    description: 'すっきりと鮮明な現代の白紙に落ち着いたグレーの補助文字',
  },
  {
    name: 'warm-paper',
    label: '鳥の子色 (Warm Paper)',
    bgColor: '#FBF9F5',
    textColor: '#292524',
    subTextColor: '#78716C',
    description: '目に優しく柔らかな和紙の風合いと温かみある濃墨',
  },
  {
    name: 'warm-sepia',
    label: '古書セピア (Antique Sepia)',
    bgColor: '#F4ECE1',
    textColor: '#3D312A',
    subTextColor: '#8C7B6B',
    description: '時代を経た古書のような温かなセピアトーン',
  },
  {
    name: 'slate-dusk',
    label: '黄昏スレート (Slate Dusk)',
    bgColor: '#1E232A',
    textColor: '#D8DEE9',
    subTextColor: '#8892B0',
    description: '薄暗い部屋でも眩しさを抑えた青灰のダーク配色',
  },
  {
    name: 'obsidian',
    label: '黒曜石 (Obsidian)',
    bgColor: '#121212',
    textColor: '#E5E5E5',
    subTextColor: '#8A8A8E',
    description: '完全な夜の闇に没入する深い黒とシルバーグレーの文字',
  },
];
