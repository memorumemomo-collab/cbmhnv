export type WorkType = 'series' | 'short';

export interface ContentBlock {
  type: 'HEADING_1' | 'HEADING_2' | 'NORMAL_TEXT';
  text: string;
}

export interface EpisodeTab {
  tabId: string; // Reflects Google Docs tabId
  title: string; // Reflects Google Docs tab title
  order: number;
  wordCount?: number;
  publishedAt?: string;
  blocks: ContentBlock[];
}

export interface NovelWork {
  id: string; // Document ID (e.g. 1cPki22T_7HXvo75pTAJ0Xn2G0eZS1avTcH--4UBfW7Q)
  title: string;
  type: WorkType;
  summary: string;
  author: string;
  tags: string[]; // Multiple tags supported
  createdAt: string;
  updatedAt: string;
  episodes: EpisodeTab[];
  docUrl?: string; // Optional Google Docs manuscript link
  episodeCount?: number; // 話数 column from Google Sheets catalog
  rowIndex?: number; // Row order in the catalog sheet (used as tie-break for newest-first sorting)
}

export type ThemeMode = 'light' | 'dark' | 'system' | 'custom';

export type ReaderFontFamily =
  | 'shippori' // しっぽり明朝 (文学・小説推奨)
  | 'biz-mincho' // BIZ UD明朝 (モリサワ高可読UD明朝)
  | 'noto-serif' // 源ノ明朝 (正統派明朝)
  | 'biz-gothic' // BIZ UDゴシック (高可読UDゴシック)
  | 'sans' // システムゴシック (モダン)
  | 'serif'; // 互換性用 (しっぽり明朝へフォールバック)

export interface SavedColorPalette {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  subTextColor: string;
  highlightColor: string;
  otherUsersHighlightColor: string;
  createdAt: string;
}

export interface SavedTypographyPreset {
  id: string;
  name: string;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  contentWidth: number;
  memoFontFamily?: ReaderFontFamily;
  memoFontSize?: number;
  createdAt: string;
}

export interface SavedCustomTheme {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  subTextColor: string;
  highlightColor?: string; // 형광펜 밑줄색 (배경색)
  highlightTextColor?: string; // 형광펜 글씨색 (인라인 메모 텍스트)
  memoFontSize?: number;
  memoFontFamily?: ReaderFontFamily;
  otherUsersHighlightColor?: string;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  contentWidth: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  createdAt: string;
}

export type HighlightFilterMode = 'all' | 'mine' | 'others' | 'none';
export type OtherUsersColorMode = 'original' | 'unified';

export interface BookmarkInfo {
  workId: string;
  workTitle: string;
  tabId: string;
  tabTitle: string;
  scrollPercentage: number;
  updatedAt: string;
}

export interface HighlightMemo {
  id: string;
  workId: string;
  tabId: string;
  paragraphIndex: number;
  selectedText: string;
  memoText?: string;
  emoji?: string; // Web clap emoji (e.g. 👏, ❤️, 😭, ✨, 💡, 🔥, 🍵)
  reactionCount?: number; // Cumulative reaction count (ウェブ拍手・リアクション累計)
  color: string; // 형광펜 밑줄색
  textColor?: string; // 형광펜 글씨색
  authorEmail: string;
  authorName?: string;
  createdAt: string;
  kind?: 'highlight' | 'comment'; // 'highlight' (본문 밑줄/메모) or 'comment' (각 화 하단 댓글)
  workTitle?: string;
  tabTitle?: string;
}

export interface ReaderSettings {
  themeMode: ThemeMode;
  customBgColor: string; // HEX e.g. #FFFFFF (背景色)
  customTextColor: string; // HEX e.g. #1A1A1A (文字色 / タイトル・本文)
  customSubTextColor: string; // HEX e.g. #737373 (文字色2 / サブカラー: 日付・概要・メタ情報)
  highlightColor: string; // HEX e.g. #FFE57F (自分の蛍光ペンの下線色)
  highlightTextColor: string; // HEX e.g. #1A1A1A (自分の蛍光ペンの文字色)
  otherUsersHighlightColor: string; // HEX e.g. #60A5FA (他ユーザーのハイライト統一色)
  otherUsersColorMode: OtherUsersColorMode; // 'original' (各投稿者の色) | 'unified' (統一色で区別)
  memoFontSize: number; // in px (e.g. 12)
  memoFontFamily: ReaderFontFamily;
  highlightFilterMode: HighlightFilterMode; // 'all' | 'mine' | 'others' | 'none'
  savedColorPalettes?: SavedColorPalette[]; // User-saved independent color palettes
  savedTypographyPresets?: SavedTypographyPreset[]; // User-saved independent typography & layout presets
  savedCustomThemes: SavedCustomTheme[]; // User-saved personal palettes (unified backward-compat)
  fontSize: number; // in px (e.g. 16, min 8)
  lineHeight: number; // relative (e.g. 1.85, min 1.0)
  letterSpacing: number; // in em (e.g. 0.005, min -0.10)
  contentWidth: number; // in px (e.g. 680)
  fontFamily: ReaderFontFamily;
  paragraphSpacing: number; // in rem (e.g. 1.25)
  showProgressBar: boolean;
}

export interface ReaderUser {
  email: string;
  name?: string;
  picture?: string;
}
