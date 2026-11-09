import { NovelWork, EpisodeTab } from '../types/novel';
import { getSessionToken, logout } from './auth';

// Default deployed Google Apps Script endpoint provided by author
export const DEFAULT_GAS_PROXY_URL =
  'https://script.google.com/macros/s/AKfycbzm5yxA06hItmP5wTjKQkgIg0hWpZeLK2t-oIkcWGkXdwQ2XzaBsVQY40Bm7k6PpOyj/exec';

// Local storage key for author's deployed Google Apps Script Web App URL
export const GAS_PROXY_URL_STORAGE_KEY = 'shosai_gas_proxy_url';

// Default / fallback URL
export const getSavedGasProxyUrl = (): string => {
  return localStorage.getItem(GAS_PROXY_URL_STORAGE_KEY) || DEFAULT_GAS_PROXY_URL;
};

export const saveGasProxyUrl = (url: string): void => {
  localStorage.setItem(GAS_PROXY_URL_STORAGE_KEY, url.trim());
};

/** Mark expired/invalid sessions so the app can send the user back to the login screen. */
function handleUnauthorized(json: { error?: string; message?: string }): void {
  if (json.error === 'UNAUTHORIZED') {
    void logout();
    const err = new Error(json.message || 'ログインの有効期限が切れました。');
    (err as any).isUnauthorized = true;
    throw err;
  }
}

export interface GasApiResponse<T = any> {
  success: boolean;
  error?: string;
  message?: string;
  works?: NovelWork[];
  data?: {
    docId: string;
    title: string;
    episodes: EpisodeTab[];
  };
}

/**
 * Fetch works catalog from Google Apps Script safe proxy.
 */
export async function fetchCatalogFromGas(
  proxyUrl: string,
  userEmail: string
): Promise<NovelWork[]> {
  const url = new URL(proxyUrl);
  url.searchParams.set('action', 'getCatalog');
  url.searchParams.set('token', getSessionToken());

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`API接続エラー (${res.status})`);
  }

  const json: GasApiResponse = await res.json();

  if (!json.success) {
    handleUnauthorized(json);
    if (json.error === 'PERMISSION_DENIED') {
      const err = new Error(json.message || '閲覧権限がありません。');
      (err as any).isPermissionDenied = true;
      throw err;
    }
    throw new Error(json.error || '作品一覧の取得に失敗しました。');
  }

  return json.works || [];
}

const DOC_CACHE_PREFIX = 'shosai_doc_cache_';
const DOC_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export function getCachedDoc(
  docId: string
): { docId: string; title: string; episodes: EpisodeTab[] } | null {
  try {
    const raw = localStorage.getItem(DOC_CACHE_PREFIX + docId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.data && Date.now() - parsed.timestamp < DOC_CACHE_TTL) {
      return parsed.data;
    }
  } catch (e) {
    // Graceful fallback
  }
  return null;
}

export function saveCachedDoc(
  docId: string,
  data: { docId: string; title: string; episodes: EpisodeTab[] }
): void {
  try {
    localStorage.setItem(
      DOC_CACHE_PREFIX + docId,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (e) {
    // Quota exceeded or private browsing error - fail gracefully
  }
}

export function clearDocCache(docId?: string): void {
  try {
    if (docId) {
      localStorage.removeItem(DOC_CACHE_PREFIX + docId);
    } else {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(DOC_CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) {
    // Ignore error
  }
}

/**
 * Fetch novel manuscript content from Google Apps Script safe proxy (with whitelist verification).
 * Automatically reads from local cache if available unless forceRefresh is true.
 */
export async function fetchDocFromGas(
  proxyUrl: string,
  docId: string,
  userEmail: string,
  forceRefresh = false
): Promise<{ docId: string; title: string; episodes: EpisodeTab[] }> {
  // Check local storage cache first
  if (!forceRefresh) {
    const cached = getCachedDoc(docId);
    if (cached && cached.episodes && cached.episodes.length > 0) {
      return cached;
    }
  }

  const url = new URL(proxyUrl);
  url.searchParams.set('action', 'getDoc');
  url.searchParams.set('docId', docId);
  url.searchParams.set('token', getSessionToken());

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`原稿取得エラー (${res.status})`);
  }

  const json: GasApiResponse = await res.json();

  if (!json.success) {
    handleUnauthorized(json);
    if (json.error === 'PERMISSION_DENIED') {
      const err = new Error(json.message || '閲覧権限がありません。');
      (err as any).isPermissionDenied = true;
      throw err;
    }
    if (json.error?.includes('DocumentApp.openById') || json.error?.includes('auth/documents')) {
      throw new Error(
        'GAS権限エラー: Google Apps Scriptのコード内でDocumentAppが使用されています。純粋読み取り専用(.readonly)で動作するREST API版コードをGASに反映してください（画面右上の設定 > 安全連携 でコードをコピーできます）。'
      );
    }
    if (json.error?.includes('403') || json.error?.includes('Google Docs 閲覧権限') || json.error?.includes('Docs API')) {
      throw new Error(
        'Google Docs 閲覧権限エラー (403): GAS 좌측 메뉴의 [서비스(+)]에서 "Google Docs API"를 추가해 주시거나, 문서 공유 권한(배포 계정의 뷰어 권한)을 확인해 주세요.'
      );
    }
    throw new Error(json.error || '原稿の読み込みに失敗しました。');
  }

  if (!json.data) {
    throw new Error('原稿データが空です。');
  }

  // Cache the fetched manuscript locally
  saveCachedDoc(docId, json.data);

  return json.data;
}

/**
 * Fetch all highlights and comments across all works from GAS proxy.
 */
export async function fetchAllHighlightsFromGas(proxyUrl: string): Promise<any[]> {
  const url = new URL(proxyUrl);
  url.searchParams.set('action', 'getAllHighlights');
  url.searchParams.set('token', getSessionToken());

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`ハイライト一覧取得エラー (${res.status})`);
  }

  const json: any = await res.json();
  if (json.success && Array.isArray(json.highlights)) {
    return json.highlights;
  }
  return [];
}

