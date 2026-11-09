import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { NovelWork, HighlightMemo, ReaderUser, BookmarkInfo } from '../types/novel';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { getFontFamilyCss } from '../utils/fontHelper';
import {
  fetchEpisodeHighlights,
  addHighlightMemo,
  deleteHighlightMemo,
  reactToHighlight,
  getRecentEmojis,
  recordRecentEmoji,
} from '../services/highlightService';

interface ReaderViewProps {
  work: NovelWork;
  tabId: string;
  currentUser?: ReaderUser | null;
  proxyUrl?: string;
  onNavigateTab: (tabId: string) => void;
  onBackToSeries: () => void;
  onBackToHome: () => void;
  onOpenSettings: () => void;
  onSaveBookmark?: (bookmark: BookmarkInfo) => void;
  initialScrollPercentage?: number;
}

interface SelectionState {
  paragraphIndex: number;
  selectedText: string;
}

type SelectionDraftMode = 'idle' | 'memo' | 'emoji';

export const ReaderView: React.FC<ReaderViewProps> = ({
  work,
  tabId,
  currentUser,
  proxyUrl = '',
  onNavigateTab,
  onBackToSeries,
  onBackToHome,
  onOpenSettings,
  onSaveBookmark,
  initialScrollPercentage,
}) => {
  const { settings, effectiveColors } = useReaderSettings();
  const [scrollProgress, setScrollProgress] = useState(0);

  // Highlights & Memos state
  const [highlights, setHighlights] = useState<HighlightMemo[]>([]);
  const [activeHlIdForDelete, setActiveHlIdForDelete] = useState<string | null>(null);

  // Bookmark notification state
  const [bookmarkSavedMsg, setBookmarkSavedMsg] = useState<string | null>(null);

  // Inline selection & writing state (Embedded directly into prose, Zero-popup)
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [draftMode, setDraftMode] = useState<SelectionDraftMode>('idle');
  const [memoInput, setMemoInput] = useState('');
  const [memoEmoji, setMemoEmoji] = useState<string | null>(null);
  const [isMemoEmojiPickerOpen, setIsMemoEmojiPickerOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => getRecentEmojis());
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [isCustomEmojiOpen, setIsCustomEmojiOpen] = useState(false);
  const memoInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Episode comments & web claps under ***
  const [isCommentBoxOpen, setIsCommentBoxOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isEpisodeClapPickerOpen, setIsEpisodeClapPickerOpen] = useState(false);
  const [customEpisodeEmojiInput, setCustomEpisodeEmojiInput] = useState('');
  const [isCustomEpisodeEmojiOpen, setIsCustomEpisodeEmojiOpen] = useState(false);

  // Independent Table of Contents (目次) toggles for Top and Bottom
  const [showTopToc, setShowTopToc] = useState(false);
  const [showBottomToc, setShowBottomToc] = useState(false);

  const activeFontFamily = getFontFamilyCss(settings.fontFamily);
  const memoFontFamilyCss = getFontFamilyCss(settings.memoFontFamily || 'sans');

  // Sort episodes by order
  const sortedEpisodes = [...(work.episodes || [])].sort((a, b) => a.order - b.order);
  const currentIndex = sortedEpisodes.findIndex((e) => e.tabId === tabId);
  const currentEpisode = sortedEpisodes[currentIndex] || sortedEpisodes[0];

  const prevEpisode = currentIndex > 0 ? sortedEpisodes[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1 ? sortedEpisodes[currentIndex + 1] : null;

  // Load highlights for current episode
  const loadHighlights = useCallback(async () => {
    if (!currentEpisode) return;
    try {
      const data = await fetchEpisodeHighlights(proxyUrl, work.id, currentEpisode.tabId);
      setHighlights(data);
    } catch (e) {
      console.warn('Failed to fetch highlights:', e);
    }
  }, [proxyUrl, work.id, currentEpisode?.tabId]);

  useEffect(() => {
    loadHighlights();
  }, [loadHighlights]);

  // Track scroll depth
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalHeight) * 100));
        setScrollProgress(progress);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Smooth scroll to initial position (from bookmark resume)
  useEffect(() => {
    if (initialScrollPercentage && initialScrollPercentage > 0) {
      const timer = setTimeout(() => {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          const targetY = (initialScrollPercentage / 100) * totalHeight;
          window.scrollTo({ top: targetY, behavior: 'smooth' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [initialScrollPercentage, tabId]);

  // Scroll to top when tab changes
  useEffect(() => {
    if (!initialScrollPercentage || initialScrollPercentage <= 0) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    setSelection(null);
    setDraftMode('idle');
    setMemoInput('');
    setMemoEmoji(null);
    setIsMemoEmojiPickerOpen(false);
    setIsCustomEmojiOpen(false);
    setCustomEmojiInput('');
    setIsCommentBoxOpen(false);
    setCommentInput('');
    setIsEpisodeClapPickerOpen(false);
    setActiveHlIdForDelete(null);
  }, [tabId, initialScrollPercentage]);

  // Focus inline memo input whenever memo writing mode starts
  useEffect(() => {
    if (selection && draftMode === 'memo') {
      const timer = setTimeout(() => {
        memoInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selection, draftMode]);

  // Handle user text selection inside article
  const handleMouseUp = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      return;
    }

    const selectedText = sel.toString().trim();
    if (selectedText.length < 2) return;

    // Check if selection is within a paragraph element with data-p-idx
    let node: Node | null = sel.anchorNode;
    let pElem: HTMLElement | null = null;
    while (node && node !== containerRef.current) {
      if (node instanceof HTMLElement && node.dataset.pIdx !== undefined) {
        pElem = node;
        break;
      }
      node = node.parentNode;
    }

    if (pElem && pElem.dataset.pIdx !== undefined) {
      const pIdx = parseInt(pElem.dataset.pIdx, 10);
      setSelection({
        paragraphIndex: pIdx,
        selectedText,
      });
      setDraftMode('idle'); // Shows 3 buttons: [🖍], [📝], [👏]
      setMemoInput('');
      setMemoEmoji(null);
      setIsMemoEmojiPickerOpen(false);
      setIsCustomEmojiOpen(false);
      setCustomEmojiInput('');
    }
  };

  // 1. Highlight button: Adds only underline immediately (no memo/emoji)
  const handleSaveHighlightOnly = async () => {
    if (!selection || !currentEpisode) return;

    const newHl: HighlightMemo = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      workId: work.id,
      tabId: currentEpisode.tabId,
      paragraphIndex: selection.paragraphIndex,
      selectedText: selection.selectedText,
      color: settings.highlightColor,
      textColor: settings.highlightColor,
      authorEmail: currentUser?.email || 'reader',
      authorName: currentUser?.name || '',
      createdAt: new Date().toISOString().split('T')[0],
      kind: 'highlight',
      workTitle: work.title,
      tabTitle: currentEpisode.title,
    };

    setHighlights((prev) => [newHl, ...prev]);
    if (!(await addHighlightMemo(proxyUrl || '', newHl))) loadHighlights();
    handleCancelSelection();
  };

  // 2. Memo button: Submit highlight with text memo and optional attached emoji
  const handleSaveHighlightAndMemo = async () => {
    if (!selection || !currentEpisode) return;

    const trimmedMemo = memoInput.trim();
    if (!trimmedMemo && !memoEmoji) {
      // If nothing entered or chosen, cancel
      handleCancelSelection();
      return;
    }

    if (memoEmoji) {
      const updated = recordRecentEmoji(memoEmoji);
      setRecentEmojis(updated);
    }

    const newHl: HighlightMemo = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      workId: work.id,
      tabId: currentEpisode.tabId,
      paragraphIndex: selection.paragraphIndex,
      selectedText: selection.selectedText,
      memoText: trimmedMemo.length > 0 ? trimmedMemo : undefined,
      emoji: memoEmoji || undefined,
      reactionCount: memoEmoji ? 1 : undefined,
      color: settings.highlightColor,
      textColor: settings.highlightColor,
      authorEmail: currentUser?.email || 'reader',
      authorName: currentUser?.name || '',
      createdAt: new Date().toISOString().split('T')[0],
      kind: 'highlight',
      workTitle: work.title,
      tabTitle: currentEpisode.title,
    };

    setHighlights((prev) => [newHl, ...prev]);
    if (!(await addHighlightMemo(proxyUrl || '', newHl))) loadHighlights();
    handleCancelSelection();
  };

  // 3. Emoji button: Submit emoji reaction (Web clap) on the selected text
  const handleSaveEmojiReaction = async (emojiChar: string) => {
    if (!selection || !currentEpisode) return;
    const cleanEmoji = emojiChar.trim();
    if (!cleanEmoji) return;

    setRecentEmojis(recordRecentEmoji(cleanEmoji));
    const target = { paragraphIndex: selection.paragraphIndex, selectedText: selection.selectedText, emoji: cleanEmoji };
    handleCancelSelection();
    await sendReaction(target);
  };

  // Submit custom emoji in emoji picker
  const handleCustomEmojiSubmit = () => {
    const trimmed = customEmojiInput.trim();
    if (trimmed) {
      handleSaveEmojiReaction(trimmed);
      setCustomEmojiInput('');
      setIsCustomEmojiOpen(false);
    }
  };

  // Select emoji to attach in memo editor
  const handleSelectMemoEmoji = (emoji: string) => {
    setMemoEmoji(emoji);
    setIsMemoEmojiPickerOpen(false);
    const updated = recordRecentEmoji(emoji);
    setRecentEmojis(updated);
  };

  // Submit custom emoji in memo editor
  const handleCustomMemoEmojiSubmit = () => {
    const trimmed = customEmojiInput.trim();
    if (trimmed) {
      handleSelectMemoEmoji(trimmed);
      setCustomEmojiInput('');
      setIsCustomEmojiOpen(false);
    }
  };

  // Send / increment MY reaction. The server upserts one row per (target, emoji, author),
  // so repeated claps only raise reactionCount on that row instead of appending new rows.
  const sendReaction = async (
    target: { paragraphIndex: number; selectedText: string; emoji: string },
    targetId?: string
  ) => {
    if (!currentEpisode) return;
    const me = (currentUser?.email || 'reader').toLowerCase();
    const mine = highlights.find((h) =>
      targetId
        ? h.id === targetId
        : h.workId === work.id &&
          h.tabId === currentEpisode.tabId &&
          h.paragraphIndex === target.paragraphIndex &&
          h.selectedText === target.selectedText &&
          h.emoji === target.emoji &&
          !h.memoText &&
          h.authorEmail.toLowerCase() === me
    );

    const rowId = mine?.id || 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const draft: HighlightMemo = mine
      ? { ...mine, reactionCount: (mine.reactionCount || 1) + 1 }
      : {
          id: rowId,
          workId: work.id,
          tabId: currentEpisode.tabId,
          paragraphIndex: target.paragraphIndex,
          selectedText: target.selectedText,
          emoji: target.emoji,
          reactionCount: 1,
          color: settings.highlightColor,
          textColor: settings.highlightColor,
          authorEmail: me,
          authorName: currentUser?.name || '',
          createdAt: new Date().toISOString().split('T')[0],
          kind: 'highlight',
          workTitle: work.title,
          tabTitle: currentEpisode.title,
        };

    // Optimistic UI
    setHighlights((prev) =>
      mine ? prev.map((h) => (h.id === mine.id ? draft : h)) : [...prev, draft]
    );

    const result = await reactToHighlight(proxyUrl || '', draft, mine?.id);
    if (result) {
      // Reconcile with the authoritative count from the sheet
      setHighlights((prev) =>
        prev.map((h) =>
          h.id === rowId || h.id === result.id ? { ...h, id: result.id, reactionCount: result.reactionCount } : h
        )
      );
    } else {
      // Sync failed: reload from the sheet so the UI never shows numbers that were not saved
      loadHighlights();
    }
  };

  // Click on an existing emoji badge → +1 on MY row (never on somebody else's row)
  const handleClapReaction = async (targetHl: HighlightMemo | { id: string; [key: string]: any }) => {
    const hl = targetHl as HighlightMemo;
    if (!hl.emoji) return;
    const me = (currentUser?.email || 'reader').toLowerCase();
    const isMine = (hl.authorEmail || '').toLowerCase() === me;
    await sendReaction(
      { paragraphIndex: hl.paragraphIndex, selectedText: hl.selectedText, emoji: hl.emoji },
      isMine ? hl.id : undefined
    );
  };

  // Save current location as Shiori bookmark
  const handleSaveBookmark = () => {
    if (!currentEpisode) return;
    const b: BookmarkInfo = {
      workId: work.id,
      workTitle: work.title,
      tabId: currentEpisode.tabId,
      tabTitle: currentEpisode.title,
      scrollPercentage: Math.round(scrollProgress),
      updatedAt: new Date().toISOString(),
    };
    if (onSaveBookmark) {
      onSaveBookmark(b);
    }
    setBookmarkSavedMsg('栞を挟みました');
    setTimeout(() => setBookmarkSavedMsg(null), 2500);
  };

  // Add episode comment under ***
  const handleAddEpisodeComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || !currentEpisode) return;

    const newHl: HighlightMemo = {
      id: 'hl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      workId: work.id,
      tabId: currentEpisode.tabId,
      paragraphIndex: -1,
      selectedText: '***',
      memoText: trimmed,
      color: settings.highlightColor,
      textColor: settings.highlightColor,
      authorEmail: currentUser?.email || 'reader',
      authorName: currentUser?.name || '',
      createdAt: new Date().toISOString().split('T')[0],
      kind: 'comment',
      workTitle: work.title,
      tabTitle: currentEpisode.title,
    };

    setHighlights((prev) => [...prev, newHl]);
    if (!(await addHighlightMemo(proxyUrl || '', newHl))) loadHighlights();
    setCommentInput('');
    setIsCommentBoxOpen(false);
  };

  // Add episode clap under ***
  const handleAddEpisodeClap = async (emojiChar: string) => {
    if (!currentEpisode) return;
    const cleanEmoji = emojiChar.trim();
    if (!cleanEmoji) return;

    setRecentEmojis(recordRecentEmoji(cleanEmoji));
    setIsEpisodeClapPickerOpen(false);
    await sendReaction({ paragraphIndex: -1, selectedText: '***', emoji: cleanEmoji });
  };

  const handleCustomEpisodeEmojiSubmit = () => {
    const trimmed = customEpisodeEmojiInput.trim();
    if (trimmed) {
      handleAddEpisodeClap(trimmed);
      setCustomEpisodeEmojiInput('');
      setIsCustomEpisodeEmojiOpen(false);
    }
  };

  // Cancel inline selection
  const handleCancelSelection = () => {
    setSelection(null);
    setDraftMode('idle');
    setMemoInput('');
    setMemoEmoji(null);
    setIsMemoEmojiPickerOpen(false);
    setIsCustomEmojiOpen(false);
    setCustomEmojiInput('');
    window.getSelection()?.removeAllRanges();
  };

  // Delete a highlight/memo
  const handleDeleteHighlight = async (id: string) => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    if (!(await deleteHighlightMemo(proxyUrl || '', id))) loadHighlights();
  };

  // Filter highlights based on highlightFilterMode
  const visibleHighlights = highlights.filter((h) => {
    if (settings.highlightFilterMode === 'none') return false;
    if (settings.highlightFilterMode === 'mine') {
      return h.authorEmail === currentUser?.email;
    }
    if (settings.highlightFilterMode === 'others') {
      return h.authorEmail !== currentUser?.email;
    }
    return true; // 'all'
  });

  // Resolve color for highlight (personal vs other users)
  const getHighlightColor = (hl: HighlightMemo) => {
    const isMine = hl.authorEmail === currentUser?.email;
    if (isMine) {
      return hl.color || settings.highlightColor;
    }
    if (settings.otherUsersColorMode === 'unified') {
      return settings.otherUsersHighlightColor || '#60A5FA';
    }
    return hl.color || settings.otherUsersHighlightColor || '#60A5FA';
  };

  // Render paragraph content with:
  // 1) Zero-popup inline inserted memo editor right after selected text
  // 2) Disjoint interval slicing with Multiply blending (zero text duplication)
  // 3) Continuous underline connecting highlight through inline memo
  const renderParagraphContent = (text: string, pIdx: number) => {
    const pHighlights = visibleHighlights.filter((h) => h.paragraphIndex === pIdx);

    // Check if the current user is actively selecting/editing a memo in this paragraph
    const isEditingThisP = Boolean(selection && selection.paragraphIndex === pIdx);
    const selText = isEditingThisP && selection ? selection.selectedText : '';
    const selStart = selText ? text.indexOf(selText) : -1;
    const selEnd = selStart >= 0 ? selStart + selText.length : -1;

    // Existing valid highlights
    const validHls = pHighlights
      .map((hl) => {
        const start = text.indexOf(hl.selectedText);
        return {
          ...hl,
          start,
          end: start >= 0 ? start + hl.selectedText.length : -1,
          colorResolved: getHighlightColor(hl),
          isMine: hl.authorEmail === currentUser?.email,
          isDraft: false,
        };
      })
      .filter((h) => h.start >= 0);

    // If actively drafting a selection in this paragraph, incorporate it into the interval slicer
    type HighlightItem = typeof validHls[number] | {
      id: string;
      selectedText: string;
      start: number;
      end: number;
      colorResolved: string;
      isMine: boolean;
      isDraft: boolean;
      memoText?: string;
      emoji?: string;
      reactionCount?: number;
      authorName?: string;
      authorEmail?: string;
    };

    const allHls: HighlightItem[] = [...validHls];
    if (selStart >= 0 && selEnd > selStart) {
      allHls.push({
        id: '__inline_draft__',
        selectedText: selection!.selectedText,
        start: selStart,
        end: selEnd,
        colorResolved: settings.highlightColor,
        isMine: true,
        isDraft: true,
      });
    }

    if (allHls.length === 0) {
      return text;
    }

    // Group overlapping or intersecting highlights into connected clusters so prose is never broken in the middle!
    const sortedHls = [...allHls].sort((a, b) => a.start - b.start || a.end - b.end);

    interface HighlightCluster {
      start: number;
      end: number;
      hls: HighlightItem[];
    }

    const clusters: HighlightCluster[] = [];
    for (const hl of sortedHls) {
      if (clusters.length === 0) {
        clusters.push({ start: hl.start, end: hl.end, hls: [hl] });
      } else {
        const last = clusters[clusters.length - 1];
        if (hl.start <= last.end) {
          last.end = Math.max(last.end, hl.end);
          last.hls.push(hl);
        } else {
          clusters.push({ start: hl.start, end: hl.end, hls: [hl] });
        }
      }
    }

    const elements: React.ReactNode[] = [];
    let cursor = 0;

    clusters.forEach((cluster, clusterIdx) => {
      // 1. Plain prose before cluster
      if (cursor < cluster.start) {
        elements.push(
          <React.Fragment key={`plain_${cursor}_${cluster.start}`}>
            {text.slice(cursor, cluster.start)}
          </React.Fragment>
        );
      }

      // 2. Slice the entire cluster into sub-intervals based on internal boundaries
      const subPointsSet = new Set<number>([cluster.start, cluster.end]);
      cluster.hls.forEach((h) => {
        subPointsSet.add(h.start);
        subPointsSet.add(h.end);
      });
      const subPoints = Array.from(subPointsSet).sort((a, b) => a - b);

      // Render the prose within the cluster (completely continuous prose!)
      for (let j = 0; j < subPoints.length - 1; j++) {
        const subStart = subPoints[j];
        const subEnd = subPoints[j + 1];
        if (subStart >= subEnd) continue;

        const subChunk = text.slice(subStart, subEnd);
        const active = cluster.hls.filter((h) => h.start <= subStart && h.end >= subEnd);

        if (active.length === 0) {
          elements.push(
            <React.Fragment key={`cluster_plain_${subStart}_${subEnd}`}>
              {subChunk}
            </React.Fragment>
          );
        } else if (active.length === 1) {
          const hl = active[0];
          elements.push(
            <span
              key={`hl_${subStart}_${subEnd}`}
              onClick={(e) => {
                if (!hl.isDraft) {
                  e.stopPropagation();
                  setActiveHlIdForDelete((prev) => (prev === hl.id ? null : hl.id));
                }
              }}
              className={`inline transition-colors ${!hl.isDraft ? 'cursor-pointer' : ''}`}
              style={{
                borderBottom: `2px solid ${hl.colorResolved}`,
                backgroundColor: `${hl.colorResolved}33`,
              }}
              title={hl.isDraft ? '現在選択中' : `${hl.authorName || hl.authorEmail} のハイライト`}
            >
              {subChunk}
            </span>
          );
        } else {
          // Multiple overlapping highlights: Multiply layer blending without prose interruption!
          const dominantColor = active[0].colorResolved;
          elements.push(
            <span
              key={`hl_overlap_${subStart}_${subEnd}`}
              onClick={(e) => {
                const target = active.find((h) => !h.isDraft);
                if (target) {
                  e.stopPropagation();
                  setActiveHlIdForDelete((prev) => (prev === target.id ? null : target.id));
                }
              }}
              className="inline relative transition-colors cursor-pointer"
              style={{
                borderBottom: `2.5px solid ${dominantColor}`,
              }}
              title={`${active.length}件のハイライトが重なっています`}
            >
              {active.map((h, layerIdx) => (
                <span
                  key={layerIdx}
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none select-none"
                  style={{
                    backgroundColor: h.colorResolved,
                    opacity: 0.4,
                    mixBlendMode: effectiveColors.isDark ? 'screen' : 'multiply',
                  }}
                />
              ))}
              <span className="relative z-10">{subChunk}</span>
            </span>
          );
        }
      }

      // 3. ALL memos, emoji reactions, and draft editors for this cluster are appended strictly AT THE END OF THE CLUSTER!
      // This guarantees that intersecting/overlapping sentences are read continuously: e.g. もえもえしちゅえ[Aメモ][Bメモ]
      const draftHl = cluster.hls.find((h) => h.isDraft);
      if (draftHl) {
          if (draftMode === 'idle') {
            // Step 1: 3-way Action Bar directly beside the selected text: [🖍], [📝], [👏]
            elements.push(
              <span
                key="__inline_trigger__"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mx-1.5 align-baseline font-normal select-none animate-in fade-in duration-100"
                style={{
                  borderBottom: `2px solid ${settings.highlightColor}`,
                }}
              >
                {/* 1. Highlight Button: Adds underline only */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveHighlightOnly();
                  }}
                  className="px-2 py-0.5 border text-xs cursor-pointer hover:opacity-85 font-medium flex items-center gap-1 transition-opacity"
                  style={{
                    backgroundColor: settings.highlightColor,
                    color: '#1A1A1A',
                    borderColor: '#1A1A1A',
                  }}
                  title="下線のみを引く（メモなし）"
                >
                  <span>🖍</span>
                </button>

                {/* 2. Memo Button: Opens inline memo input */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraftMode('memo');
                  }}
                  className="px-2 py-0.5 border text-xs cursor-pointer hover:opacity-85 font-medium flex items-center gap-1 transition-opacity"
                  style={{
                    backgroundColor: `${settings.highlightColor}25`,
                    color: effectiveColors.text,
                    borderColor: settings.highlightColor,
                  }}
                  title="メモを書いて残す"
                >
                  <span>📝</span>
                </button>

                {/* 3. Emoji Web Clap Button: Opens emoji reaction picker */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraftMode('emoji');
                  }}
                  className="px-2 py-0.5 border text-xs cursor-pointer hover:opacity-85 font-medium flex items-center gap-1 transition-opacity"
                  style={{
                    backgroundColor: `${settings.highlightColor}25`,
                    color: effectiveColors.text,
                    borderColor: settings.highlightColor,
                  }}
                  title="絵文字（ウェブ拍手）を付ける"
                >
                  <span>👏</span>
                </button>

                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="opacity-60 hover:opacity-100 hover:underline px-1 text-xs cursor-pointer"
                  style={{ color: settings.highlightColor }}
                  title="選択解除"
                >
                  [×]
                </button>
              </span>
            );
          } else if (draftMode === 'emoji') {
            // Step 2a: Inline Emoji Reaction Picker (Recent 5 emojis + [+] custom emoji input)
            elements.push(
              <span
                key="__inline_emoji_picker__"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mx-1.5 align-baseline font-normal select-none animate-in fade-in duration-100 flex-wrap"
                style={{
                  color: settings.highlightColor,
                  fontSize: `${settings.memoFontSize || 12}px`,
                  fontFamily: memoFontFamilyCss,
                }}
              >
                <span className="text-[11px] font-mono mr-0.5 select-none" style={{ color: settings.highlightColor }}>
                  拍手:
                </span>
                <span className="inline-flex items-center gap-1">
                  {recentEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSaveEmojiReaction(emoji);
                      }}
                      className="hover:scale-125 px-0.5 py-0 text-sm cursor-pointer transition-transform select-none"
                      title={`${emoji} でリアクション (ウェブ拍手)`}
                    >
                      {emoji}
                    </button>
                  ))}

                  {!isCustomEmojiOpen ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsCustomEmojiOpen(true);
                      }}
                      className="px-1 py-0.5 text-xs border rounded-xs hover:opacity-100 opacity-75 font-mono cursor-pointer transition-opacity"
                      style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                      title="他の絵文字を追加 (+)"
                    >
                      +
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 ml-0.5">
                      <input
                        type="text"
                        value={customEmojiInput}
                        onChange={(e) => setCustomEmojiInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCustomEmojiSubmit();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setIsCustomEmojiOpen(false);
                          }
                        }}
                        placeholder="😊"
                        className="w-10 px-1 py-0 text-xs border text-center outline-none bg-transparent"
                        style={{ borderColor: settings.highlightColor, color: effectiveColors.text }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCustomEmojiSubmit();
                        }}
                        className="text-[10px] px-1 py-0 border hover:underline cursor-pointer"
                        style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                      >
                        追加
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsCustomEmojiOpen(false);
                        }}
                        className="text-[10px] px-0.5 opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="opacity-60 hover:opacity-100 hover:underline text-[11px] cursor-pointer px-0.5 ml-1"
                  style={{ color: settings.highlightColor }}
                  title="キャンセル"
                >
                  [×]
                </button>
              </span>
            );
          } else {
            // Step 2b: Embedded inline memo writing box with Emoji attachment in place of [下線のみ]
            elements.push(
              <span
                key="__inline_editor__"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 mx-1.5 align-baseline font-normal select-text animate-in fade-in duration-100 flex-wrap"
                style={{
                  color: settings.highlightColor,
                  fontSize: `${settings.memoFontSize || 12}px`,
                  fontFamily: memoFontFamilyCss,
                }}
              >
                <input
                  ref={memoInputRef}
                  type="text"
                  value={memoInput}
                  onChange={(e) => setMemoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveHighlightAndMemo();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      handleCancelSelection();
                    }
                  }}
                  placeholder="メモ入力 (Enter保存)"
                  className="outline-none bg-transparent py-0 px-1 border-b text-xs w-36 sm:w-52 font-sans"
                  style={{
                    borderColor: settings.highlightColor,
                    color: settings.highlightColor,
                  }}
                />

                {/* Emoji attachment button placed in the position of former [下線のみ] */}
                <div className="relative inline-flex items-center">
                  {!memoEmoji ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsMemoEmojiPickerOpen(!isMemoEmojiPickerOpen);
                      }}
                      className="px-1.5 py-0.5 border text-[11px] cursor-pointer hover:opacity-100 opacity-80 flex items-center gap-0.5 transition-opacity"
                      style={{
                        borderColor: settings.highlightColor,
                        color: settings.highlightColor,
                        backgroundColor: `${settings.highlightColor}15`,
                      }}
                      title="メモに絵文字・拍手を添付"
                    >
                      <span>👏</span>
                      <span>絵文字</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMemoEmoji(null);
                      }}
                      className="px-1.5 py-0.5 border text-[11px] cursor-pointer hover:opacity-100 flex items-center gap-1 transition-opacity"
                      style={{
                        borderColor: settings.highlightColor,
                        backgroundColor: `${settings.highlightColor}30`,
                        color: effectiveColors.text,
                      }}
                      title="クリックして絵文字を解除"
                    >
                      <span>{memoEmoji}</span>
                      <span className="opacity-60 text-[10px]">✕</span>
                    </button>
                  )}

                  {/* Popover emoji picker for attaching to memo */}
                  {isMemoEmojiPickerOpen && (
                    <span
                      className="absolute bottom-full left-0 mb-1 z-30 inline-flex items-center gap-1 px-1.5 py-1 border shadow-xs bg-white dark:bg-neutral-900 select-none animate-in fade-in duration-100 whitespace-nowrap"
                      style={{
                        borderColor: settings.highlightColor,
                        backgroundColor: effectiveColors.bg,
                      }}
                    >
                      {recentEmojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSelectMemoEmoji(emoji);
                          }}
                          className="hover:scale-125 px-0.5 text-sm cursor-pointer transition-transform"
                          title={`${emoji} を添付`}
                        >
                          {emoji}
                        </button>
                      ))}

                      {!isCustomEmojiOpen ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsCustomEmojiOpen(true);
                          }}
                          className="px-1 text-xs border rounded-xs hover:opacity-100 opacity-75 font-mono cursor-pointer"
                          style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                          title="他の絵文字を追加 (+)"
                        >
                          +
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <input
                            type="text"
                            value={customEmojiInput}
                            onChange={(e) => setCustomEmojiInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCustomMemoEmojiSubmit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsCustomEmojiOpen(false);
                              }
                            }}
                            placeholder="😊"
                            className="w-10 px-1 py-0 text-xs border text-center outline-none bg-transparent"
                            style={{ borderColor: settings.highlightColor, color: effectiveColors.text }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCustomMemoEmojiSubmit();
                            }}
                            className="text-[10px] px-1 py-0 border hover:underline cursor-pointer"
                            style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                          >
                            追加
                          </button>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsMemoEmojiPickerOpen(false);
                          setIsCustomEmojiOpen(false);
                        }}
                        className="text-[10px] px-0.5 opacity-60 hover:opacity-100 cursor-pointer ml-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveHighlightAndMemo();
                  }}
                  className="hover:underline font-medium text-[11px] cursor-pointer px-1 whitespace-nowrap"
                  style={{ color: settings.highlightColor }}
                  title="Enterで保存"
                >
                  [保存]
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelSelection();
                  }}
                  className="opacity-60 hover:opacity-100 hover:underline text-[11px] cursor-pointer px-0.5"
                  style={{ color: settings.highlightColor }}
                  title="キャンセル (Esc)"
                >
                  [×]
                </button>
              </span>
            );
          }
        }

      // Non-draft highlights for this cluster:
      const nonDraftHls = cluster.hls.filter((h) => !h.isDraft);
      const underlineOnlyHls = nonDraftHls.filter((h) => !h.memoText && !h.emoji);
      const memoHls = nonDraftHls.filter((h) => Boolean(h.memoText));
      const standaloneEmojiHls = nonDraftHls.filter((h) => !h.memoText && Boolean(h.emoji));

      // 3a. Underline-only: If user clicked underline to delete, show [×]
      underlineOnlyHls.forEach((hl) => {
        if (hl.isMine && activeHlIdForDelete === hl.id) {
          elements.push(
            <button
              key={`del_hl_${hl.id}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteHighlight(hl.id);
              }}
              className="opacity-75 hover:opacity-100 cursor-pointer text-[0.85em] hover:underline transition-opacity align-baseline ml-1"
              style={{ color: hl.colorResolved }}
              title="下線を削除"
            >
              [×]
            </button>
          );
        }
      });

      // 3b. Memos (Text + optional attached emoji):
      // Sized to settings.memoFontSize, no underline under memo, click toggles delete [×]
      memoHls.forEach((hl, mIdx) => {
        elements.push(
          <span
            key={`memo_${hl.id}_${cluster.end}_${mIdx}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveHlIdForDelete((prev) => (prev === hl.id ? null : hl.id));
            }}
            className="inline font-normal align-baseline ml-1.5 select-text cursor-pointer"
            style={{
              color: hl.colorResolved,
              fontSize: `${settings.memoFontSize || 12}px`,
              fontFamily: memoFontFamilyCss,
            }}
            title="クリックで操作切り替え"
          >
            {hl.memoText && (
              <span className="mr-1 font-normal" style={{ color: hl.colorResolved }}>
                {hl.memoText}
              </span>
            )}

            {hl.emoji && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleClapReaction(hl);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none border hover:opacity-85 active:scale-95 transition-all cursor-pointer font-sans select-none align-baseline mr-1"
                style={{
                  borderColor: hl.colorResolved,
                  backgroundColor: `${hl.colorResolved}20`,
                  color: effectiveColors.text,
                  fontSize: `${settings.memoFontSize || 12}px`,
                  mixBlendMode: effectiveColors.isDark ? 'screen' : 'multiply',
                }}
                title="クリックして拍手を送る (累計カウント)"
              >
                <span className="select-none leading-none" style={{ fontSize: `${settings.memoFontSize || 12}px` }}>
                  {hl.emoji}
                </span>
                <span
                  className="font-mono font-semibold leading-none"
                  style={{ color: hl.colorResolved, fontSize: `${settings.memoFontSize || 12}px` }}
                >
                  {hl.reactionCount || 1}
                </span>
              </button>
            )}

            {hl.isMine && activeHlIdForDelete === hl.id && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleDeleteHighlight(hl.id);
                }}
                className="opacity-75 hover:opacity-100 cursor-pointer text-[0.85em] hover:underline transition-opacity align-baseline ml-0.5"
                style={{ color: hl.colorResolved }}
                title="削除"
                aria-label="削除"
              >
                [×]
              </button>
            )}
          </span>
        );
      });

      // 3c. Standalone Emoji Reactions (Multi-user aggregation):
      // Group same emojis together, sum reaction counts, apply mix-blend-mode and memoFontSize!
      const emojiMap = new Map<
        string,
        {
          totalCount: number;
          items: typeof standaloneEmojiHls;
          dominantColor: string;
          myItem?: typeof standaloneEmojiHls[0];
        }
      >();

      standaloneEmojiHls.forEach((hl) => {
        const char = hl.emoji!;
        const existing = emojiMap.get(char) || {
          totalCount: 0,
          items: [],
          dominantColor: hl.colorResolved,
          myItem: undefined,
        };
        existing.totalCount += (hl.reactionCount || 1);
        existing.items.push(hl);
        if (hl.isMine) {
          existing.myItem = hl;
          existing.dominantColor = hl.colorResolved;
        }
        emojiMap.set(char, existing);
      });

      emojiMap.forEach((entry, emojiChar) => {
        const isMineSelected = entry.myItem && activeHlIdForDelete === entry.myItem.id;
        elements.push(
          <span
            key={`agg_emoji_${cluster.end}_${emojiChar}`}
            className="inline-flex items-center gap-0.5 ml-1.5 align-baseline"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleClapReaction(entry.items[0]);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-none border hover:opacity-85 active:scale-95 transition-all cursor-pointer font-sans select-none align-baseline mr-0.5"
              style={{
                borderColor: entry.dominantColor,
                backgroundColor: `${entry.dominantColor}20`,
                color: effectiveColors.text,
                fontSize: `${settings.memoFontSize || 12}px`,
                mixBlendMode: effectiveColors.isDark ? 'screen' : 'multiply',
              }}
              title="クリックして拍手を送る (累計カウント)"
            >
              <span className="select-none leading-none" style={{ fontSize: `${settings.memoFontSize || 12}px` }}>
                {emojiChar}
              </span>
              <span
                className="font-mono font-semibold leading-none"
                style={{ color: entry.dominantColor, fontSize: `${settings.memoFontSize || 12}px` }}
              >
                {entry.totalCount}
              </span>
            </button>

            {entry.myItem && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setActiveHlIdForDelete((prev) => (prev === entry.myItem!.id ? null : entry.myItem!.id));
                }}
                className="opacity-40 hover:opacity-100 text-[10px] cursor-pointer"
                title="削除切り替え"
              >
                {isMineSelected ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleDeleteHighlight(entry.myItem!.id);
                    }}
                    className="text-red-500 font-bold hover:underline"
                  >
                    [×]
                  </span>
                ) : (
                  <span>⋮</span>
                )}
              </button>
            )}
          </span>
        );
      });

      cursor = cluster.end;
    });

    // 4. Trailing plain prose after all clusters
    if (cursor < text.length) {
      elements.push(
        <React.Fragment key={`plain_${cursor}_${text.length}`}>
          {text.slice(cursor)}
        </React.Fragment>
      );
    }

    return elements;
  };

  // Episode-level comments & claps (paragraphIndex === -1)
  const episodeClaps = visibleHighlights.filter((h) => h.paragraphIndex === -1 && Boolean(h.emoji));
  const episodeComments = visibleHighlights
    .filter((h) => h.paragraphIndex === -1 && h.kind === 'comment')
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));

  // Aggregate episode claps by emoji
  const aggregatedEpisodeClaps = useMemo(() => {
    const map = new Map<string, { totalCount: number; item: HighlightMemo }>();
    episodeClaps.forEach((h) => {
      const char = h.emoji!;
      const existing = map.get(char) || { totalCount: 0, item: h };
      existing.totalCount += (h.reactionCount || 1);
      map.set(char, existing);
    });
    return Array.from(map.entries());
  }, [episodeClaps]);

  const isSeries = work.type === 'series';

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="min-h-screen w-full max-w-full overflow-x-hidden relative transition-colors"
      style={{
        backgroundColor: effectiveColors.bg,
        color: effectiveColors.text,
      }}
    >
      {/* 1px Minimal Scroll Reading Progress Line */}
      {settings.showProgressBar && (
        <div className="fixed top-0 left-0 right-0 h-[1px] z-40 bg-transparent" aria-hidden="true">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${scrollProgress}%`,
              backgroundColor: effectiveColors.text,
              opacity: 0.6,
            }}
          />
        </div>
      )}

      {/* Main Reading Container: Pure unboxed literary text stream */}
      {!currentEpisode ? (
        <main
          className="mx-auto w-full px-5 sm:px-10 lg:px-12 pt-36 pb-36 text-center"
          style={{
            maxWidth: `min(100%, ${settings.contentWidth}px)`,
            boxSizing: 'border-box',
            color: effectiveColors.subText,
          }}
        >
          <p className="text-sm font-mono mb-4">/ 原稿を読み込んでいます...</p>
          <button
            onClick={onBackToHome}
            className="text-xs underline hover:opacity-100"
            style={{ color: effectiveColors.text }}
          >
            ← 作品一覧に戻る
          </button>
        </main>
      ) : (
        <main
          className="mx-auto w-full px-5 sm:px-10 lg:px-12 pt-24 sm:pt-36 lg:pt-40 pb-36 transition-all"
          style={{
            maxWidth: `min(100%, ${settings.contentWidth}px)`,
            boxSizing: 'border-box',
          }}
        >
          {/* Navigation Breadcrumb Line in Sub Color */}
          <div
            className="text-xs mb-4 flex flex-wrap items-center justify-between gap-2 font-normal"
            style={{ color: effectiveColors.subText }}
          >
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <button
                onClick={isSeries ? onBackToSeries : onBackToHome}
                className="hover:underline hover:opacity-100 truncate"
                style={{ color: effectiveColors.subText }}
              >
                / {work.title}
              </button>

              {/* Top Table of Contents Toggle Button */}
              <button
                type="button"
                onClick={() => setShowTopToc(!showTopToc)}
                className="hover:underline transition-opacity ml-1 cursor-pointer font-medium"
                style={{
                  color: showTopToc ? effectiveColors.text : effectiveColors.subText,
                  textDecoration: showTopToc ? 'underline' : 'none',
                }}
                title="上部目次バーを表示/非表示"
              >
                / 目次 {showTopToc ? '[閉じる]' : '[開く]'}
              </button>

              {isSeries && (
                <>
                  <span>/</span>
                  <span className="truncate">{currentEpisode.title}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Active highlight filter status */}
              {settings.highlightFilterMode !== 'none' && visibleHighlights.length > 0 && (
                <span className="text-[11px] font-mono" style={{ color: effectiveColors.subText }}>
                  🖍 {visibleHighlights.length}件のメモ
                </span>
              )}

              {isSeries && (
                <div className="shrink-0 font-mono text-[11px]" style={{ color: effectiveColors.subText }}>
                  {currentIndex + 1} / {sortedEpisodes.length} 話
                </div>
              )}
            </div>
          </div>

          {/* Top Table of Contents: Appears directly below the top breadcrumb when toggled */}
          {showTopToc && (
            <div
              className="mb-10 pb-5 border-b transition-all animate-in fade-in duration-150"
              style={{ borderColor: effectiveColors.subText }}
            >
              <div className="flex flex-wrap items-center gap-y-2 text-xs leading-relaxed">
                {sortedEpisodes.map((ep, idx) => {
                  const isCurrent = ep.tabId === currentEpisode.tabId;
                  return (
                    <React.Fragment key={ep.tabId}>
                      {idx > 0 && (
                        <span className="mx-2 sm:mx-3 select-none opacity-60" style={{ color: effectiveColors.subText }}>
                          /
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigateTab(ep.tabId)}
                        className="hover:underline transition-all cursor-pointer py-0.5"
                        style={{
                          color: isCurrent ? effectiveColors.text : effectiveColors.subText,
                          fontWeight: isCurrent ? 700 : 400,
                          textDecoration: isCurrent ? 'underline' : 'none',
                        }}
                        title={`${idx + 1}話: ${ep.title}`}
                      >
                        {ep.title}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chapter Title & Date Line */}
          <header className={`${showTopToc ? 'mt-4' : 'mt-8'} mb-14 sm:mb-20`}>
            <h1
              className="tracking-tight mb-2.5 font-medium leading-snug break-words"
              style={{
                fontSize: `${settings.fontSize * 1.3}px`,
                fontFamily: activeFontFamily,
                color: effectiveColors.text,
              }}
            >
              <span className="mr-1.5 font-normal" style={{ color: effectiveColors.subText }}>/</span>
              <span>{currentEpisode.title}</span>
            </h1>

            <div
              className="text-xs font-normal flex flex-wrap items-center gap-2"
              style={{ color: effectiveColors.subText }}
            >
              {currentEpisode.publishedAt && <span>{currentEpisode.publishedAt}</span>}
              {currentEpisode.wordCount && (
                <>
                  <span>·</span>
                  <span>約{currentEpisode.wordCount.toLocaleString()}文字</span>
                </>
              )}
              <span>·</span>
              <span>{work.author}</span>
            </div>
          </header>

          {/* Prose Body with Interactive Inline Highlights & Post-it Notes */}
          <article
            className="reading-prose transition-all select-text w-full max-w-full"
            style={{
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineHeight,
              letterSpacing: `${settings.letterSpacing}em`,
              fontFamily: activeFontFamily,
              color: effectiveColors.text,
              textAlign: 'left',
            }}
          >
            {currentEpisode.blocks.map((block, index) => {
              if (block.type === 'HEADING_1') {
                return (
                  <h2
                    key={index}
                    data-p-idx={index}
                    className="font-medium mt-14 mb-8 tracking-tight text-left break-words"
                    style={{
                      fontSize: `${settings.fontSize * 1.15}px`,
                      color: effectiveColors.text,
                    }}
                  >
                    <span className="mr-1.5 font-normal" style={{ color: effectiveColors.subText }}>/</span>
                    <span>{renderParagraphContent(block.text, index)}</span>
                  </h2>
                );
              }

              if (block.type === 'HEADING_2') {
                return (
                  <h3
                    key={index}
                    data-p-idx={index}
                    className="font-medium mt-12 mb-6 tracking-tight text-left break-words"
                    style={{
                      fontSize: `${settings.fontSize * 1.05}px`,
                      color: effectiveColors.text,
                    }}
                  >
                    <span className="mr-1.5 font-normal" style={{ color: effectiveColors.subText }}>//</span>
                    <span>{renderParagraphContent(block.text, index)}</span>
                  </h3>
                );
              }

              // NORMAL_TEXT with interactive highlight segments
              return (
                <p
                  key={index}
                  data-p-idx={index}
                  className="text-left"
                  style={{
                    marginBottom: `${settings.paragraphSpacing}rem`,
                    color: effectiveColors.text,
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                  }}
                >
                  {renderParagraphContent(block.text, index)}
                </p>
              );
            })}
          </article>

          {/* Episode End Marker, Comments, and Web Clap */}
          <section className="my-16 sm:my-24">
            {/* 1. Above ***: Centered horizontal list of episode-level emoji claps with reaction counts */}
            {aggregatedEpisodeClaps.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                {aggregatedEpisodeClaps.map(([emojiChar, info]) => (
                  <button
                    key={`ep_clap_${emojiChar}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleClapReaction(info.item);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border hover:opacity-85 active:scale-95 transition-all cursor-pointer font-sans select-none"
                    style={{
                      borderColor: settings.highlightColor,
                      backgroundColor: `${settings.highlightColor}18`,
                      color: effectiveColors.text,
                      fontSize: `${settings.memoFontSize || 12}px`,
                      mixBlendMode: effectiveColors.isDark ? 'screen' : 'multiply',
                    }}
                    title={`${emojiChar} で拍手を送る`}
                  >
                    <span className="leading-none" style={{ fontSize: `${settings.memoFontSize || 12}px` }}>
                      {emojiChar}
                    </span>
                    <span
                      className="font-mono font-semibold leading-none"
                      style={{ color: settings.highlightColor, fontSize: `${settings.memoFontSize || 12}px` }}
                    >
                      {info.totalCount}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 2. Beside ***: Left [👏], Center ***, Right [＋💭] */}
            <div className="flex items-center justify-center gap-4 text-xs font-serif">
              <button
                type="button"
                onClick={() => setIsEpisodeClapPickerOpen(!isEpisodeClapPickerOpen)}
                className="hover:underline transition-opacity font-sans cursor-pointer text-xs"
                style={{ color: isEpisodeClapPickerOpen ? settings.highlightColor : effectiveColors.subText }}
                title="この話に絵文字・ウェブ拍手を送る"
              >
                [👏]
              </button>

              <span className="tracking-widest text-sm select-none" style={{ color: effectiveColors.subText }}>
                ***
              </span>

              <button
                type="button"
                onClick={() => setIsCommentBoxOpen(!isCommentBoxOpen)}
                className="hover:underline transition-opacity font-sans cursor-pointer text-xs"
                style={{ color: isCommentBoxOpen ? settings.highlightColor : effectiveColors.subText }}
                title="この話にコメント・感想を残す"
              >
                {isCommentBoxOpen ? '[− 💭]' : '[＋💭]'}
              </button>
            </div>

            {/* Episode Clap Picker (when open) */}
            {isEpisodeClapPickerOpen && (
              <div
                className="mt-4 p-3 max-w-sm mx-auto border text-center flex flex-wrap items-center justify-center gap-2 animate-in fade-in duration-100"
                style={{ borderColor: settings.highlightColor }}
              >
                <span className="text-[11px] font-mono select-none" style={{ color: effectiveColors.subText }}>
                  拍手:
                </span>
                {recentEmojis.map((emoji) => (
                  <button
                    key={`ep_picker_${emoji}`}
                    type="button"
                    onClick={() => handleAddEpisodeClap(emoji)}
                    className="hover:scale-125 px-1 text-base cursor-pointer transition-transform"
                    title={`${emoji} で拍手`}
                  >
                    {emoji}
                  </button>
                ))}

                {!isCustomEpisodeEmojiOpen ? (
                  <button
                    type="button"
                    onClick={() => setIsCustomEpisodeEmojiOpen(true)}
                    className="px-1.5 py-0.5 text-xs border hover:opacity-100 font-mono cursor-pointer"
                    style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                    title="他の絵文字を追加 (+)"
                  >
                    +
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={customEpisodeEmojiInput}
                      onChange={(e) => setCustomEpisodeEmojiInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCustomEpisodeEmojiSubmit();
                        } else if (e.key === 'Escape') {
                          setIsCustomEpisodeEmojiOpen(false);
                        }
                      }}
                      placeholder="✨"
                      className="w-10 px-1 text-xs border text-center outline-none bg-transparent"
                      style={{ borderColor: settings.highlightColor, color: effectiveColors.text }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCustomEpisodeEmojiSubmit}
                      className="text-[11px] px-1.5 border hover:underline cursor-pointer"
                      style={{ borderColor: settings.highlightColor, color: settings.highlightColor }}
                    >
                      送信
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* 3. Below ***: 300px height textarea comment box (when open) */}
            {isCommentBoxOpen && (
              <div
                className="mt-6 max-w-xl mx-auto p-4 border animate-in fade-in duration-150"
                style={{ borderColor: settings.highlightColor }}
              >
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="この話への感想やコメントを入力してください（Enterで改行可能）…"
                  className="w-full h-[220px] bg-transparent outline-none resize-none font-sans text-xs leading-relaxed"
                  style={{ color: effectiveColors.text }}
                  autoFocus
                />
                <div
                  className="flex items-center justify-end gap-3 pt-3 border-t text-xs"
                  style={{ borderColor: `${settings.highlightColor}40` }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsCommentBoxOpen(false);
                      setCommentInput('');
                    }}
                    className="hover:underline cursor-pointer opacity-70"
                    style={{ color: effectiveColors.subText }}
                  >
                    [キャンセル]
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEpisodeComment}
                    className="px-3 py-1 font-medium hover:opacity-85 cursor-pointer"
                    style={{
                      backgroundColor: settings.highlightColor,
                      color: '#1A1A1A',
                    }}
                  >
                    コメントを残す
                  </button>
                </div>
              </div>
            )}

            {/* List of comments: sorted oldest to newest (아래로 갈수록 최신순) */}
            {episodeComments.length > 0 && (
              <div className="mt-8 max-w-xl mx-auto space-y-3">
                {episodeComments.map((c) => {
                  const isMine = c.authorEmail === currentUser?.email;
                  const isSelected = activeHlIdForDelete === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isMine) {
                          setActiveHlIdForDelete((prev) => (prev === c.id ? null : c.id));
                        }
                      }}
                      className={`p-3.5 border transition-all ${isMine ? 'cursor-pointer' : ''}`}
                      style={{
                        borderColor: settings.highlightColor,
                        backgroundColor: `${settings.highlightColor}08`,
                      }}
                      title={isMine ? 'クリックで削除ボタンを表示/非表示' : undefined}
                    >
                      <div className="flex items-start justify-between gap-3 text-xs">
                        <div
                          className="font-mono text-[11px] shrink-0 font-medium"
                          style={{ color: settings.highlightColor }}
                        >
                          {c.createdAt || '日付未詳'}
                          {isMine && isSelected && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteHighlight(c.id);
                              }}
                              className="ml-2 text-red-500 hover:underline cursor-pointer font-bold"
                              title="コメントを削除"
                            >
                              [× 削除]
                            </button>
                          )}
                        </div>

                        <div
                          className="text-right leading-relaxed break-words flex-1 font-normal"
                          style={{
                            color: effectiveColors.subText,
                            fontSize: `${settings.memoFontSize || 12}px`,
                            fontFamily: memoFontFamilyCss,
                          }}
                        >
                          {c.memoText}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Bottom Episode Navigation with 作品一覧 and independent 目次 button */}
          <nav
            className="pt-6 flex flex-wrap items-center justify-between gap-4 text-xs font-normal"
            aria-label="回移動"
          >
            {prevEpisode ? (
              <button
                onClick={() => onNavigateTab(prevEpisode.tabId)}
                className="hover:underline transition-opacity py-2 flex items-center gap-1"
                style={{ color: effectiveColors.subText }}
              >
                <span>← 前の話:</span>
                <span className="truncate max-w-[120px] sm:max-w-[200px]" style={{ color: effectiveColors.text }}>
                  {prevEpisode.title}
                </span>
              </button>
            ) : (
              <div className="invisible py-2">前の話はありません</div>
            )}

            {/* Center: 作品一覧 and 目次 side-by-side */}
            <div className="flex items-center gap-2.5 sm:gap-3 py-2">
              <button
                onClick={isSeries ? onBackToSeries : onBackToHome}
                className="hover:underline transition-opacity font-medium"
                style={{ color: effectiveColors.text }}
              >
                作品一覧
              </button>
              <span className="select-none opacity-50" style={{ color: effectiveColors.subText }}>/</span>
              <button
                type="button"
                onClick={() => setShowBottomToc(!showBottomToc)}
                className="hover:underline transition-opacity font-medium cursor-pointer"
                style={{
                  color: showBottomToc ? effectiveColors.text : effectiveColors.subText,
                  textDecoration: showBottomToc ? 'underline' : 'none',
                }}
                title="下部目次バーを表示/非表示"
              >
                目次 {showBottomToc ? '[閉じる]' : '[開く]'}
              </button>
            </div>

            {nextEpisode ? (
              <button
                onClick={() => onNavigateTab(nextEpisode.tabId)}
                className="hover:underline transition-opacity py-2 flex items-center gap-1"
                style={{ color: effectiveColors.subText }}
              >
                <span className="truncate max-w-[120px] sm:max-w-[200px]" style={{ color: effectiveColors.text }}>
                  {nextEpisode.title}
                </span>
                <span>次の話 →</span>
              </button>
            ) : (
              <div className="invisible py-2">次の話はありません</div>
            )}
          </nav>

          {/* Bottom Table of Contents (目次) - Independent toggle */}
          {showBottomToc && (
            <div
              className="mt-6 pt-5 border-t transition-all animate-in fade-in duration-150"
              style={{ borderColor: effectiveColors.subText }}
            >
              <div className="flex flex-wrap items-center gap-y-2 text-xs leading-relaxed">
                {sortedEpisodes.map((ep, idx) => {
                  const isCurrent = ep.tabId === currentEpisode.tabId;
                  return (
                    <React.Fragment key={ep.tabId}>
                      {idx > 0 && (
                        <span className="mx-2 sm:mx-3 select-none opacity-60" style={{ color: effectiveColors.subText }}>
                          /
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onNavigateTab(ep.tabId)}
                        className="hover:underline transition-all cursor-pointer py-0.5"
                        style={{
                          color: isCurrent ? effectiveColors.text : effectiveColors.subText,
                          fontWeight: isCurrent ? 700 : 400,
                          textDecoration: isCurrent ? 'underline' : 'none',
                        }}
                        title={`${idx + 1}話: ${ep.title}`}
                      >
                        {ep.title}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      )}

      {/* Floating Bottom-Right Indicator: Always visible on mobile and desktop */}
      <aside className="fixed bottom-6 right-6 sm:right-8 z-30">
        <div className="flex flex-col items-end gap-1.5 font-mono text-[11px] text-right">
          {bookmarkSavedMsg && (
            <div
              className="px-2 py-0.5 border text-[10px] animate-in fade-in duration-150 font-sans"
              style={{
                borderColor: settings.highlightColor,
                color: settings.highlightColor,
                backgroundColor: `${settings.highlightColor}18`,
              }}
            >
              {bookmarkSavedMsg}
            </div>
          )}
          <button
            type="button"
            onClick={handleSaveBookmark}
            className="hover:underline transition-opacity cursor-pointer font-sans px-1.5 py-0.5 border flex items-center gap-1 text-[11px]"
            style={{
              borderColor: `${settings.highlightColor}60`,
              color: settings.highlightColor,
              backgroundColor: `${settings.highlightColor}10`,
            }}
            title="現在の位置に栞を挟む"
          >
            <span>🔖</span>
            <span>栞を挟む</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="hover:opacity-100 transition-opacity block mt-0.5 font-mono text-[11px]"
            style={{ color: effectiveColors.subText }}
            title="クリックして閲覧設定を開く"
          >
            <div className="flex items-center justify-end gap-1.5">
              <span style={{ color: effectiveColors.text }}>{currentIndex + 1}/{sortedEpisodes.length}話</span>
              <span className="opacity-50">/</span>
              <span>{Math.round(scrollProgress)}%</span>
            </div>
          </button>
        </div>
      </aside>
    </div>
  );
};
