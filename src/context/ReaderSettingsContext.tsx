import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  ReaderSettings,
  ThemeMode,
  SavedCustomTheme,
  SavedColorPalette,
  SavedTypographyPreset,
  HighlightFilterMode,
} from '../types/novel';
import { isValidHexColor, normalizeHexColor, getLuminance } from '../utils/colorValidator';
import { getFontFamilyCss } from '../utils/fontHelper';
import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_HIGHLIGHT_TEXT_COLOR,
  DEFAULT_OTHER_USERS_COLOR,
} from '../services/highlightService';

interface ReaderSettingsContextType {
  settings: ReaderSettings;
  updateSettings: (partial: Partial<ReaderSettings>) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setCustomColors: (bg: string, text: string, subText: string) => { success: boolean; error?: string };
  setHighlightColor: (color: string) => void;
  setHighlightTextColor: (color: string) => void;
  setOtherUsersHighlightColor: (color: string) => void;
  setOtherUsersColorMode: (mode: 'original' | 'unified') => void;
  setHighlightFilterMode: (mode: HighlightFilterMode) => void;
  saveColorPalette: (name?: string) => SavedColorPalette;
  deleteColorPalette: (id: string) => void;
  applyColorPalette: (palette: SavedColorPalette) => void;
  saveTypographyPreset: (name?: string) => SavedTypographyPreset;
  deleteTypographyPreset: (id: string) => void;
  applyTypographyPreset: (preset: SavedTypographyPreset) => void;
  saveCurrentTheme: (name?: string) => SavedCustomTheme;
  deleteSavedTheme: (id: string) => void;
  applySavedTheme: (theme: SavedCustomTheme) => void;
  resetSettings: () => void;
  effectiveColors: {
    bg: string;
    text: string;
    subText: string;
    mutedText: string;
    border: string;
    isDark: boolean;
  };
}

const STORAGE_KEY = 'private_novel_reader_settings_v5';

const DEFAULT_SETTINGS: ReaderSettings = {
  themeMode: 'light',
  customBgColor: '#FFFFFF',
  customTextColor: '#1A1A1A',
  customSubTextColor: '#737373',
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
  highlightTextColor: DEFAULT_HIGHLIGHT_TEXT_COLOR,
  otherUsersHighlightColor: DEFAULT_OTHER_USERS_COLOR, // Mint (#34D399) distinctly contrasting with user's Sky (#60A5FA)
  otherUsersColorMode: 'unified', // Unified by default so custom other user color takes immediate effect
  memoFontSize: 12, // in px (default small note size)
  memoFontFamily: 'sans',
  highlightFilterMode: 'all',
  savedColorPalettes: [],
  savedTypographyPresets: [],
  savedCustomThemes: [],
  fontSize: 16,
  lineHeight: 1.85,
  letterSpacing: 0.005,
  contentWidth: 680,
  fontFamily: 'shippori',
  paragraphSpacing: 1.25,
  showProgressBar: true,
};

const ReaderSettingsContext = createContext<ReaderSettingsContextType | null>(null);

export const ReaderSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ReaderSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          savedColorPalettes: Array.isArray(parsed.savedColorPalettes) ? parsed.savedColorPalettes : [],
          savedTypographyPresets: Array.isArray(parsed.savedTypographyPresets) ? parsed.savedTypographyPresets : [],
          savedCustomThemes: Array.isArray(parsed.savedCustomThemes) ? parsed.savedCustomThemes : [],
        };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SETTINGS;
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Listen to OS theme changes for system mode
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save reader settings:', e);
    }
  }, [settings]);

  // Compute 3 effective colors based on active themeMode
  let effectiveBg = '#FFFFFF';
  let effectiveText = '#1A1A1A';
  let effectiveSubText = '#737373';

  if (settings.themeMode === 'light') {
    effectiveBg = '#FFFFFF';
    effectiveText = '#1A1A1A';
    effectiveSubText = '#737373';
  } else if (settings.themeMode === 'dark') {
    effectiveBg = '#121212';
    effectiveText = '#E5E5E5';
    effectiveSubText = '#8A8A8E';
  } else if (settings.themeMode === 'system') {
    if (systemIsDark) {
      effectiveBg = '#121212';
      effectiveText = '#E5E5E5';
      effectiveSubText = '#8A8A8E';
    } else {
      effectiveBg = '#FFFFFF';
      effectiveText = '#1A1A1A';
      effectiveSubText = '#737373';
    }
  } else if (settings.themeMode === 'custom') {
    effectiveBg = isValidHexColor(settings.customBgColor)
      ? normalizeHexColor(settings.customBgColor)
      : '#FFFFFF';
    effectiveText = isValidHexColor(settings.customTextColor)
      ? normalizeHexColor(settings.customTextColor)
      : '#1A1A1A';
    effectiveSubText = isValidHexColor(settings.customSubTextColor)
      ? normalizeHexColor(settings.customSubTextColor)
      : '#737373';
  }

  const isDark = getLuminance(effectiveBg) < 0.35;
  const effectiveBorder = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

  // Sync with document element
  useEffect(() => {
    const root = document.documentElement;
    const activeFont = getFontFamilyCss(settings.fontFamily);
    const memoFont = getFontFamilyCss(settings.memoFontFamily || 'sans');

    root.style.setProperty('--reader-bg', effectiveBg);
    root.style.setProperty('--reader-text', effectiveText);
    root.style.setProperty('--reader-subtext', effectiveSubText);
    root.style.setProperty('--reader-font-family', activeFont);
    root.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--reader-line-height', `${settings.lineHeight}`);
    root.style.setProperty('--reader-letter-spacing', `${settings.letterSpacing}em`);
    root.style.setProperty('--reader-content-width', `${settings.contentWidth}px`);
    root.style.setProperty('--reader-paragraph-spacing', `${settings.paragraphSpacing}rem`);
    root.style.setProperty('--reader-highlight-color', settings.highlightColor);
    root.style.setProperty('--reader-highlight-text-color', settings.highlightTextColor);
    root.style.setProperty('--reader-memo-font-size', `${settings.memoFontSize || 12}px`);
    root.style.setProperty('--reader-memo-font-family', memoFont);

    document.body.style.backgroundColor = effectiveBg;
    document.body.style.color = effectiveText;
    document.body.style.fontFamily = activeFont;

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [
    effectiveBg,
    effectiveText,
    effectiveSubText,
    isDark,
    settings.fontFamily,
    settings.fontSize,
    settings.lineHeight,
    settings.letterSpacing,
    settings.contentWidth,
    settings.paragraphSpacing,
    settings.highlightColor,
    settings.highlightTextColor,
    settings.memoFontSize,
    settings.memoFontFamily,
  ]);

  const updateSettings = (partial: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const setThemeMode = (mode: ThemeMode) => {
    setSettings((prev) => ({ ...prev, themeMode: mode }));
  };

  const setCustomColors = (bg: string, text: string, subText: string) => {
    if (!isValidHexColor(bg)) {
      return { success: false, error: '背景色のコードが正しくありません。(例: #FFFFFF)' };
    }
    if (!isValidHexColor(text)) {
      return { success: false, error: '文字色(メイン)のコードが正しくありません。(例: #1A1A1A)' };
    }
    if (!isValidHexColor(subText)) {
      return { success: false, error: '文字色2(サブカラー)のコードが正しくありません。(例: #737373)' };
    }
    setSettings((prev) => ({
      ...prev,
      themeMode: 'custom',
      customBgColor: normalizeHexColor(bg),
      customTextColor: normalizeHexColor(text),
      customSubTextColor: normalizeHexColor(subText),
    }));
    return { success: true };
  };

  const setHighlightColor = (color: string) => {
    setSettings((prev) => ({
      ...prev,
      highlightColor: normalizeHexColor(color),
    }));
  };

  const setHighlightTextColor = (color: string) => {
    setSettings((prev) => ({
      ...prev,
      highlightTextColor: normalizeHexColor(color),
    }));
  };

  const setOtherUsersHighlightColor = (color: string) => {
    setSettings((prev) => ({
      ...prev,
      otherUsersHighlightColor: normalizeHexColor(color),
    }));
  };

  const setOtherUsersColorMode = (mode: 'original' | 'unified') => {
    setSettings((prev) => ({
      ...prev,
      otherUsersColorMode: mode,
    }));
  };

  const setHighlightFilterMode = (mode: HighlightFilterMode) => {
    setSettings((prev) => ({
      ...prev,
      highlightFilterMode: mode,
    }));
  };

  // --- Independent Color Palette Management (配色の独立保存) ---
  const saveColorPalette = (name?: string): SavedColorPalette => {
    const bg = isValidHexColor(settings.customBgColor)
      ? normalizeHexColor(settings.customBgColor)
      : effectiveBg;
    const text = isValidHexColor(settings.customTextColor)
      ? normalizeHexColor(settings.customTextColor)
      : effectiveText;
    const subText = isValidHexColor(settings.customSubTextColor)
      ? normalizeHexColor(settings.customSubTextColor)
      : effectiveSubText;

    const currentPalettes = settings.savedColorPalettes || [];
    const newPalette: SavedColorPalette = {
      id: 'palette_' + Date.now(),
      name: name?.trim() || `配色 ${currentPalettes.length + 1}`,
      bgColor: bg,
      textColor: text,
      subTextColor: subText,
      highlightColor: settings.highlightColor,
      otherUsersHighlightColor: settings.otherUsersHighlightColor,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSettings((prev) => ({
      ...prev,
      savedColorPalettes: [newPalette, ...(prev.savedColorPalettes || [])],
    }));

    return newPalette;
  };

  const deleteColorPalette = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      savedColorPalettes: (prev.savedColorPalettes || []).filter((p) => p.id !== id),
    }));
  };

  const applyColorPalette = (palette: SavedColorPalette) => {
    setSettings((prev) => ({
      ...prev,
      themeMode: 'custom',
      customBgColor: palette.bgColor,
      customTextColor: palette.textColor,
      customSubTextColor: palette.subTextColor,
      highlightColor: palette.highlightColor || prev.highlightColor,
      highlightTextColor: palette.highlightColor || prev.highlightTextColor,
      otherUsersHighlightColor: palette.otherUsersHighlightColor || prev.otherUsersHighlightColor,
    }));
  };

  // --- Independent Typography & Layout Preset Management (書体・余白の独立保存) ---
  const saveTypographyPreset = (name?: string): SavedTypographyPreset => {
    const currentPresets = settings.savedTypographyPresets || [];
    const newPreset: SavedTypographyPreset = {
      id: 'typo_' + Date.now(),
      name: name?.trim() || `書体設定 ${currentPresets.length + 1}`,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      letterSpacing: settings.letterSpacing,
      paragraphSpacing: settings.paragraphSpacing,
      contentWidth: settings.contentWidth,
      memoFontFamily: settings.memoFontFamily,
      memoFontSize: settings.memoFontSize,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSettings((prev) => ({
      ...prev,
      savedTypographyPresets: [newPreset, ...(prev.savedTypographyPresets || [])],
    }));

    return newPreset;
  };

  const deleteTypographyPreset = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      savedTypographyPresets: (prev.savedTypographyPresets || []).filter((p) => p.id !== id),
    }));
  };

  const applyTypographyPreset = (preset: SavedTypographyPreset) => {
    setSettings((prev) => ({
      ...prev,
      fontFamily: preset.fontFamily || prev.fontFamily,
      fontSize: preset.fontSize || prev.fontSize,
      lineHeight: preset.lineHeight || prev.lineHeight,
      letterSpacing: preset.letterSpacing ?? prev.letterSpacing,
      paragraphSpacing: preset.paragraphSpacing || prev.paragraphSpacing,
      contentWidth: preset.contentWidth || prev.contentWidth,
      memoFontFamily: preset.memoFontFamily || prev.memoFontFamily,
      memoFontSize: preset.memoFontSize ?? prev.memoFontSize,
    }));
  };

  // --- Unified Theme (Backward-compatible) ---
  const saveCurrentTheme = (name?: string): SavedCustomTheme => {
    const bg = isValidHexColor(settings.customBgColor)
      ? normalizeHexColor(settings.customBgColor)
      : effectiveBg;
    const text = isValidHexColor(settings.customTextColor)
      ? normalizeHexColor(settings.customTextColor)
      : effectiveText;
    const subText = isValidHexColor(settings.customSubTextColor)
      ? normalizeHexColor(settings.customSubTextColor)
      : effectiveSubText;

    const currentThemes = settings.savedCustomThemes || [];
    const newTheme: SavedCustomTheme = {
      id: 'theme_' + Date.now(),
      name: name?.trim() || `マイテーマ ${currentThemes.length + 1}`,
      bgColor: bg,
      textColor: text,
      subTextColor: subText,
      highlightColor: settings.highlightColor,
      highlightTextColor: settings.highlightTextColor,
      otherUsersHighlightColor: settings.otherUsersHighlightColor,
      memoFontSize: settings.memoFontSize,
      memoFontFamily: settings.memoFontFamily,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      contentWidth: settings.contentWidth,
      lineHeight: settings.lineHeight,
      letterSpacing: settings.letterSpacing,
      paragraphSpacing: settings.paragraphSpacing,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setSettings((prev) => ({
      ...prev,
      savedCustomThemes: [newTheme, ...(prev.savedCustomThemes || [])],
    }));

    return newTheme;
  };

  const deleteSavedTheme = (id: string) => {
    setSettings((prev) => ({
      ...prev,
      savedCustomThemes: (prev.savedCustomThemes || []).filter((t) => t.id !== id),
    }));
  };

  const applySavedTheme = (theme: SavedCustomTheme) => {
    setSettings((prev) => ({
      ...prev,
      themeMode: 'custom',
      customBgColor: theme.bgColor,
      customTextColor: theme.textColor,
      customSubTextColor: theme.subTextColor,
      highlightColor: theme.highlightColor || prev.highlightColor,
      highlightTextColor: theme.highlightTextColor || prev.highlightTextColor,
      otherUsersHighlightColor: theme.otherUsersHighlightColor || prev.otherUsersHighlightColor,
      memoFontSize: theme.memoFontSize ?? prev.memoFontSize,
      memoFontFamily: theme.memoFontFamily || prev.memoFontFamily,
      fontFamily: theme.fontFamily || prev.fontFamily,
      fontSize: theme.fontSize || prev.fontSize,
      contentWidth: theme.contentWidth || prev.contentWidth,
      lineHeight: theme.lineHeight || prev.lineHeight,
      letterSpacing: theme.letterSpacing ?? prev.letterSpacing,
      paragraphSpacing: theme.paragraphSpacing || prev.paragraphSpacing,
    }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return (
    <ReaderSettingsContext.Provider
      value={{
        settings,
        updateSettings,
        setThemeMode,
        setCustomColors,
        setHighlightColor,
        setHighlightTextColor,
        setOtherUsersHighlightColor,
        setOtherUsersColorMode,
        setHighlightFilterMode,
        saveColorPalette,
        deleteColorPalette,
        applyColorPalette,
        saveTypographyPreset,
        deleteTypographyPreset,
        applyTypographyPreset,
        saveCurrentTheme,
        deleteSavedTheme,
        applySavedTheme,
        resetSettings,
        effectiveColors: {
          bg: effectiveBg,
          text: effectiveText,
          subText: effectiveSubText,
          mutedText: effectiveSubText,
          border: effectiveBorder,
          isDark,
        },
      }}
    >
      {children}
    </ReaderSettingsContext.Provider>
  );
};

export const useReaderSettings = () => {
  const ctx = useContext(ReaderSettingsContext);
  if (!ctx) {
    throw new Error('useReaderSettings must be used within ReaderSettingsProvider');
  }
  return ctx;
};
