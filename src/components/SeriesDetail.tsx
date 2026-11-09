import React from 'react';
import { NovelWork } from '../types/novel';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { getFontFamilyCss } from '../utils/fontHelper';

interface SeriesDetailProps {
  work: NovelWork;
  onBack: () => void;
  onSelectEpisode: (tabId: string) => void;
  isLoadingEpisodes?: boolean;
  episodesError?: string;
  onRetry?: () => void;
}

export const SeriesDetail: React.FC<SeriesDetailProps> = ({
  work,
  onBack,
  onSelectEpisode,
  isLoadingEpisodes = false,
  episodesError,
  onRetry,
}) => {
  const { effectiveColors, settings } = useReaderSettings();
  const activeFontFamily = getFontFamilyCss(settings.fontFamily);

  // Sort episodes by order (reflecting Google Docs tab order)
  const sortedEpisodes = [...(work.episodes || [])].sort((a, b) => a.order - b.order);

  return (
    <div
      className="mx-auto w-full max-w-full overflow-x-hidden min-h-screen px-5 sm:px-10 lg:px-12 pt-24 sm:pt-36 lg:pt-44 pb-36 transition-all"
      style={{
        maxWidth: `min(100%, ${settings.contentWidth}px)`,
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
        letterSpacing: `${settings.letterSpacing}em`,
        fontFamily: activeFontFamily,
        color: effectiveColors.text,
        boxSizing: 'border-box',
      }}
    >
      {/* Return link in Sub Color */}
      <nav className="mb-14">
        <button
          onClick={onBack}
          className="text-[0.82em] hover:underline transition-opacity py-1 flex items-center gap-1"
          style={{ color: effectiveColors.subText }}
        >
          <span>←</span>
          <span>作品一覧に戻る</span>
        </button>
      </nav>

      {/* Series Header */}
      <header className="mb-20 sm:mb-24">
        {/* Title in Main Color */}
        <h1
          className="font-medium tracking-tight mb-1.5"
          style={{
            fontSize: `${settings.fontSize * 1.2}px`,
            color: effectiveColors.text,
            fontFamily: activeFontFamily,
          }}
        >
          <span className="mr-1.5 font-normal" style={{ color: effectiveColors.subText }}>/</span>
          <span>{work.title}</span>
        </h1>

        {/* Metadata in Sub Color */}
        <div
          className="text-[0.82em] mb-3 flex flex-wrap items-center gap-2 font-normal"
          style={{ color: effectiveColors.subText }}
        >
          <span>連載</span>
          <span>·</span>
          <span>全{(work.episodes || []).length}話</span>
          {work.tags && work.tags.length > 0 && (
            <>
              <span>·</span>
              <span>{work.tags.map((t) => `#${t}`).join(' ')}</span>
            </>
          )}
          <span>·</span>
          <span>著者: {work.author}</span>
        </div>

        {/* Summary Description in Sub Color */}
        <p
          className="text-[0.9em] leading-relaxed max-w-2xl"
          style={{
            color: effectiveColors.subText,
            fontFamily: activeFontFamily,
          }}
        >
          {work.summary}
        </p>
      </header>

      {/* Episodes List */}
      {isLoadingEpisodes ? (
        <div className="py-16 text-[0.88em]" style={{ color: effectiveColors.subText }}>
          <p>/ Google Docs から原稿（タブ）を読み込んでいます...</p>
        </div>
      ) : episodesError ? (
        <div className="py-12 space-y-3 text-[0.88em]">
          <p style={{ color: effectiveColors.subText }}>
            / 原稿の読み込みに失敗しました: {episodesError}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="hover:underline font-medium"
              style={{ color: effectiveColors.text }}
            >
              [再試行する]
            </button>
          )}
        </div>
      ) : sortedEpisodes.length === 0 ? (
        <div className="py-16 text-[0.88em]" style={{ color: effectiveColors.subText }}>
          <p>/ 登録されている回（タブ）がありません。</p>
        </div>
      ) : (
        <section className="space-y-10 sm:space-y-12">
          {sortedEpisodes.map((ep, idx) => (
            <article key={ep.tabId}>
              <button
                onClick={() => onSelectEpisode(ep.tabId)}
                className="text-left block w-full group"
              >
                {/* Episode Title in Main Color */}
                <h2
                  className="font-normal tracking-tight mb-1 group-hover:underline transition-all"
                  style={{
                    fontSize: `${settings.fontSize}px`,
                    color: effectiveColors.text,
                    fontFamily: activeFontFamily,
                  }}
                >
                  <span className="mr-1.5 font-mono text-[0.85em]" style={{ color: effectiveColors.subText }}>
                    / {String(idx + 1).padStart(2, '0')}.
                  </span>
                  <span>{ep.title}</span>
                </h2>

                {/* Date & Word count in Sub Color */}
                <div
                  className="text-[0.82em] font-normal flex items-center gap-2"
                  style={{ color: effectiveColors.subText }}
                >
                  {ep.publishedAt && <span>{ep.publishedAt}</span>}
                  {ep.wordCount && (
                    <>
                      <span>·</span>
                      <span>約{ep.wordCount.toLocaleString()}文字</span>
                    </>
                  )}
                </div>
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};
