import React, { useState, useMemo, useEffect } from 'react';
import { NovelWork, HighlightMemo } from '../types/novel';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { getFontFamilyCss } from '../utils/fontHelper';
import { fetchAllHighlights } from '../services/highlightService';
import { getSavedGasProxyUrl } from '../services/gasProxyService';

interface HighlightCollectionViewProps {
  works: NovelWork[];
  onSelectEpisode: (work: NovelWork, tabId: string) => void;
  onBackToHome: () => void;
  currentUserEmail?: string;
}

export const HighlightCollectionView: React.FC<HighlightCollectionViewProps> = ({
  works,
  onSelectEpisode,
  onBackToHome,
  currentUserEmail,
}) => {
  const { effectiveColors, settings } = useReaderSettings();
  const [highlights, setHighlights] = useState<HighlightMemo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [kindFilter, setKindFilter] = useState<'all' | 'highlight' | 'comment'>('all');
  const [selectedWorkTitles, setSelectedWorkTitles] = useState<string[]>([]);
  const [isWorksFilterOpen, setIsWorksFilterOpen] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Load highlights across all works on mount
  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const proxyUrl = getSavedGasProxyUrl();
        const data = await fetchAllHighlights(proxyUrl);
        if (isMounted) {
          // Fill workTitle and tabTitle if missing
          const enriched = data.map((h) => {
            let wTitle = h.workTitle;
            let tTitle = h.tabTitle;
            if (!wTitle) {
              const matchedWork = works.find((w) => w.id === h.workId);
              if (matchedWork) {
                wTitle = matchedWork.title;
                const matchedEp = matchedWork.episodes?.find((e) => e.tabId === h.tabId);
                if (matchedEp) tTitle = matchedEp.title;
              }
            }
            return {
              ...h,
              workTitle: wTitle || '無題の作品',
              tabTitle: tTitle || '第1話',
            };
          });
          setHighlights(enriched);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [works]);

  const activeFontFamily = getFontFamilyCss(settings.fontFamily);
  const userEmail = (currentUserEmail || 'reader').toLowerCase();

  // 1. Exclude pure emojis without text if any, or keep if requested (user requested: <이모지(웹박수)>는 여기에 모을 필요 없어.)
  const textualItems = useMemo(() => {
    return highlights.filter((h) => {
      // Exclude emoji-only webclaps
      if (h.emoji && !h.memoText && (!h.selectedText || h.selectedText === h.tabTitle)) {
        return false;
      }
      return true;
    });
  }, [highlights]);

  // 2. Filter by settings.highlightFilterMode
  const visibleBySettings = useMemo(() => {
    if (settings.highlightFilterMode === 'none') return [];
    return textualItems.filter((h) => {
      const isMine = h.authorEmail.toLowerCase() === userEmail;
      if (settings.highlightFilterMode === 'mine') return isMine;
      if (settings.highlightFilterMode === 'others') return !isMine;
      return true;
    });
  }, [textualItems, settings.highlightFilterMode, userEmail]);

  // Unique work titles for novel filter
  const workTitleCounts = useMemo(() => {
    const map = new Map<string, number>();
    visibleBySettings.forEach((h) => {
      const title = h.workTitle || '無題の作品';
      map.set(title, (map.get(title) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [visibleBySettings]);

  // 3. Filter by kind ('highlight' vs 'comment') and selected works
  const filteredItems = useMemo(() => {
    return visibleBySettings.filter((h) => {
      const itemKind = h.kind || 'highlight';
      if (kindFilter !== 'all' && itemKind !== kindFilter) {
        return false;
      }
      if (selectedWorkTitles.length > 0) {
        if (!selectedWorkTitles.includes(h.workTitle || '')) {
          return false;
        }
      }
      return true;
    });
  }, [visibleBySettings, kindFilter, selectedWorkTitles]);

  // 4. Sort newest first
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime() || 0;
      const dateB = new Date(b.createdAt).getTime() || 0;
      if (dateB !== dateA) return dateB - dateA;
      return b.id.localeCompare(a.id);
    });
  }, [filteredItems]);

  // 5. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const currentSafePage = Math.min(currentPage, totalPages);
  const pagedItems = useMemo(() => {
    const start = (currentSafePage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentSafePage, pageSize]);

  // Handlers
  const handleToggleWorkTitle = (title: string) => {
    setSelectedWorkTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    );
    setCurrentPage(1);
  };

  const handleClickItem = (item: HighlightMemo) => {
    const targetWork = works.find((w) => w.id === item.workId);
    if (targetWork) {
      onSelectEpisode(targetWork, item.tabId);
    }
  };

  const highlightCount = visibleBySettings.filter((h) => (h.kind || 'highlight') === 'highlight').length;
  const commentCount = visibleBySettings.filter((h) => h.kind === 'comment').length;

  return (
    <div
      className="mx-auto w-full px-5 sm:px-10 lg:px-12 pt-24 sm:pt-36 lg:pt-40 pb-36 transition-all"
      style={{
        maxWidth: `min(100%, ${settings.contentWidth}px)`,
        boxSizing: 'border-box',
        color: effectiveColors.text,
        fontFamily: activeFontFamily,
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
      }}
    >
      {/* Top Header & Breadcrumb */}
      <section className="mb-12 sm:mb-16">
        <div className="text-xs mb-3 flex items-center gap-2" style={{ color: effectiveColors.subText }}>
          <button
            onClick={onBackToHome}
            className="hover:underline transition-opacity cursor-pointer font-medium"
            style={{ color: effectiveColors.subText }}
          >
            ← 作品一覧に戻る
          </button>
        </div>

        <h1 className="tracking-tight leading-relaxed font-normal text-xs" style={{ color: effectiveColors.subText }}>
          <span className="font-medium" style={{ color: effectiveColors.text }}>/ 抜粋・感想録</span>
          <span className="mx-2" style={{ color: effectiveColors.subText }}>—</span>
          <span>読書中に引いた蛍光ペンと、各話に残されたコメントを一覧で振り返ります。</span>
        </h1>

        {/* 1st Line: Category Filter + Work Title Filter on the same line */}
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-5 text-[0.82em] font-normal"
          style={{ color: effectiveColors.subText }}
        >
          {/* Category: すべて · ハイライト · コメント */}
          <div className="flex items-center gap-3">
            <span style={{ color: effectiveColors.subText }}>/</span>
            <button
              onClick={() => {
                setKindFilter('all');
                setCurrentPage(1);
              }}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                kindFilter === 'all' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: kindFilter === 'all' ? effectiveColors.text : effectiveColors.subText }}
            >
              すべて ({visibleBySettings.length})
            </button>
            <span style={{ color: effectiveColors.subText }}>·</span>
            <button
              onClick={() => {
                setKindFilter('highlight');
                setCurrentPage(1);
              }}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                kindFilter === 'highlight' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: kindFilter === 'highlight' ? effectiveColors.text : effectiveColors.subText }}
            >
              ハイライト ({highlightCount})
            </button>
            <span style={{ color: effectiveColors.subText }}>·</span>
            <button
              onClick={() => {
                setKindFilter('comment');
                setCurrentPage(1);
              }}
              className={`transition-opacity hover:opacity-100 cursor-pointer ${
                kindFilter === 'comment' ? 'font-medium underline' : 'opacity-70'
              }`}
              style={{ color: kindFilter === 'comment' ? effectiveColors.text : effectiveColors.subText }}
            >
              コメント ({commentCount})
            </button>
          </div>

          <span style={{ color: effectiveColors.subText }}>·</span>

          {/* Work Title Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: effectiveColors.subText }}>作品別絞り込み:</span>
            <button
              onClick={() => setIsWorksFilterOpen(!isWorksFilterOpen)}
              className="hover:underline transition-opacity font-medium cursor-pointer"
              style={{ color: effectiveColors.subText }}
            >
              {isWorksFilterOpen ? `[一覧を閉じる −]` : `[一覧を表示 (${workTitleCounts.length}) ＋]`}
            </button>

            {selectedWorkTitles.length > 0 && (
              <>
                <span style={{ color: effectiveColors.subText }}>·</span>
                <span className="font-medium" style={{ color: effectiveColors.text }}>
                  {selectedWorkTitles.length}作品選択中:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedWorkTitles.map((title) => (
                    <button
                      key={title}
                      onClick={() => handleToggleWorkTitle(title)}
                      className="hover:underline transition-opacity flex items-center gap-0.5 font-medium cursor-pointer"
                      style={{ color: effectiveColors.text }}
                    >
                      <span>#{title}</span>
                      <span className="text-[0.85em]" style={{ color: effectiveColors.subText }}>×</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedWorkTitles([])}
                  className="hover:underline transition-opacity text-[0.9em] cursor-pointer"
                  style={{ color: effectiveColors.subText }}
                >
                  [全解除]
                </button>
              </>
            )}
          </div>

          <span style={{ color: effectiveColors.subText }}>·</span>

          {/* Page Size Selector: 10件 · 20件 · 40件 */}
          <div className="flex items-center gap-2">
            <span style={{ color: effectiveColors.subText }}>表示件数:</span>
            {[10, 20, 40].map((size) => (
              <button
                key={size}
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`hover:underline cursor-pointer transition-opacity ${
                  pageSize === size ? 'font-semibold underline' : 'opacity-70'
                }`}
                style={{ color: pageSize === size ? effectiveColors.text : effectiveColors.subText }}
              >
                [{size}件]
              </button>
            ))}
          </div>
        </div>

        {/* Expanded Works List */}
        {isWorksFilterOpen && (
          <div className="mt-3.5 pl-4 space-y-2 text-[0.82em]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 leading-relaxed">
              {workTitleCounts.map(([title, count]) => {
                const isSelected = selectedWorkTitles.includes(title);
                return (
                  <button
                    key={title}
                    onClick={() => handleToggleWorkTitle(title)}
                    className={`transition-all hover:underline flex items-center gap-1 cursor-pointer ${
                      isSelected ? 'font-semibold underline' : 'opacity-85'
                    }`}
                    style={{ color: isSelected ? effectiveColors.text : effectiveColors.subText }}
                  >
                    <span>#{title}</span>
                    <span className="text-[0.85em] opacity-75">({count})</span>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Filter Mode Notice */}
      {settings.highlightFilterMode === 'none' && (
        <div className="p-4 border text-center text-xs mb-8" style={{ borderColor: effectiveColors.subText }}>
          ※ 現在、蛍光ペンが「非表示」に設定されています。画面右上の [✕] アイコンを押して表示に切り替えてください。
        </div>
      )}

      {/* Content List */}
      {isLoading ? (
        <div className="py-20 text-center text-xs font-mono" style={{ color: effectiveColors.subText }}>
          / 抜粋を読み込んでいます...
        </div>
      ) : pagedItems.length === 0 ? (
        <div className="py-20 text-center text-xs" style={{ color: effectiveColors.subText }}>
          {visibleBySettings.length === 0
            ? 'まだ記録されたハイライトやコメントはありません。'
            : '条件に一致するハイライトやコメントはありません。'}
        </div>
      ) : (
        <section className="space-y-7 sm:space-y-9">
          {pagedItems.map((item) => {
            const isMine = item.authorEmail.toLowerCase() === userEmail;
            const itemColor = isMine ? settings.highlightColor : settings.otherUsersHighlightColor;
            const isComment = item.kind === 'comment';
            const formattedDate = item.createdAt ? item.createdAt.replace(/-/g, '. ') : '';

            return (
              <article key={item.id} className="group">
                <button
                  onClick={() => handleClickItem(item)}
                  className="text-left block w-full cursor-pointer hover:opacity-90 transition-opacity"
                  title="クリックしてこの話の原稿を開く"
                >
                  {/* Line 1: / Highlighted Sentence (with highlight background) / Work Title - Tab Title / Date / Badge */}
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-1.5 leading-relaxed">
                    <span className="font-normal mr-0.5" style={{ color: effectiveColors.subText }}>
                      /
                    </span>

                    {/* Sentence with highlight background color */}
                    <span
                      className="font-medium tracking-tight px-1 py-0.5"
                      style={{
                        backgroundColor: `${itemColor}33`,
                        borderBottom: `2px solid ${itemColor}`,
                        color: effectiveColors.text,
                      }}
                    >
                      {item.selectedText || (isComment ? '（話末コメント）' : '（下線のみ）')}
                    </span>

                    {/* Work Title - Tab Title in Sub Color */}
                    <span className="text-[0.82em]" style={{ color: effectiveColors.subText }}>
                      / {item.workTitle} — {item.tabTitle}
                    </span>

                    {/* Date */}
                    {formattedDate && (
                      <span className="text-[0.82em] font-mono" style={{ color: effectiveColors.subText }}>
                        / {formattedDate}
                      </span>
                    )}

                    {/* Type Badge */}
                    <span
                      className="text-[10px] px-1 py-0.5 border font-mono"
                      style={{ borderColor: itemColor, color: itemColor }}
                    >
                      {isComment ? 'コメント' : 'ハイライト'}
                    </span>
                  </div>

                  {/* Line 2: Memo Content in Sub Color (글씨색 2) */}
                  {item.memoText && (
                    <div
                      className="pl-4 text-[0.85em] leading-relaxed"
                      style={{
                        color: effectiveColors.subText,
                        fontFamily: getFontFamilyCss(settings.memoFontFamily || 'sans'),
                      }}
                    >
                      <span className="mr-1.5 opacity-60">/</span>
                      <span>{item.memoText}</span>
                    </div>
                  )}
                </button>
              </article>
            );
          })}
        </section>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div
          className="mt-16 pt-6 border-t flex items-center justify-between text-xs font-mono"
          style={{ borderColor: `${effectiveColors.subText}40`, color: effectiveColors.subText }}
        >
          <button
            onClick={() => {
              setCurrentPage((prev) => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentSafePage <= 1}
            className={`hover:underline cursor-pointer ${currentSafePage <= 1 ? 'opacity-30 pointer-events-none' : ''}`}
          >
            ← 前のページ
          </button>

          <span style={{ color: effectiveColors.text }}>
            {currentSafePage} / {totalPages}
          </span>

          <button
            onClick={() => {
              setCurrentPage((prev) => Math.min(totalPages, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={currentSafePage >= totalPages}
            className={`hover:underline cursor-pointer ${currentSafePage >= totalPages ? 'opacity-30 pointer-events-none' : ''}`}
          >
            次のページ →
          </button>
        </div>
      )}
    </div>
  );
};
