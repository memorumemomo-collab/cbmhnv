import React from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { Sun, Moon, Menu, RotateCw, LogOut, Highlighter, Bookmark } from 'lucide-react';
import { HighlightFilterMode } from '../types/novel';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenInfo: () => void;
  onGoHome: () => void;
  onOpenHighlights?: () => void;
  isHighlightsView?: boolean;
  activeWorkTitle?: string;
  activeEpisodeTitle?: string;
  isReading?: boolean;
  userEmail?: string | null;
  onRefresh?: () => void;
  onLogout?: () => void;
  isRefreshing?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onGoHome,
  onOpenHighlights,
  isHighlightsView,
  activeWorkTitle,
  activeEpisodeTitle,
  isReading,
  userEmail,
  onRefresh,
  onLogout,
  isRefreshing,
}) => {
  const {
    effectiveColors,
    settings,
    setThemeMode,
    setHighlightFilterMode,
  } = useReaderSettings();

  const handleCycleHighlightFilter = () => {
    const modes: HighlightFilterMode[] = ['all', 'mine', 'others', 'none'];
    const currentIdx = modes.indexOf(settings.highlightFilterMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    setHighlightFilterMode(nextMode);
  };

  const getHighlightFilterLabel = () => {
    switch (settings.highlightFilterMode) {
      case 'all':
        return '全て';
      case 'mine':
        return '自分のみ';
      case 'others':
        return '他者のみ';
      case 'none':
        return '非表示';
    }
  };

  const getHighlighterColor = () => {
    switch (settings.highlightFilterMode) {
      case 'none':
        return effectiveColors.subText;
      case 'others':
        return settings.otherUsersHighlightColor || '#60A5FA';
      case 'mine':
        return settings.highlightColor;
      case 'all':
      default:
        return settings.highlightColor;
    }
  };

  const handleQuickThemeToggle = () => {
    if (settings.themeMode === 'light') {
      setThemeMode('dark');
    } else if (settings.themeMode === 'dark') {
      setThemeMode('system');
    } else {
      setThemeMode('light');
    }
  };

  const getThemeLabel = () => {
    switch (settings.themeMode) {
      case 'light':
        return 'ライト';
      case 'dark':
        return 'ダーク';
      case 'system':
        return 'システム連動';
      default:
        return 'カスタム';
    }
  };

  return (
    <header className="w-full fixed top-0 left-0 right-0 z-30 pointer-events-none">
      <div className="w-full px-5 sm:px-10 lg:px-12 py-5 sm:py-6 flex items-center justify-between">
        {/* Left: Minimal site anchor / breadcrumb */}
        <div className="pointer-events-auto flex items-center gap-2 text-xs font-normal tracking-tight">
          <button
            onClick={onGoHome}
            className="hover:underline transition-opacity font-medium"
            style={{ color: effectiveColors.text }}
            title="書斎のトップへ"
          >
            / 書斎
          </button>

          {activeWorkTitle && (
            <>
              <span style={{ color: effectiveColors.subText }}>/</span>
              <button
                onClick={onGoHome}
                className="hover:underline transition-opacity truncate max-w-[120px] sm:max-w-[200px]"
                style={{ color: effectiveColors.subText }}
              >
                {activeWorkTitle}
              </button>
            </>
          )}

          {activeEpisodeTitle && (
            <>
              <span style={{ color: effectiveColors.subText }}>/</span>
              <span className="truncate max-w-[100px] sm:max-w-[180px]" style={{ color: effectiveColors.subText }}>
                {activeEpisodeTitle}
              </span>
            </>
          )}
        </div>

        {/* Right: Controls (Refresh, Theme, Settings, User/Logout) */}
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4 text-xs font-normal">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className={`hover:opacity-100 transition-opacity p-1 ${isRefreshing ? 'animate-spin' : ''}`}
              style={{ color: effectiveColors.subText }}
              title="Googleスプレッドシートの最新データを再取得"
              aria-label="更新"
            >
              <RotateCw size={14} />
            </button>
          )}

          {/* Highlighter filter toggle (All / Mine / Others / None) */}
          <button
            onClick={handleCycleHighlightFilter}
            className="hover:opacity-100 transition-opacity p-1 flex items-center gap-1 cursor-pointer"
            style={{
              color: settings.highlightFilterMode === 'none' ? effectiveColors.subText : getHighlighterColor(),
              opacity: settings.highlightFilterMode === 'none' ? 0.45 : 1,
            }}
            title={`蛍光ペン・メモ表示切替: 現在【${getHighlightFilterLabel()}】(クリックで切替)`}
            aria-label="蛍光ペンの表示切替"
          >
            <Highlighter
              size={15}
              style={{
                color: getHighlighterColor(),
              }}
            />
            <span
              className="hidden sm:inline text-[10px] font-mono"
              style={{
                color: getHighlighterColor(),
              }}
            >
              {getHighlightFilterLabel()}
            </span>
          </button>

          {/* Highlight & Comments Collection Page Button */}
          {onOpenHighlights && (
            <button
              onClick={onOpenHighlights}
              className="hover:opacity-100 transition-opacity p-1 flex items-center gap-1 cursor-pointer"
              style={{
                color: isHighlightsView ? effectiveColors.text : effectiveColors.subText,
                fontWeight: isHighlightsView ? 600 : 400,
                textDecoration: isHighlightsView ? 'underline' : 'none',
              }}
              title="抜粋・感想録 (ハイライト＆コメント一覧)"
              aria-label="抜粋・感想録を開く"
            >
              <Bookmark size={15} />
              <span className="hidden sm:inline text-[10px] font-mono">
                抜粋録
              </span>
            </button>
          )}

          <button
            onClick={handleQuickThemeToggle}
            className="hover:opacity-100 transition-opacity p-1"
            style={{ color: effectiveColors.subText }}
            title={`テーマ切り替え (現在: ${getThemeLabel()})`}
            aria-label="テーマ切り替え"
          >
            {effectiveColors.isDark ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          <button
            onClick={onOpenSettings}
            className="hover:opacity-100 transition-opacity p-1 flex items-center gap-1"
            style={{ color: effectiveColors.subText }}
            title="閲覧環境設定"
            aria-label="設定メニューを開く"
          >
            <Menu size={16} />
          </button>

          {onLogout && userEmail && (
            <button
              onClick={onLogout}
              className="hover:opacity-100 transition-opacity p-1"
              style={{ color: effectiveColors.subText }}
              title={`退出（${userEmail} からログアウト）`}
              aria-label="ログアウト"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
