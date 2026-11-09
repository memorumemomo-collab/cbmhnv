import React, { useState, useMemo } from 'react';
import { NovelWork, BookmarkInfo } from '../types/novel';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { getFontFamilyCss } from '../utils/fontHelper';

interface NovelListProps {
  works: NovelWork[];
  onSelectWork: (work: NovelWork) => void;
  onSelectEpisode: (work: NovelWork, tabId: string) => void;
  bookmark?: BookmarkInfo | null;
  onResumeBookmark?: (bookmark: BookmarkInfo) => void;
  onDeleteBookmark?: () => void;
}

export const NovelList: React.FC<NovelListProps> = ({
  works,
  onSelectWork,
  onSelectEpisode,
  bookmark,
  onResumeBookmark,
  onDeleteBookmark,
}) => {
  const { effectiveColors, settings } = useReaderSettings();
  const [typeFilter, setTypeFilter] = useState<'all' | 'series' | 'short'>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<'and' | 'or'>('and');
  const [isTagsOpen, setIsTagsOpen] = useState(false);

  // Extract all unique tags and their count across all works
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    works.forEach((w) => {
      w.tags?.forEach((t) => {
        map.set(t, (map.get(t) || 0) + 1);
      });
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [works]);

  // Filter works by both category and multiple selected tags
  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      // 1. Type filter
      if (typeFilter !== 'all' && w.type !== typeFilter) {
        return false;
      }
      // 2. Multi-tag filter
      if (selectedTags.length > 0) {
        const workTags = w.tags || [];
        if (tagMatchMode === 'and') {
          // Must include all selected tags
          const hasAll = selectedTags.every((t) => workTags.includes(t));
          if (!hasAll) return false;
        } else {
          // Must include at least one selected tag
          const hasAny = selectedTags.some((t) => workTags.includes(t));
          if (!hasAny) return false;
        }
      }
      return true;
    }).sort((a, b) => {
      // Newest first: updatedAt desc, tie-break by sheet row order (later row = newer)
      const ta = Date.parse(a.updatedAt) || 0;
      const tb = Date.parse(b.updatedAt) || 0;
      if (tb !== ta) return tb - ta;
      return (b.rowIndex ?? 0) - (a.rowIndex ?? 0);
    });
  }, [works, typeFilter, selectedTags, tagMatchMode]);

  const seriesCount = works.filter((w) => w.type === 'series').length;
  const shortCount = works.filter((w) => w.type === 'short').length;

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleClearAllTags = () => {
    setSelectedTags([]);
  };

  const activeFontFamily = getFontFamilyCss(settings.fontFamily);

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
      {/* Site Header / Subtitle line */}
      <section className="mb-16 sm:mb-24">
        <h1 className="tracking-tight leading-relaxed font-normal" style={{ fontSize: `${settings.fontSize}px` }}>
          <span className="font-medium" style={{ color: effectiveColors.text }}>/ 書斎</span>
          <span className="mx-2" style={{ color: effectiveColors.subText }}>—</span>
          <span style={{ color: effectiveColors.subText }}>
            著者が執筆し、非公開で保管している個人小説の閲覧室です。
          </span>
        </h1>

        {/* 1st Line: Category Filters + Tag Filter on the SAME LINE directly to the right of 短編 */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 text-[0.82em] font-normal"
          style={{ color: effectiveColors.subText }}
        >
          <div className="flex items-center gap-3">
            <span style={{ color: effectiveColors.subText }}>/</span>
            <button
              onClick={() => setTypeFilter('all')}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                typeFilter === 'all' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: typeFilter === 'all' ? effectiveColors.text : effectiveColors.subText }}
            >
              すべて ({works.length})
            </button>
            <span style={{ color: effectiveColors.subText }}>·</span>
            <button
              onClick={() => setTypeFilter('series')}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                typeFilter === 'series' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: typeFilter === 'series' ? effectiveColors.text : effectiveColors.subText }}
            >
              連載 ({seriesCount})
            </button>
            <span style={{ color: effectiveColors.subText }}>·</span>
            <button
              onClick={() => setTypeFilter('short')}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                typeFilter === 'short' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: typeFilter === 'short' ? effectiveColors.text : effectiveColors.subText }}
            >
              短編 ({shortCount})
            </button>
          </div>

          <span style={{ color: effectiveColors.subText }}>·</span>

          {/* / タグ絞り込み: right beside 短編 */}
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: effectiveColors.subText }}>:</span>
            <button
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="hover:underline transition-opacity font-medium cursor-pointer"
              style={{ color: effectiveColors.subText }}
            >
              {isTagsOpen ? `[タグ一覧を閉じる −]` : `[タグ一覧を表示 (${tagCounts.length}) ＋]`}
            </button>

            {/* If any tags are selected, show active badge and clear button */}
            {selectedTags.length > 0 && (
              <>
                <span style={{ color: effectiveColors.subText }}>·</span>
                <span className="font-medium" style={{ color: effectiveColors.text }}>
                  {selectedTags.length}件選択中:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => handleToggleTag(tag)}
                      className="hover:underline transition-opacity flex items-center gap-0.5 font-medium cursor-pointer"
                      style={{ color: effectiveColors.text }}
                      title="クリックでこのタグを解除"
                    >
                      <span>#{tag}</span>
                      <span className="text-[0.85em]" style={{ color: effectiveColors.subText }}>×</span>
                    </button>
                  ))}
                </div>

                <span style={{ color: effectiveColors.subText }}>·</span>
                {/* Match Mode toggle: AND vs OR */}
                <button
                  onClick={() => setTagMatchMode(tagMatchMode === 'and' ? 'or' : 'and')}
                  className="hover:underline transition-opacity text-[0.9em] cursor-pointer"
                  style={{ color: effectiveColors.subText }}
                  title="絞り込み条件の切り替え"
                >
                  [{tagMatchMode === 'and' ? 'AND' : 'OR'}]
                </button>

                <button
                  onClick={handleClearAllTags}
                  className="hover:underline transition-opacity text-[0.9em] cursor-pointer"
                  style={{ color: effectiveColors.subText }}
                >
                  [全解除]
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expanded Tag List (pure minimal text, multi-selectable) */}
        {isTagsOpen && (
          <div className="mt-3.5 pl-4 space-y-2 text-[0.82em]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 leading-relaxed">
              {tagCounts.map(([tag, count]) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className={`transition-all hover:underline flex items-center gap-1 cursor-pointer ${
                      isSelected ? 'font-semibold underline' : 'opacity-85'
                    }`}
                    style={{ color: isSelected ? effectiveColors.text : effectiveColors.subText }}
                  >
                    <span>#{tag}</span>
                    <span className="text-[0.85em] opacity-75">({count})</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="text-[0.8em] opacity-75 pt-1" style={{ color: effectiveColors.subText }}>
              ※ タグをクリックして複数選択・解除ができます（現在: {tagMatchMode === 'and' ? 'すべてのタグを含む作品を表示' : 'いずれかのタグを含む作品を表示'}）
            </div>
          </div>
        )}
      </section>

      {/* Bookmark (栞) Bar: Displayed strictly between tags and the novel entries */}
      {bookmark && (
        <section
          className="mb-10 pb-4 border-b flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
          style={{ borderColor: `${effectiveColors.subText}40` }}
        >
          <button
            onClick={() => onResumeBookmark && onResumeBookmark(bookmark)}
            className="text-left flex flex-wrap items-center gap-2 hover:underline cursor-pointer group"
            style={{ color: effectiveColors.text }}
            title="前回の栞から読書を再開"
          >
            <span
              className="px-1.5 py-0.5 border text-[11px] font-medium"
              style={{
                borderColor: settings.highlightColor,
                backgroundColor: `${settings.highlightColor}20`,
                color: settings.highlightColor,
              }}
            >
              🔖
            </span>
            <span className="font-medium">/ {bookmark.workTitle}</span>
            <span style={{ color: effectiveColors.subText }}>— {bookmark.tabTitle}</span>
            <span className="font-mono text-[11px]" style={{ color: effectiveColors.subText }}>
              ({bookmark.scrollPercentage}%)
            </span>
            <span className="text-[10px] opacity-75 font-mono" style={{ color: effectiveColors.subText }}>
              · {new Date(bookmark.updatedAt).toLocaleDateString()}
            </span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteBookmark && onDeleteBookmark();
            }}
            className="hover:underline text-[11px] opacity-60 hover:opacity-100 cursor-pointer"
            style={{ color: effectiveColors.subText }}
            title="栞を削除"
          >
            [× 栞を外す]
          </button>
        </section>
      )}

      {/* Novel Entries: Pure typography with leading slash, zero cards, zero borders */}
      <section className="space-y-8 sm:space-y-10">
        {filteredWorks.map((work) => {
          const isSeries = work.type === 'series';
          const episodeCount = work.episodeCount || (work.episodes || []).length;

          return (
            <article key={work.id} className="group">
              {/* Entry Title with leading slash */}
              <button
                onClick={() => {
                  onSelectWork(work);
                }}
                className="text-left block w-full cursor-pointer"
              >
                {/* Line 1: Title + Date + Type + Tags in one line */}
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1.5">
                  {/* Title in Main Color (글자색) */}
                  <h2
                    className="font-normal tracking-tight hover:underline transition-all inline"
                    style={{
                      fontSize: `${settings.fontSize * 1.15}px`,
                      color: effectiveColors.text,
                      fontFamily: activeFontFamily,
                    }}
                  >
                    <span className="mr-1.5 font-normal" style={{ color: effectiveColors.subText }}>/</span>
                    <span className="font-medium">{work.title}</span>
                  </h2>

                  {/* Date line with multiple tags in Sub Color (글자색2) */}
                  <div
                    className="font-normal inline-flex flex-wrap items-center gap-2 text-[0.82em]"
                    style={{ color: effectiveColors.subText }}
                  >
                
                    <span></span>
                    <span>/</span>
                    <span>
                      {isSeries ? `連載 (全${episodeCount}話)` : '短編'}
                    </span>

                    {/* Multiple tags in Sub Color */}
                    {work.tags && work.tags.length > 0 && (
                      <>
                        <span>/</span>
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {work.tags.map((tag) => {
                            const isTagActive = selectedTags.includes(tag);
                            return (
                              <span
                                key={tag}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleTag(tag);
                                  setIsTagsOpen(true);
                                }}
                                className={`hover:underline cursor-pointer transition-opacity ${
                                  isTagActive ? 'font-semibold underline' : ''
                                }`}
                                style={{ color: isTagActive ? effectiveColors.text : effectiveColors.subText }}
                              >
                                #{tag}
                              </span>
                            );
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Line 2: Literary Description in Sub Color (글자색2) */}
                <p
                  className="leading-relaxed transition-opacity max-w-2xl text-[0.9em]"
                  style={{
                    color: effectiveColors.subText,
                    fontFamily: activeFontFamily,
                  }}
                >
                  {work.summary}
                </p>
              </button>
            </article>
          );
        })}
      </section>

      {filteredWorks.length === 0 && (
        <div className="py-24 text-[0.85em]" style={{ color: effectiveColors.subText }}>
          / 条件に一致する作品がありません。
          {selectedTags.length > 0 && (
            <button
              onClick={handleClearAllTags}
              className="ml-2 underline hover:opacity-100"
              style={{ color: effectiveColors.text }}
            >
              タグ絞り込みをすべて解除
            </button>
          )}
        </div>
      )}

      {/* Minimal Footer Notice in Sub Color */}
      <footer
        className="mt-36 pt-12 text-[0.78em] font-normal leading-relaxed opacity-85"
        style={{ color: effectiveColors.subText }}
      >
        <p>/ 作品および閲覧権限は Google Sheets にて手動管理されています。</p>
        <p className="mt-1">/ 非公開原稿は Google Docs のタブ構造と連動しています。</p>
      </footer>
    </div>
  );
};
