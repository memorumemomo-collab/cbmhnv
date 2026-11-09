import React, { useState, useEffect } from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { ThemeMode, ReaderFontFamily, SavedColorPalette, SavedTypographyPreset } from '../types/novel';
import { isValidHexColor, normalizeHexColor, getLuminance, READER_COLOR_PRESETS } from '../utils/colorValidator';
import { JAPANESE_FONT_OPTIONS, getFontFamilyCss } from '../utils/fontHelper';
import {
  getSavedGasProxyUrl,
  saveGasProxyUrl,
  fetchCatalogFromGas,
} from '../services/gasProxyService';
import { HIGHLIGHT_COLOR_PRESETS } from '../services/highlightService';
import { GAS_MANIFEST_JSON, GAS_READONLY_SCRIPT } from '../data/gasScriptTemplate';

export const OTHER_USERS_COLOR_PRESETS = [
  { id: 'sky', name: '空青 (スカイ)', color: '#60A5FA' },
  { id: 'mint', name: '青磁 (ミント)', color: '#34D399' },
  { id: 'purple', name: '藤紫 (バイオレット)', color: '#A78BFA' },
  { id: 'rose', name: '撫子 (ローズ)', color: '#F472B6' },
  { id: 'amber', name: '山吹 (アンバー)', color: '#FBBF24' },
  { id: 'slate', name: '薄墨 (スレート)', color: '#94A3B8' },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavedUrlChange?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSavedUrlChange,
}) => {
  const {
    settings,
    updateSettings,
    setThemeMode,
    setCustomColors,
    setHighlightColor,
    setHighlightTextColor,
    setOtherUsersHighlightColor,
    saveColorPalette,
    deleteColorPalette,
    applyColorPalette,
    saveTypographyPreset,
    deleteTypographyPreset,
    applyTypographyPreset,
    resetSettings,
    effectiveColors,
  } = useReaderSettings();

  const [bgInput, setBgInput] = useState(settings.customBgColor);
  const [textInput, setTextInput] = useState(settings.customTextColor);
  const [subTextInput, setSubTextInput] = useState(settings.customSubTextColor);
  const [highlightInput, setHighlightInput] = useState(settings.highlightColor);
  const [highlightTextInput, setHighlightTextInput] = useState(settings.highlightTextColor);
  const [otherUsersHighlightInput, setOtherUsersHighlightInput] = useState(settings.otherUsersHighlightColor || '#60A5FA');

  const [bgError, setBgError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [subTextError, setSubTextError] = useState<string | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);
  const [highlightTextError, setHighlightTextError] = useState<string | null>(null);
  const [otherUsersHighlightError, setOtherUsersHighlightError] = useState<string | null>(null);

  const [newPaletteName, setNewPaletteName] = useState('');
  const [savePaletteSuccessMsg, setSavePaletteSuccessMsg] = useState(false);
  const [newTypoName, setNewTypoName] = useState('');
  const [saveTypoSuccessMsg, setSaveTypoSuccessMsg] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'theme' | 'typography' | 'sync'>('theme');
  const [proxyUrlInput, setProxyUrlInput] = useState(getSavedGasProxyUrl());
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [isTestingSync, setIsTestingSync] = useState(false);
  const [showGasGuide, setShowGasGuide] = useState(false);
  const [copiedGasItem, setCopiedGasItem] = useState<'script' | 'manifest' | null>(null);

  const handleCopyGas = (type: 'script' | 'manifest') => {
    const text = type === 'script' ? GAS_READONLY_SCRIPT : GAS_MANIFEST_JSON;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopiedGasItem(type);
    setTimeout(() => setCopiedGasItem(null), 3000);
  };

  useEffect(() => {
    setBgInput(settings.customBgColor);
    setTextInput(settings.customTextColor);
    setSubTextInput(settings.customSubTextColor);
    setHighlightInput(settings.highlightColor);
    setHighlightTextInput(settings.highlightTextColor);
    setOtherUsersHighlightInput(settings.otherUsersHighlightColor || '#60A5FA');
    setBgError(null);
    setTextError(null);
    setSubTextError(null);
    setHighlightError(null);
    setHighlightTextError(null);
    setOtherUsersHighlightError(null);
  }, [
    settings.customBgColor,
    settings.customTextColor,
    settings.customSubTextColor,
    settings.highlightColor,
    settings.highlightTextColor,
    settings.otherUsersHighlightColor,
    isOpen,
  ]);

  if (!isOpen) return null;

  const handleOtherUsersHighlightChange = (val: string) => {
    setOtherUsersHighlightInput(val);
    if (!val.trim()) {
      setOtherUsersHighlightError('色コードを入力してください。');
      return;
    }
    const normalized = val.startsWith('#') ? val : '#' + val;
    if (isValidHexColor(normalized)) {
      setOtherUsersHighlightError(null);
      setOtherUsersHighlightColor(normalized);
    } else {
      setOtherUsersHighlightError('#RRGGBB 形式が必要です');
    }
  };

  const handleHighlightChange = (val: string) => {
    setHighlightInput(val);
    if (!val.trim()) {
      setHighlightError('色コードを入力してください。');
      return;
    }
    const normalized = val.startsWith('#') ? val : '#' + val;
    if (isValidHexColor(normalized)) {
      setHighlightError(null);
      setHighlightColor(normalized);
      setHighlightTextColor(normalized);
    } else {
      setHighlightError('#RRGGBB 形式が必要です');
    }
  };

  const handleBgChange = (val: string) => {
    setBgInput(val);
    if (!val.trim()) {
      setBgError('背景色を入力してください。');
      return;
    }
    const normalized = val.startsWith('#') ? val : '#' + val;
    if (isValidHexColor(normalized)) {
      setBgError(null);
      setCustomColors(
        normalized,
        textInput.startsWith('#') ? textInput : '#' + textInput,
        subTextInput.startsWith('#') ? subTextInput : '#' + subTextInput
      );
    } else {
      setBgError('#RRGGBB 形式が必要です');
    }
  };

  const handleTextChange = (val: string) => {
    setTextInput(val);
    if (!val.trim()) {
      setTextError('文字色を入力してください。');
      return;
    }
    const normalized = val.startsWith('#') ? val : '#' + val;
    if (isValidHexColor(normalized)) {
      setTextError(null);
      setCustomColors(
        bgInput.startsWith('#') ? bgInput : '#' + bgInput,
        normalized,
        subTextInput.startsWith('#') ? subTextInput : '#' + subTextInput
      );
    } else {
      setTextError('#RRGGBB 形式が必要です');
    }
  };

  const handleSubTextChange = (val: string) => {
    setSubTextInput(val);
    if (!val.trim()) {
      setSubTextError('サブカラーを入力してください。');
      return;
    }
    const normalized = val.startsWith('#') ? val : '#' + val;
    if (isValidHexColor(normalized)) {
      setSubTextError(null);
      setCustomColors(
        bgInput.startsWith('#') ? bgInput : '#' + bgInput,
        textInput.startsWith('#') ? textInput : '#' + textInput,
        normalized
      );
    } else {
      setSubTextError('#RRGGBB 形式が必要です');
    }
  };

  const applyPreset = (bg: string, text: string, subText: string) => {
    setBgInput(bg);
    setTextInput(text);
    setSubTextInput(subText);
    setBgError(null);
    setTextError(null);
    setSubTextError(null);
    setCustomColors(bg, text, subText);
  };

  const handleSavePalette = () => {
    saveColorPalette(newPaletteName);
    setNewPaletteName('');
    setSavePaletteSuccessMsg(true);
    setTimeout(() => setSavePaletteSuccessMsg(false), 2500);
  };

  const handleApplyPalette = (palette: SavedColorPalette) => {
    applyColorPalette(palette);
    setBgInput(palette.bgColor);
    setTextInput(palette.textColor);
    setSubTextInput(palette.subTextColor);
    setHighlightInput(palette.highlightColor);
    setHighlightTextInput(palette.highlightColor);
    setOtherUsersHighlightInput(palette.otherUsersHighlightColor);
    setBgError(null);
    setTextError(null);
    setSubTextError(null);
    setHighlightError(null);
    setOtherUsersHighlightError(null);
  };

  const handleSaveTypo = () => {
    saveTypographyPreset(newTypoName);
    setNewTypoName('');
    setSaveTypoSuccessMsg(true);
    setTimeout(() => setSaveTypoSuccessMsg(false), 2500);
  };

  const isCustomMode = settings.themeMode === 'custom';
  const previewBg = isCustomMode && isValidHexColor(bgInput.startsWith('#') ? bgInput : '#' + bgInput)
    ? normalizeHexColor(bgInput)
    : effectiveColors.bg;

  const previewText = isCustomMode && isValidHexColor(textInput.startsWith('#') ? textInput : '#' + textInput)
    ? normalizeHexColor(textInput)
    : effectiveColors.text;

  const previewSubText = isCustomMode && isValidHexColor(subTextInput.startsWith('#') ? subTextInput : '#' + subTextInput)
    ? normalizeHexColor(subTextInput)
    : effectiveColors.subText;

  const previewIsDark = getLuminance(previewBg) < 0.35;

  // Distinct preview color for other users that never collapses to user's highlight color
  const previewOtherUsersColor = settings.otherUsersColorMode === 'unified'
    ? (isValidHexColor(otherUsersHighlightInput.startsWith('#') ? otherUsersHighlightInput : '#' + otherUsersHighlightInput)
        ? (otherUsersHighlightInput.startsWith('#') ? otherUsersHighlightInput : '#' + otherUsersHighlightInput)
        : (settings.otherUsersHighlightColor || '#34D399'))
    : (settings.highlightColor.toUpperCase() === '#34D399' ? '#A78BFA' : '#34D399');

  const activeFontFamilyCss = getFontFamilyCss(settings.fontFamily);
  const savedColorPalettes = settings.savedColorPalettes || [];
  const savedTypographyPresets = settings.savedTypographyPresets || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-0 bg-black/20 backdrop-blur-[2px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Slide-in minimal text panel strictly styled with the 3 colors */}
      <aside
        style={{
          backgroundColor: effectiveColors.bg,
          color: effectiveColors.text,
          borderLeft: `1px solid ${effectiveColors.subText}`,
        }}
        className="relative z-10 w-full sm:max-w-md h-full overflow-y-auto px-7 sm:px-10 py-10 sm:py-14 transition-colors text-xs"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between mb-8 pb-3"
          style={{ borderBottom: `1px solid ${effectiveColors.subText}` }}
        >
          <h2 className="text-sm font-medium tracking-tight" style={{ color: effectiveColors.text }}>
            / 閲覧環境設定
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={resetSettings}
              className="hover:underline transition-opacity text-xs"
              style={{ color: effectiveColors.subText }}
              title="初期設定に戻す"
            >
              初期化
            </button>
            <button
              onClick={onClose}
              className="hover:underline transition-opacity text-xs"
              style={{ color: effectiveColors.subText }}
              aria-label="閉じる"
            >
              閉じる
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex gap-4 sm:gap-6 mb-8 font-normal flex-wrap">
          <button
            onClick={() => setActiveTab('theme')}
            className="transition-all hover:underline"
            style={{
              color: activeTab === 'theme' ? effectiveColors.text : effectiveColors.subText,
              fontWeight: activeTab === 'theme' ? 600 : 400,
              textDecoration: activeTab === 'theme' ? 'underline' : 'none',
            }}
          >
            / 配色 (3色・ハイライト)
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className="transition-all hover:underline"
            style={{
              color: activeTab === 'typography' ? effectiveColors.text : effectiveColors.subText,
              fontWeight: activeTab === 'typography' ? 600 : 400,
              textDecoration: activeTab === 'typography' ? 'underline' : 'none',
            }}
          >
            / 書体・余白
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className="transition-all hover:underline"
            style={{
              color: activeTab === 'sync' ? effectiveColors.text : effectiveColors.subText,
              fontWeight: activeTab === 'sync' ? 600 : 400,
              textDecoration: activeTab === 'sync' ? 'underline' : 'none',
            }}
          >
            / 連携 (API)
          </button>
        </div>

        {/* Tab 1: Theme & 3-Color Palette */}
        {activeTab === 'theme' && (
          <div className="space-y-8">
            {/* Theme Mode */}
            <div>
              <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                / モード選択
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                {(
                  [
                    { id: 'light', label: 'ライト' },
                    { id: 'dark', label: 'ダーク' },
                    { id: 'system', label: 'システム連動' },
                    { id: 'custom', label: '直接指定' },
                  ] as const
                ).map((m) => {
                  const isModeActive = settings.themeMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setThemeMode(m.id as ThemeMode)}
                      className="transition-all hover:underline"
                      style={{
                        color: isModeActive ? effectiveColors.text : effectiveColors.subText,
                        fontWeight: isModeActive ? 600 : 400,
                        textDecoration: isModeActive ? 'underline' : 'none',
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Presets - 3-color palette */}
            <div>
              <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                / おすすめ配色プリセット (背景・文字・サブカラー)
              </div>
              <div className="space-y-3">
                {READER_COLOR_PRESETS.map((p) => {
                  const isCurrent =
                    settings.themeMode === 'custom' &&
                    settings.customBgColor.toUpperCase() === p.bgColor.toUpperCase() &&
                    settings.customTextColor.toUpperCase() === p.textColor.toUpperCase() &&
                    settings.customSubTextColor.toUpperCase() === p.subTextColor.toUpperCase();

                  return (
                    <button
                      key={p.name}
                      onClick={() => applyPreset(p.bgColor, p.textColor, p.subTextColor)}
                      className="text-left block w-full py-1.5 transition-all hover:underline"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          {/* 3 color preview dots */}
                          <div className="flex items-center -space-x-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: p.bgColor, borderColor: effectiveColors.subText }}
                              title="背景色"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: p.textColor, borderColor: effectiveColors.subText }}
                              title="文字色"
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: p.subTextColor, borderColor: effectiveColors.subText }}
                              title="サブカラー"
                            />
                          </div>
                          <span
                            style={{
                              color: isCurrent ? effectiveColors.text : effectiveColors.subText,
                              fontWeight: isCurrent ? 600 : 400,
                            }}
                          >
                            {p.label}
                          </span>
                          {isCurrent && (
                            <span style={{ color: effectiveColors.text }} className="text-[10px] font-medium">
                              · 適用中
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[10px]" style={{ color: effectiveColors.subText }}>
                          {p.bgColor}
                        </span>
                      </div>
                      <p className="text-[11px] pl-6 mt-0.5" style={{ color: effectiveColors.subText }}>
                        {p.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Saved Color Palettes (配色の保存リスト: 背景・文字・サブ・自分下線・他者下線) */}
            {savedColorPalettes.length > 0 && (
              <div>
                <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                  / 保存したカラーパレット ({savedColorPalettes.length})
                </div>
                <div className="space-y-3">
                  {savedColorPalettes.map((palette) => {
                    const isCurrent =
                      settings.themeMode === 'custom' &&
                      settings.customBgColor.toUpperCase() === palette.bgColor.toUpperCase() &&
                      settings.customTextColor.toUpperCase() === palette.textColor.toUpperCase() &&
                      settings.customSubTextColor.toUpperCase() === palette.subTextColor.toUpperCase() &&
                      settings.highlightColor.toUpperCase() === palette.highlightColor.toUpperCase() &&
                      settings.otherUsersHighlightColor.toUpperCase() === palette.otherUsersHighlightColor.toUpperCase();

                    return (
                      <div key={palette.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-current/10">
                        <button
                          onClick={() => handleApplyPalette(palette)}
                          className="text-left flex items-center gap-3 hover:underline flex-1 min-w-0 cursor-pointer"
                          title="クリックしてこのカラーパレットを適用"
                        >
                          <div className="flex items-center -space-x-1 shrink-0">
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: palette.bgColor, borderColor: effectiveColors.subText }}
                              title={`背景色: ${palette.bgColor}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: palette.textColor, borderColor: effectiveColors.subText }}
                              title={`文字色: ${palette.textColor}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: palette.subTextColor, borderColor: effectiveColors.subText }}
                              title={`サブカラー: ${palette.subTextColor}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: palette.highlightColor, borderColor: effectiveColors.subText }}
                              title={`自ハイライト: ${palette.highlightColor}`}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full inline-block border"
                              style={{ backgroundColor: palette.otherUsersHighlightColor, borderColor: effectiveColors.subText }}
                              title={`他者ハイライト: ${palette.otherUsersHighlightColor}`}
                            />
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="truncate text-xs"
                                style={{
                                  color: isCurrent ? effectiveColors.text : effectiveColors.subText,
                                  fontWeight: isCurrent ? 600 : 400,
                                }}
                              >
                                {palette.name}
                              </span>
                              {isCurrent && (
                                <span style={{ color: effectiveColors.text }} className="text-[10px] font-medium shrink-0">
                                  ✓ 適用中
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono opacity-75 truncate" style={{ color: effectiveColors.subText }}>
                              {palette.bgColor} / {palette.textColor} / {palette.highlightColor}
                            </div>
                          </div>
                        </button>

                        <button
                          onClick={() => deleteColorPalette(palette.id)}
                          className="hover:underline text-[11px] shrink-0 cursor-pointer"
                          style={{ color: effectiveColors.subText }}
                          title="このカラーパレットを削除"
                        >
                          [削除 ×]
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct HEX 3-Color Inputs & Save Palette Button */}
            <div>
              <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                / 3色HEXカラーコード直接入力
              </div>

              <div className="space-y-4">
                {/* 1. Background HEX */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: effectiveColors.subText }}>
                    <span>1. 背景色 (Background)</span>
                    <span className="font-mono" style={{ color: effectiveColors.text }}>{previewBg}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-xs border shrink-0"
                      style={{ backgroundColor: previewBg, borderColor: effectiveColors.subText }}
                    />
                    <input
                      type="text"
                      value={bgInput}
                      onChange={(e) => handleBgChange(e.target.value)}
                      placeholder="#FFFFFF"
                      maxLength={7}
                      className="w-full py-1 font-mono text-xs"
                      style={{
                        color: effectiveColors.text,
                        borderBottom: `1px solid ${effectiveColors.subText}`,
                      }}
                    />
                  </div>
                  {bgError && <p className="text-[11px] text-red-500 mt-1">{bgError}</p>}
                </div>

                {/* 2. Main Text HEX */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: effectiveColors.subText }}>
                    <span>2. 文字色 (本文・タイトル)</span>
                    <span className="font-mono" style={{ color: effectiveColors.text }}>{previewText}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-xs border shrink-0"
                      style={{ backgroundColor: previewText, borderColor: effectiveColors.subText }}
                    />
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => handleTextChange(e.target.value)}
                      placeholder="#1A1A1A"
                      maxLength={7}
                      className="w-full py-1 font-mono text-xs"
                      style={{
                        color: effectiveColors.text,
                        borderBottom: `1px solid ${effectiveColors.subText}`,
                      }}
                    />
                  </div>
                  {textError && <p className="text-[11px] text-red-500 mt-1">{textError}</p>}
                </div>

                {/* 3. Sub Text Color HEX */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: effectiveColors.subText }}>
                    <span>3. 文字色2 (サブカラー: 日付・概要・メタ情報)</span>
                    <span className="font-mono" style={{ color: effectiveColors.subText }}>{previewSubText}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-xs border shrink-0"
                      style={{ backgroundColor: previewSubText, borderColor: effectiveColors.subText }}
                    />
                    <input
                      type="text"
                      value={subTextInput}
                      onChange={(e) => handleSubTextChange(e.target.value)}
                      placeholder="#737373"
                      maxLength={7}
                      className="w-full py-1 font-mono text-xs"
                      style={{
                        color: effectiveColors.text,
                        borderBottom: `1px solid ${effectiveColors.subText}`,
                      }}
                    />
                  </div>
                  {subTextError && <p className="text-[11px] text-red-500 mt-1">{subTextError}</p>}
                </div>

                {/* 4. My Highlighter Underline & Text Color (自分の蛍光ペン: 下線＋文字色) */}
                <div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: effectiveColors.subText }}>
                    <span>4. 自分の蛍光ペン（下線＋文字色）</span>
                    <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.highlightColor}</span>
                  </div>

                  {/* Pastel presets */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {HIGHLIGHT_COLOR_PRESETS.map((preset) => {
                      const isSel = settings.highlightColor.toUpperCase() === preset.color.toUpperCase();
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setHighlightInput(preset.color);
                            setHighlightColor(preset.color);
                            setHighlightTextColor(preset.color);
                            setHighlightError(null);
                          }}
                          className={`px-2 py-0.5 text-[11px] rounded-none border transition-all cursor-pointer ${
                            isSel ? 'font-medium underline' : 'opacity-85'
                          }`}
                          style={{
                            backgroundColor: preset.color,
                            color: '#1A1A1A',
                            borderColor: isSel ? '#1A1A1A' : 'transparent',
                          }}
                          title={preset.name}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom HEX input */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-xs border shrink-0"
                      style={{ backgroundColor: settings.highlightColor, borderColor: effectiveColors.subText }}
                    />
                    <input
                      type="text"
                      value={highlightInput}
                      onChange={(e) => handleHighlightChange(e.target.value)}
                      placeholder="#FFE57F"
                      maxLength={7}
                      className="w-full py-1 font-mono text-xs"
                      style={{
                        color: effectiveColors.text,
                        borderBottom: `1px solid ${effectiveColors.subText}`,
                      }}
                    />
                  </div>
                  {highlightError && <p className="text-[11px] text-red-500 mt-1">{highlightError}</p>}
                </div>

                {/* 5. Other Users' Highlighter & Memos (他ユーザーの蛍光ペン: 下線＋文字色) */}
                <div className="pt-2 border-t" style={{ borderColor: effectiveColors.subText }}>
                  <div className="flex justify-between text-xs mb-2 font-medium" style={{ color: effectiveColors.subText }}>
                    <span>5. 他ユーザーの蛍光ペン（下線＋文字色）</span>
                    <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.otherUsersHighlightColor}</span>
                  </div>

                  {/* Presets for other users */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                    {OTHER_USERS_COLOR_PRESETS.map((p) => {
                      const isSel = settings.otherUsersHighlightColor.toUpperCase() === p.color.toUpperCase();
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setOtherUsersHighlightInput(p.color);
                            setOtherUsersHighlightColor(p.color);
                            setOtherUsersHighlightError(null);
                          }}
                          className={`px-2 py-0.5 text-[10.5px] rounded-none border transition-all cursor-pointer ${
                            isSel ? 'font-medium underline' : 'opacity-85'
                          }`}
                          style={{
                            backgroundColor: p.color,
                            color: '#1A1A1A',
                            borderColor: isSel ? '#1A1A1A' : 'transparent',
                          }}
                          title={p.name}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom HEX for other users */}
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-xs border shrink-0"
                      style={{ backgroundColor: settings.otherUsersHighlightColor, borderColor: effectiveColors.subText }}
                    />
                    <input
                      type="text"
                      value={otherUsersHighlightInput}
                      onChange={(e) => handleOtherUsersHighlightChange(e.target.value)}
                      placeholder="#34D399"
                      maxLength={7}
                      className="w-full py-1 font-mono text-xs"
                      style={{
                        color: effectiveColors.text,
                        borderBottom: `1px solid ${effectiveColors.subText}`,
                      }}
                    />
                  </div>
                  {otherUsersHighlightError && <p className="text-[11px] text-red-500 mt-1">{otherUsersHighlightError}</p>}
                </div>
              </div>

              {/* Save Current Color Palette Section (配色の保存) */}
              <div
                className="mt-6 pt-4 space-y-2.5"
                style={{ borderTop: `1px solid ${effectiveColors.subText}` }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium block" style={{ color: effectiveColors.text }}>
                      / 配色の保存 (カラーパレット)
                    </span>
                    <span className="text-[10px]" style={{ color: effectiveColors.subText }}>
                      ※ 背景色・文字色・サブカラー・自分の蛍光ペン・他者の蛍光ペン色を保存します
                    </span>
                  </div>
                  {savePaletteSuccessMsg && (
                    <span className="text-[11px] font-medium" style={{ color: effectiveColors.text }}>
                      ✓ 保存完了
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newPaletteName}
                    onChange={(e) => setNewPaletteName(e.target.value)}
                    placeholder="パレット名 (任意: 例：深夜読書・アンバー)"
                    className="flex-1 py-1 text-xs"
                    style={{
                      color: effectiveColors.text,
                      borderBottom: `1px solid ${effectiveColors.subText}`,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePalette();
                    }}
                  />
                  <button
                    onClick={handleSavePalette}
                    className="hover:underline font-medium text-xs shrink-0 py-1 cursor-pointer"
                    style={{ color: effectiveColors.text }}
                  >
                    [パレットを保存 ＋]
                  </button>
                </div>
              </div>

              {/* ONE Unified Comprehensive Live Preview Swatch (3色＋自分・他者のハイライト＆メモ総合プレビュー) */}
              <div
                className="mt-6 pt-4 text-xs leading-relaxed space-y-3.5 border p-3.5 transition-colors"
                style={{
                  backgroundColor: previewBg,
                  color: previewText,
                  fontFamily: activeFontFamilyCss,
                  borderColor: `${previewSubText}40`,
                }}
              >
                <div className="text-[11px] font-medium flex items-center justify-between" style={{ color: previewSubText }}>
                  <span>/ 配色・ハイライト総合プレビュー</span>
                  <span className="font-mono text-[10px]">{previewIsDark ? 'ダーク系背景' : 'ライト系背景'}</span>
                </div>

                {/* Title in Main Color */}
                <div className="font-medium text-sm" style={{ color: previewText }}>
                  / 第一章　古書店の最後の灯火
                </div>

                {/* Metadata in Sub Color */}
                <div className="text-[11px]" style={{ color: previewSubText }}>
                  2026. 03. 15. · 連載 (全4話) · #ミステリー #古書
                </div>

                {/* Summary / Body in Sub Color */}
                <p className="text-xs leading-relaxed" style={{ color: previewSubText }}>
                  街の片隅にある古い古書店。夜ごと整理されない草稿の中から、過去の声が静かに響いてくる。
                </p>

                {/* Prose Body with My Highlight and Other User's Highlight */}
                <div className="text-xs leading-relaxed space-y-2 pt-1" style={{ color: previewText }}>
                  <p>
                    「読む者がたとえたった一人であっても、
                    <span
                      className="inline"
                      style={{
                        borderBottom: `2px solid ${settings.highlightColor}`,
                        backgroundColor: `${settings.highlightColor}33`,
                      }}
                    >
                      言葉の記録
                    </span>
                    <span
                      className="inline ml-1.5 font-normal align-baseline"
                      style={{
                        color: settings.highlightColor,
                        fontSize: `${settings.memoFontSize || 12}px`,
                      }}
                    >
                      <span className="mr-1">自分のメモ</span>
                      <span className="inline-flex items-center gap-1 px-1 py-0.5 border text-[10.5px] align-baseline mr-1" style={{ borderColor: settings.highlightColor, backgroundColor: `${settings.highlightColor}20` }}><span>👏</span><span className="font-mono font-semibold">7</span></span>
                      <span className="opacity-60">[×]</span>
                    </span>
                    は沈黙よりも深い真実を宿す」
                  </p>

                  <p>
                    「夜が深まる頃、
                    <span
                      className="inline"
                      style={{
                        borderBottom: `2px solid ${previewOtherUsersColor}`,
                        backgroundColor: `${previewOtherUsersColor}33`,
                      }}
                    >
                      静かに紡がれた記録
                    </span>
                    <span
                      className="inline ml-1.5 font-normal align-baseline"
                      style={{
                        color: previewOtherUsersColor,
                        fontSize: `${settings.memoFontSize || 12}px`,
                      }}
                    >
                      他読者のメモ
                    </span>
                    が灯火の下に残る」
                  </p>
                </div>

                {/* Multiply Overlay Visual Example (乗算ブレンドの実際の視覚例) */}
                <div
                  className="pt-2.5 border-t text-xs leading-relaxed space-y-1"
                  style={{ borderColor: `${previewSubText}30` }}
                >
                  <div className="text-[10px] font-mono" style={{ color: previewSubText }}>
                    / 乗算ブレンド（mix-blend-mode: multiply）の重なり表示例:
                  </div>
                  <p>
                    「
                    <span
                      className="inline relative"
                      style={{
                        borderBottom: `2.5px solid ${settings.highlightColor}`,
                      }}
                    >
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundColor: settings.highlightColor,
                          opacity: 0.45,
                          mixBlendMode: previewIsDark ? 'screen' : 'multiply',
                        }}
                      />
                      <span
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundColor: previewOtherUsersColor,
                          opacity: 0.45,
                          mixBlendMode: previewIsDark ? 'screen' : 'multiply',
                        }}
                      />
                      <span className="relative z-10 font-medium">重なり合う二つのハイライト文</span>
                    </span>
                    」のように、文章を複製せず実物の蛍光ペンのように色が掛け合わさります。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Typography & Layout (書体・余白) */}
        {activeTab === 'typography' && (
          <div className="space-y-8">
            {/* 1. Main Japanese Font Family */}
            <div>
              <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                / 本文書体選択 (作品一覧・本文共通)
              </div>
              <div className="space-y-3.5">
                {JAPANESE_FONT_OPTIONS.map((f) => {
                  const isSelected =
                    settings.fontFamily === f.id || (f.id === 'shippori' && settings.fontFamily === 'serif');

                  return (
                    <button
                      key={f.id}
                      onClick={() => updateSettings({ fontFamily: f.id as ReaderFontFamily })}
                      className="text-left block w-full py-1 group hover:underline"
                    >
                      <div className="flex items-baseline justify-between">
                        <span
                          className="text-sm transition-all"
                          style={{
                            fontFamily: f.fontFamily,
                            color: isSelected ? effectiveColors.text : effectiveColors.subText,
                            fontWeight: isSelected ? 600 : 400,
                            textDecoration: isSelected ? 'underline' : 'none',
                          }}
                        >
                          {f.name}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: effectiveColors.subText }}>
                          {f.category}
                          {isSelected && ' · 選択中'}
                        </span>
                      </div>
                      <p className="text-[11px] mt-0.5 leading-snug" style={{ color: effectiveColors.subText }}>
                        {f.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Main Font Size (min 8) */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                <span>文字サイズ (作品一覧・本文共通)</span>
                <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.fontSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={26}
                step={1}
                value={settings.fontSize}
                onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                <span>極小 (8px)</span>
                <span>標準 (16px)</span>
                <span>特大 (26px)</span>
              </div>
            </div>

            {/* 3. Line Height (min 1.0) */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                <span>行間 (行の高さ)</span>
                <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.lineHeight.toFixed(2)}倍</span>
              </div>
              <input
                type="range"
                min={1.0}
                max={2.4}
                step={0.05}
                value={settings.lineHeight}
                onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                <span>詰める (1.00倍)</span>
                <span>標準 (1.85倍)</span>
                <span>広め (2.40倍)</span>
              </div>
            </div>

            {/* 4. Letter Spacing (min -0.10) */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                <span>文字間隔 (字間)</span>
                <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.letterSpacing.toFixed(2)}em</span>
              </div>
              <input
                type="range"
                min={-0.10}
                max={0.06}
                step={0.01}
                value={settings.letterSpacing}
                onChange={(e) => updateSettings({ letterSpacing: Number(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                <span>詰める (-0.10em)</span>
                <span>標準 (0.01em)</span>
                <span>広め (0.06em)</span>
              </div>
            </div>

            {/* 5. Paragraph Spacing (段落の間隔) */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                <span>段落の間隔 (段落余白)</span>
                <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.paragraphSpacing.toFixed(2)}rem</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.25}
                value={settings.paragraphSpacing}
                onChange={(e) => updateSettings({ paragraphSpacing: Number(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                <span>狭め (0.50rem)</span>
                <span>標準 (1.25rem)</span>
                <span>広め (3.00rem)</span>
              </div>
            </div>

            {/* 6. Content Width (本文・一覧の最大横幅: 段落の間隔の次に配置) */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                <span>本文・一覧の最大横幅 (余白)</span>
                <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.contentWidth}px</span>
              </div>
              <input
                type="range"
                min={100}
                max={860}
                step={20}
                value={settings.contentWidth}
                onChange={(e) => updateSettings({ contentWidth: Number(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                <span>余白大 (100px)</span>
                <span>標準 (680px)</span>
                <span>余白小 (860px)</span>
              </div>
            </div>

            {/* 7. Memo Typography Settings (インラインメモ専用書体・サイズ: 文字間隔・段落間隔の直後に配置) */}
            <div className="pt-4 border-t" style={{ borderColor: effectiveColors.subText }}>
              <div className="text-xs mb-3 font-medium" style={{ color: effectiveColors.subText }}>
                / インラインメモの書体設定 (字種・サイズ)
              </div>

              {/* Memo Font Family */}
              <div className="mb-4">
                <div className="text-[11px] mb-2 opacity-80" style={{ color: effectiveColors.subText }}>
                  メモの書体
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {JAPANESE_FONT_OPTIONS.map((f) => {
                    const isSel = (settings.memoFontFamily || 'sans') === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateSettings({ memoFontFamily: f.id as ReaderFontFamily })}
                        className="px-2.5 py-1 text-xs border cursor-pointer hover:underline transition-all"
                        style={{
                          borderColor: isSel ? effectiveColors.text : effectiveColors.subText,
                          color: isSel ? effectiveColors.text : effectiveColors.subText,
                          fontWeight: isSel ? 600 : 400,
                          backgroundColor: isSel
                            ? effectiveColors.isDark
                              ? 'rgba(255,255,255,0.08)'
                              : 'rgba(0,0,0,0.05)'
                            : 'transparent',
                        }}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Memo Font Size */}
              <div>
                <div className="flex justify-between text-xs mb-1.5" style={{ color: effectiveColors.subText }}>
                  <span>メモの文字サイズ</span>
                  <span className="font-mono" style={{ color: effectiveColors.text }}>{settings.memoFontSize || 12}px</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={20}
                  step={1}
                  value={settings.memoFontSize || 12}
                  onChange={(e) => updateSettings({ memoFontSize: Number(e.target.value) })}
                />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: effectiveColors.subText }}>
                  <span>最小 (8px)</span>
                  <span>標準 (12px)</span>
                  <span>大 (20px)</span>
                </div>
              </div>
            </div>

            {/* 8. Progress bar toggle */}
            <div className="pt-2 flex items-center justify-between">
              <span style={{ color: effectiveColors.subText }}>上部スクロール進行線</span>
              <button
                onClick={() => updateSettings({ showProgressBar: !settings.showProgressBar })}
                className="hover:underline transition-opacity cursor-pointer"
                style={{ color: effectiveColors.text }}
              >
                {settings.showProgressBar ? '表示 [オン]' : '非表示 [オフ]'}
              </button>
            </div>

            {/* 9. Save Current Typography & Spacing (書体・余白の保存) */}
            <div
              className="pt-4 mt-6 border-t space-y-4"
              style={{ borderColor: effectiveColors.subText }}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium block" style={{ color: effectiveColors.text }}>
                      / 書体・余白の保存 (タイポグラフィプリセット)
                    </span>
                    <span className="text-[10px]" style={{ color: effectiveColors.subText }}>
                      ※ 書体・文字サイズ・行間・字間・段落余白・横幅・メモ書体/サイズを保存します
                    </span>
                  </div>
                  {saveTypoSuccessMsg && (
                    <span className="text-[11px] font-medium" style={{ color: effectiveColors.text }}>
                      ✓ 保存完了
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newTypoName}
                    onChange={(e) => setNewTypoName(e.target.value)}
                    placeholder="プリセット名 (任意: 例：明朝・ワイド余白)"
                    className="flex-1 py-1 text-xs"
                    style={{
                      color: effectiveColors.text,
                      borderBottom: `1px solid ${effectiveColors.subText}`,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTypo();
                    }}
                  />
                  <button
                    onClick={handleSaveTypo}
                    className="hover:underline font-medium text-xs shrink-0 py-1 cursor-pointer"
                    style={{ color: effectiveColors.text }}
                  >
                    [プリセットを保存 ＋]
                  </button>
                </div>
              </div>

              {/* Saved Typography Presets List */}
              {savedTypographyPresets.length > 0 && (
                <div className="pt-3 border-t space-y-2.5" style={{ borderColor: `${effectiveColors.subText}30` }}>
                  <div className="text-xs font-medium" style={{ color: effectiveColors.subText }}>
                    / 保存した書体・余白プリセット ({savedTypographyPresets.length})
                  </div>
                  <div className="space-y-2.5">
                    {savedTypographyPresets.map((preset) => {
                      const isCurrent =
                        settings.fontFamily === preset.fontFamily &&
                        settings.fontSize === preset.fontSize &&
                        settings.contentWidth === preset.contentWidth &&
                        settings.lineHeight === preset.lineHeight &&
                        settings.paragraphSpacing === preset.paragraphSpacing &&
                        settings.memoFontSize === preset.memoFontSize;

                      const fontName = JAPANESE_FONT_OPTIONS.find((f) => f.id === preset.fontFamily)?.name || 'しっぽり明朝';

                      return (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between gap-3 py-1.5 border-b border-current/10"
                        >
                          <button
                            onClick={() => applyTypographyPreset(preset)}
                            className="text-left flex-1 min-w-0 hover:underline cursor-pointer"
                            title="クリックしてこの書体・余白設定を適用"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="truncate text-xs"
                                style={{
                                  color: isCurrent ? effectiveColors.text : effectiveColors.subText,
                                  fontWeight: isCurrent ? 600 : 400,
                                }}
                              >
                                {preset.name}
                              </span>
                              {isCurrent && (
                                <span style={{ color: effectiveColors.text }} className="text-[10px] font-medium shrink-0">
                                  ✓ 適用中
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] opacity-75 truncate" style={{ color: effectiveColors.subText }}>
                              {fontName} · {preset.fontSize}px · {preset.contentWidth}px幅 · 行間{preset.lineHeight} · 段落余白{preset.paragraphSpacing}em
                            </div>
                          </button>

                          <button
                            onClick={() => deleteTypographyPreset(preset.id)}
                            className="hover:underline text-[11px] shrink-0 cursor-pointer"
                            style={{ color: effectiveColors.subText }}
                            title="このプリセットを削除"
                          >
                            [削除 ×]
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Safe Whitelist API Sync */}
        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div>
              <div className="text-xs mb-2 font-medium" style={{ color: effectiveColors.subText }}>
                / Google Apps Script 安全連携
              </div>
              <p className="text-[11px] leading-relaxed mb-4" style={{ color: effectiveColors.subText }}>
                Google ドライブの非公開設定を保ったまま、スプレッドシートの小説リストと Google Docs 原稿を安全に配信するウェブアプリURLを設定します。
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] block font-mono" style={{ color: effectiveColors.subText }}>
                Web App URL (exec)
              </label>
              <input
                type="text"
                value={proxyUrlInput}
                onChange={(e) => {
                  setProxyUrlInput(e.target.value);
                  setSyncStatusMsg(null);
                }}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full text-xs font-mono px-3 py-2 border rounded-none outline-none transition-colors"
                style={{
                  backgroundColor: effectiveColors.bg,
                  color: effectiveColors.text,
                  borderColor: effectiveColors.subText,
                }}
              />
              <p className="text-[10px] leading-relaxed" style={{ color: effectiveColors.subText }}>
                ※ 末尾が <code>/exec</code> で終わるデプロイURLを入力してください。
              </p>
            </div>

            {syncStatusMsg && (
              <div className="text-xs py-1" style={{ color: syncStatusMsg.startsWith('✓') ? effectiveColors.text : '#E53E3E' }}>
                {syncStatusMsg}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-normal">
              <button
                type="button"
                disabled={isTestingSync || !proxyUrlInput.trim()}
                onClick={async () => {
                  if (!proxyUrlInput.trim()) return;
                  setIsTestingSync(true);
                  setSyncStatusMsg('接続確認中…');
                  try {
                    // Test fetch
                    await fetchCatalogFromGas(proxyUrlInput.trim(), 'test@check.internal');
                    saveGasProxyUrl(proxyUrlInput.trim());
                    setSyncStatusMsg('✓ 接続成功: 安全プロキシが保存されました。');
                    if (onSavedUrlChange) onSavedUrlChange();
                  } catch (err: any) {
                    // Even if permission denied for test email, it means API is live and working!
                    if (err.isPermissionDenied || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('閲覧権限')) {
                      saveGasProxyUrl(proxyUrlInput.trim());
                      setSyncStatusMsg('✓ 接続確認完了: APIが正常に応答しています（認証連携有効）。');
                      if (onSavedUrlChange) onSavedUrlChange();
                    } else {
                      setSyncStatusMsg(`接続失敗: ${err.message || 'URLを確認してください'}`);
                    }
                  } finally {
                    setIsTestingSync(false);
                  }
                }}
                className="cursor-pointer tracking-wider hover:opacity-75 transition-opacity pb-0.5 border-b font-medium"
                style={{ color: effectiveColors.text, borderColor: effectiveColors.text }}
              >
                {isTestingSync ? '接続テスト中…' : '[ 接続をテスト・保存 ＋ ]'}
              </button>

              {getSavedGasProxyUrl() && (
                <button
                  type="button"
                  onClick={() => {
                    saveGasProxyUrl('');
                    setProxyUrlInput('');
                    setSyncStatusMsg('連携を解除し、サンプル作品に戻しました。');
                    if (onSavedUrlChange) onSavedUrlChange();
                  }}
                  className="cursor-pointer tracking-wider hover:opacity-75 transition-opacity pb-0.5"
                  style={{ color: effectiveColors.subText }}
                >
                  [ 連携を解除 ]
                </button>
              )}
            </div>

            {/* Collapsible GAS Pure Readonly Script Guide */}
            <div
              className="mt-8 pt-6 border-t"
              style={{ borderColor: effectiveColors.subText }}
            >
              <button
                type="button"
                onClick={() => setShowGasGuide(!showGasGuide)}
                className="hover:underline font-medium text-xs flex items-center justify-between w-full text-left"
                style={{ color: effectiveColors.text }}
              >
                <span>/ 純粋読み取り専用 (.readonly) GAS スクリプトガイド</span>
                <span className="font-mono text-[11px]" style={{ color: effectiveColors.subText }}>
                  {showGasGuide ? '[ 閉じる − ]' : '[ ガイド・コードを見る ＋ ]'}
                </span>
              </button>

              {showGasGuide && (
                <div className="mt-4 space-y-4 text-[11px] leading-relaxed" style={{ color: effectiveColors.subText }}>
                  <div className="p-3 bg-black/5 dark:bg-white/5 border border-current text-[11px] space-y-1.5">
                    <p className="font-medium" style={{ color: effectiveColors.text }}>
                      💡 「Google Docs 403 閲覧権限エラー」の解決方法
                    </p>
                    <p>
                      純粋読み取り専用（.readonly）でGoogle Docsを取得するには、Google公式の<strong>「Docs API」</strong>サービス経由で取得する必要があります。
                    </p>
                    <p>
                      下の <code>appsscript.json</code> にはDocsサービス自動有効化設定（<code>enabledAdvancedServices</code>）が組み込まれています。貼り付けるだけで、<strong>「編集・削除権限なしの純粋閲覧権限」</strong>で安全にタブ原稿を取得できます。
                    </p>
                  </div>

                  {/* Step 1: Manifest */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: effectiveColors.text }}>
                        1. appsscript.json (マニフェスト設定)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyGas('manifest')}
                        className="hover:underline font-medium text-[10px]"
                        style={{ color: effectiveColors.text }}
                      >
                        {copiedGasItem === 'manifest' ? '✓ コピーしました' : '[ マニフェストをコピー ]'}
                      </button>
                    </div>
                    <pre
                      className="p-2.5 text-[10px] font-mono overflow-x-auto max-h-36 bg-black/5 dark:bg-white/5 border border-current select-all"
                      style={{ color: effectiveColors.text }}
                    >
                      {GAS_MANIFEST_JSON}
                    </pre>
                  </div>

                  {/* Step 2: Code.gs */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium" style={{ color: effectiveColors.text }}>
                        2. Code.gs (純粋読み取り専用スクリプト本体)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyGas('script')}
                        className="hover:underline font-medium text-[10px]"
                        style={{ color: effectiveColors.text }}
                      >
                        {copiedGasItem === 'script' ? '✓ コピーしました' : '[ Code.gs をコピー ]'}
                      </button>
                    </div>
                    <pre
                      className="p-2.5 text-[10px] font-mono overflow-x-auto max-h-48 bg-black/5 dark:bg-white/5 border border-current select-all"
                      style={{ color: effectiveColors.text }}
                    >
                      {GAS_READONLY_SCRIPT}
                    </pre>
                  </div>

                  {/* Step 3: Deployment instructions */}
                  <div className="pt-2 text-[10px] space-y-1 opacity-90">
                    <p><strong>反映手順:</strong></p>
                    <p>① GASエディタで <code>appsscript.json</code> と <code>Code.gs</code> を上記内容に置き換えます（※もし左メニューに「サービス」があれば「Google Docs API」を追加しておくとさらに安定します）。</p>
                    <p>② 上部ツールバーの関数選択で <code>authorizeNow</code> を選んで「実行」を押し、権限を承認します（「閲覧のみ」と表示されます）。</p>
                    <p>③ 右上の「デプロイ」＞「新しいデプロイ」＞ウェブアプリとして「デプロイ」を実行し、新しいURLを本設定画面に入力してください。</p>
                    <p className="text-[9.5px] opacity-75">※ 原稿Google Docsファイルが、GASをデプロイしたGoogleアカウントから「閲覧」できる権限（またはリンクを知っている全員が閲覧可能）になっていることも併せてご確認ください。</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="mt-12 pt-4 flex justify-end"
          style={{ borderTop: `1px solid ${effectiveColors.subText}` }}
        >
          <button
            onClick={onClose}
            className="hover:underline transition-opacity py-1 font-medium"
            style={{ color: effectiveColors.subText }}
          >
            / 閉じる
          </button>
        </div>
      </aside>
    </div>
  );
};
