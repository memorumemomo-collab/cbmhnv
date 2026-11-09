import { ReaderFontFamily } from '../types/novel';

export interface FontOption {
  id: ReaderFontFamily;
  name: string;
  category: '明朝' | 'ゴシック';
  description: string;
  fontFamily: string;
}

export const JAPANESE_FONT_OPTIONS: FontOption[] = [
  {
    id: 'shippori',
    name: 'しっぽり明朝',
    category: '明朝',
    description: '文学小説に最も適した情緒あるオールドスタイル明朝（推奨）',
    fontFamily: '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
  },
  {
    id: 'biz-mincho',
    name: 'BIZ UD明朝',
    category: '明朝',
    description: 'モリサワ開発。液晶画面での目の疲れを軽減する高可読UD明朝',
    fontFamily: '"BIZ UDPMincho", "BIZ UDMincho", "Hiragino Mincho ProN", serif',
  },
  {
    id: 'noto-serif',
    name: '源ノ明朝',
    category: '明朝',
    description: '端正で文字の潰れにくい正統派スタンダード明朝',
    fontFamily: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  },
  {
    id: 'biz-gothic',
    name: 'BIZ UDゴシック',
    category: 'ゴシック',
    description: 'モリサワ開発。文字の輪郭がくっきり認識できる高可読ゴシック',
    fontFamily: '"BIZ UDPGothic", "BIZ UDGothic", "Hiragino Sans", sans-serif',
  },
  {
    id: 'sans',
    name: 'システムゴシック',
    category: 'ゴシック',
    description: 'OS標準のすっきりと現代的な軽量ゴシック体',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif',
  },
];

export function getFontFamilyCss(family: ReaderFontFamily): string {
  if (family === 'shippori' || family === 'serif') {
    return '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif';
  }
  if (family === 'biz-mincho') {
    return '"BIZ UDPMincho", "BIZ UDMincho", "Hiragino Mincho ProN", serif';
  }
  if (family === 'noto-serif') {
    return '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
  }
  if (family === 'biz-gothic') {
    return '"BIZ UDPGothic", "BIZ UDGothic", "Hiragino Sans", sans-serif';
  }
  return '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif';
}
