import React, { useState, useEffect, useCallback } from 'react';
import { ReaderSettingsProvider, useReaderSettings } from './context/ReaderSettingsContext';
import { SAMPLE_NOVELS } from './data/sampleNovels';
import { NovelWork, EpisodeTab, ReaderUser, BookmarkInfo } from './types/novel';
import { Header } from './components/Header';
import { NovelList } from './components/NovelList';
import { SeriesDetail } from './components/SeriesDetail';
import { ReaderView } from './components/ReaderView';
import { HighlightCollectionView } from './components/HighlightCollectionView';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { AuthGate } from './components/AuthGate';
import { AccessDenied } from './components/AccessDenied';
import { initAuth, logout } from './services/auth';
import {
  fetchCatalogFromGas,
  fetchDocFromGas,
  getSavedGasProxyUrl,
  getCachedDoc,
  clearDocCache,
} from './services/gasProxyService';

const BOOKMARK_STORAGE_KEY = 'shosai_latest_bookmark_v1';

function AppContent() {
  const { effectiveColors } = useReaderSettings();

  // Authentication & Authorization state (Pure Zero-DB)
  const [user, setUser] = useState<ReaderUser | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // Works Catalog state
  const [works, setWorks] = useState<NovelWork[]>(SAMPLE_NOVELS);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Document Fetching state (for on-demand episode loading)
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Navigation state
  const [view, setView] = useState<'list' | 'series' | 'reader' | 'highlights'>('list');
  const [activeWorkId, setActiveWorkId] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [initialScrollPercentage, setInitialScrollPercentage] = useState<number>(0);

  // Shiori (栞) Bookmark state
  const [bookmark, setBookmark] = useState<BookmarkInfo | null>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARK_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Load catalog using Google Apps Script Safe Whitelist Proxy
  const loadCatalog = useCallback(async (userEmail: string) => {
    const proxyUrl = getSavedGasProxyUrl();

    // If no proxy URL is configured yet, fall back gracefully to sample novels
    if (!proxyUrl) {
      setWorks(SAMPLE_NOVELS);
      return;
    }

    setIsLoadingCatalog(true);
    setCatalogError(null);
    setIsAccessDenied(false);

    try {
      const liveWorks = await fetchCatalogFromGas(proxyUrl, userEmail);
      if (liveWorks && liveWorks.length > 0) {
        setWorks(liveWorks);
      } else {
        setWorks(SAMPLE_NOVELS);
      }
    } catch (err: any) {
      if (err.isPermissionDenied || err.message?.includes('PERMISSION_DENIED') || err.message?.includes('閲覧権限')) {
        setIsAccessDenied(true);
      } else {
        console.error('Catalog fetch error:', err);
        setCatalogError(err.message || '作品一覧の取得に失敗しました。');
        setWorks(SAMPLE_NOVELS);
      }
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  // Listen to auth changes on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser) => {
        setUser(currentUser);
        setIsAuthInitializing(false);
        if (currentUser.email) {
          loadCatalog(currentUser.email);
        }
      },
      () => {
        setUser(null);
        setIsAuthInitializing(false);
      }
    );

    return () => unsubscribe();
  }, [loadCatalog]);

  // Handle successful login from AuthGate
  const handleAuthSuccess = (loggedUser: ReaderUser) => {
    setUser(loggedUser);
    if (loggedUser.email) {
      loadCatalog(loggedUser.email);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await logout();
    setUser(null);
    setIsAccessDenied(false);
    setView('list');
    setActiveWorkId(null);
    setActiveTabId(null);
  };

  // Re-verify permissions or refresh catalog & clear cached manuscript for fresh Docs fetch
  const handleRefresh = async () => {
    clearDocCache();
    if (user?.email) {
      await loadCatalog(user.email);
    }
    if (activeWork) {
      await ensureEpisodesLoaded(activeWork, true);
    }
  };

  // Find active work & active episode
  const activeWork: NovelWork | undefined = works.find((w) => w.id === activeWorkId);
  const activeEpisode = activeWork?.episodes?.find((e) => e.tabId === activeTabId);

  // Fetch document content with multi-tier caching (in-memory + persistent localStorage cache)
  const ensureEpisodesLoaded = async (work: NovelWork, forceRefresh = false): Promise<EpisodeTab[]> => {
    // Tier 1: In-memory state check (instant, 0ms)
    if (!forceRefresh && work.episodes && work.episodes.length > 0 && work.episodes[0].blocks?.length > 0) {
      return work.episodes;
    }

    // Tier 2: Persistent local storage cache (instant, 0ms, survives page reload)
    if (!forceRefresh) {
      const cached = getCachedDoc(work.id);
      if (cached && cached.episodes && cached.episodes.length > 0) {
        setWorks((prevWorks) =>
          prevWorks.map((w) =>
            w.id === work.id
              ? {
                  ...w,
                  title: w.title || cached.title,
                  episodes: cached.episodes,
                }
              : w
          )
        );
        return cached.episodes;
      }
    }

    const proxyUrl = getSavedGasProxyUrl();
    if (!proxyUrl || !user?.email) {
      return work.episodes || [];
    }

    setIsLoadingDoc(true);
    setDocError(null);

    try {
      const docData = await fetchDocFromGas(proxyUrl, work.id, user.email, forceRefresh);
      const episodes = docData.episodes || [];

      // Update work in local works state
      setWorks((prevWorks) =>
        prevWorks.map((w) =>
          w.id === work.id
            ? {
                ...w,
                title: w.title || docData.title,
                episodes,
              }
            : w
        )
      );

      return episodes;
    } catch (err: any) {
      console.error('Error loading Google Doc:', err);
      let msg = err.message || '原稿ドキュメントの読み込みに失敗しました。';
      setDocError(msg);
      return work.episodes || [];
    } finally {
      setIsLoadingDoc(false);
    }
  };

  // Select a work from list: directly opens Episode 1 in ReaderView (for both series and short stories)
  const handleSelectWork = async (work: NovelWork) => {
    setActiveWorkId(work.id);
    setInitialScrollPercentage(0);

    // If work has no episodes loaded yet, fetch them
    const episodes = await ensureEpisodesLoaded(work);

    if (episodes.length > 0) {
      // Direct reader navigation to episode 1
      setActiveTabId(episodes[0].tabId);
      setView('reader');
    } else {
      setView('series');
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Select an episode to read
  const handleSelectEpisode = async (work: NovelWork, tabId: string) => {
    setActiveWorkId(work.id);
    setInitialScrollPercentage(0);

    const episodes = await ensureEpisodesLoaded(work);
    const targetTabId = episodes.find((e) => e.tabId === tabId) ? tabId : episodes[0]?.tabId || tabId;

    setActiveTabId(targetTabId);
    setView('reader');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // Resume reading from saved Shiori (栞) bookmark
  const handleResumeBookmark = async (b: BookmarkInfo) => {
    const targetWork = works.find((w) => w.id === b.workId);
    if (!targetWork) return;
    setActiveWorkId(targetWork.id);
    const episodes = await ensureEpisodesLoaded(targetWork);
    const matchedEp = episodes.find((e) => e.tabId === b.tabId) || episodes[0];
    if (matchedEp) {
      setActiveTabId(matchedEp.tabId);
      setInitialScrollPercentage(b.scrollPercentage || 0);
      setView('reader');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Delete saved bookmark
  const handleDeleteBookmark = () => {
    setBookmark(null);
    try {
      localStorage.removeItem(BOOKMARK_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear bookmark:', e);
    }
  };

  // Save new bookmark
  const handleSaveBookmark = (b: BookmarkInfo) => {
    setBookmark(b);
    try {
      localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(b));
    } catch (e) {
      console.warn('Failed to save bookmark:', e);
    }
  };

  const handleRetryDoc = async () => {
    if (!activeWork) return;
    const episodes = await ensureEpisodesLoaded(activeWork, true);
    if (episodes && episodes.length > 0) {
      setActiveTabId(episodes[0].tabId);
      if (activeWork.type === 'short' && episodes.length === 1) {
        setView('reader');
      } else {
        setView('series');
      }
    }
  };

  const handleNavigateTab = (tabId: string) => {
    setActiveTabId(tabId);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleGoHome = () => {
    setView('list');
    setActiveWorkId(null);
    setActiveTabId(null);
    setDocError(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleBackToSeries = () => {
    if (activeWork && activeWork.type === 'series') {
      setView('series');
    } else {
      setView('list');
    }
    setDocError(null);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  // 1. Initial Auth Loading screen
  if (isAuthInitializing) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center p-6 text-xs font-mono tracking-widest"
        style={{
          backgroundColor: effectiveColors.bg,
          color: effectiveColors.subText,
        }}
      >
        / 書斎を確認中…
      </div>
    );
  }

  // 2. Gate screen for non-logged-in users (Zero-DB)
  if (!user) {
    return <AuthGate onSuccess={handleAuthSuccess} />;
  }

  // 3. Access Denied screen for users not shared on the Google Sheet
  if (isAccessDenied) {
    return (
      <AccessDenied
        userEmail={user.email}
        onRetry={() => user.email && loadCatalog(user.email)}
        onSwitchAccount={handleLogout}
        onLogout={handleLogout}
        isRetrying={isLoadingCatalog}
      />
    );
  }

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col transition-colors selection:bg-neutral-800 selection:text-neutral-100 dark:selection:bg-neutral-200 dark:selection:text-neutral-900"
      style={{
        backgroundColor: effectiveColors.bg,
        color: effectiveColors.text,
      }}
    >
      {/* Top Bar Header with Highlighter Toggle */}
      <Header
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInfo={() => setIsInfoOpen(true)}
        onGoHome={handleGoHome}
        onOpenHighlights={() => setView(view === 'highlights' ? 'list' : 'highlights')}
        isHighlightsView={view === 'highlights'}
        activeWorkTitle={activeWork?.title}
        activeEpisodeTitle={activeEpisode?.title}
        isReading={view === 'reader'}
        userEmail={user.email}
        onRefresh={handleRefresh}
        onLogout={handleLogout}
        isRefreshing={isLoadingCatalog}
      />

      {/* Main View Router */}
      <div className="flex-1">
        {/* Loading overlay for live Google Docs fetching */}
        {isLoadingDoc && (
          <div
            className="fixed inset-0 z-20 flex items-center justify-center pointer-events-none"
            style={{ backgroundColor: `${effectiveColors.bg}CC` }}
          >
            <div
              className="text-xs tracking-widest font-mono animate-pulse"
              style={{ color: effectiveColors.subText }}
            >
              / Google Docs 原稿を読み込んでいます…
            </div>
          </div>
        )}

        {/* Notice if Google Doc failed to load */}
        {docError && (
          <div
            className="pt-24 px-6 text-center text-xs space-y-1.5"
            style={{ color: '#E53E3E' }}
          >
            <div>/ {docError}</div>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleRetryDoc}
                className="underline hover:opacity-80 cursor-pointer"
                style={{ color: effectiveColors.text }}
              >
                [再試行]
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="underline hover:opacity-80 cursor-pointer"
                style={{ color: effectiveColors.text }}
              >
                [設定・GAS連携ガイドを開く]
              </button>
            </div>
          </div>
        )}

        {view === 'list' && (
          <NovelList
            works={works}
            onSelectWork={handleSelectWork}
            onSelectEpisode={handleSelectEpisode}
            bookmark={bookmark}
            onResumeBookmark={handleResumeBookmark}
            onDeleteBookmark={handleDeleteBookmark}
          />
        )}

        {view === 'series' && activeWork && (
          <SeriesDetail
            work={activeWork}
            onBack={handleGoHome}
            onSelectEpisode={(tabId) => handleSelectEpisode(activeWork, tabId)}
            isLoadingEpisodes={isLoadingDoc}
            episodesError={docError || undefined}
            onRetry={handleRetryDoc}
          />
        )}

        {view === 'reader' && activeWork && activeTabId && (
          <ReaderView
            work={activeWork}
            tabId={activeTabId}
            currentUser={user}
            proxyUrl={getSavedGasProxyUrl()}
            onNavigateTab={handleNavigateTab}
            onBackToSeries={handleBackToSeries}
            onBackToHome={handleGoHome}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onSaveBookmark={handleSaveBookmark}
            initialScrollPercentage={initialScrollPercentage}
          />
        )}

        {view === 'highlights' && (
          <HighlightCollectionView
            works={works}
            currentUserEmail={user.email}
            onSelectEpisode={(work, tabId) => {
              setInitialScrollPercentage(0);
              handleSelectEpisode(work, tabId);
            }}
            onBackToHome={handleGoHome}
          />
        )}
      </div>

      {/* Settings Modal (Theme, HEX 3-Color, Personal Highlighter Color, Font, Spacing, Save Themes, API Sync) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSavedUrlChange={() => user?.email && loadCatalog(user.email)}
      />

      {/* Info Modal */}
      <InfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ReaderSettingsProvider>
      <AppContent />
    </ReaderSettingsProvider>
  );
}
