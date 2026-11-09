import { HighlightMemo } from '../types/novel';
import { getSessionToken, logout } from './auth';

const HIGHLIGHTS_STORAGE_KEY = 'shosai_highlights_v1';

export const SHARED_HIGHLIGHT_PRESETS = [
  { id: 'sky', name: '空青 (スカイ)', color: '#60A5FA', textColor: '#60A5FA' },
  { id: 'mint', name: '青磁 (ミント)', color: '#34D399', textColor: '#34D399' },
  { id: 'purple', name: '藤紫 (バイオレット)', color: '#A78BFA', textColor: '#A78BFA' },
  { id: 'rose', name: '撫子 (ローズ)', color: '#F472B6', textColor: '#F472B6' },
  { id: 'amber', name: '山吹 (アンバー)', color: '#FBBF24', textColor: '#FBBF24' },
  { id: 'slate', name: '薄墨 (スレート)', color: '#94A3B8', textColor: '#94A3B8' },
];

export const HIGHLIGHT_COLOR_PRESETS = SHARED_HIGHLIGHT_PRESETS;
export const OTHER_USERS_COLOR_PRESETS = SHARED_HIGHLIGHT_PRESETS;

export const DEFAULT_HIGHLIGHT_COLOR = SHARED_HIGHLIGHT_PRESETS[0].color; // Sky (#60A5FA)
export const DEFAULT_HIGHLIGHT_TEXT_COLOR = SHARED_HIGHLIGHT_PRESETS[0].textColor;
export const DEFAULT_OTHER_USERS_COLOR = SHARED_HIGHLIGHT_PRESETS[1].color; // Mint (#34D399)

const RECENT_EMOJIS_KEY = 'shosai_recent_emojis_v1';
export const DEFAULT_RECENT_EMOJIS = ['👏', '❤️', '😭', '✨', '🔥'];

/**
 * Get the 5 most recently used emojis (browser persisted).
 */
export const getRecentEmojis = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 5);
      }
    }
  } catch {}
  return DEFAULT_RECENT_EMOJIS;
};

/**
 * Record an emoji as recently used, preserving at most 5 unique entries.
 */
export const recordRecentEmoji = (emoji: string): string[] => {
  const trimmed = emoji.trim();
  if (!trimmed) return getRecentEmojis();
  const current = getRecentEmojis().filter((e) => e !== trimmed);
  const updated = [trimmed, ...current].slice(0, 5);
  try {
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
};

/**
 * 서버(GAS → Google Sheet 'Highlights' 탭)가 유일한 진실의 원천입니다.
 * localStorage 에는 하이라이트/이모지 데이터를 저장하지 않습니다 (최근 사용 이모지 5개만 예외).
 */

interface GasResult {
  success: boolean;
  error?: string;
  [key: string]: any;
}

async function callGas(proxyUrl: string, params: Record<string, string | undefined>): Promise<GasResult> {
  const url = new URL(proxyUrl);
  url.searchParams.set('token', getSessionToken());
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GAS error (${res.status})`);
  const json: GasResult = await res.json();
  if (!json.success && json.error === 'UNAUTHORIZED') void logout();
  if (!json.success) throw new Error(json.error || 'GAS request failed');
  return json;
}

const highlightToParams = (h: HighlightMemo): Record<string, string | undefined> => ({
  id: h.id,
  workId: h.workId,
  tabId: h.tabId,
  paragraphIndex: String(h.paragraphIndex),
  selectedText: h.selectedText,
  memoText: h.memoText || '',
  emoji: h.emoji,
  reactionCount: h.reactionCount !== undefined ? String(h.reactionCount) : undefined,
  color: h.color,
  textColor: h.textColor,
  authorEmail: h.authorEmail,
  authorName: h.authorName || '',
  createdAt: h.createdAt,
  kind: h.kind,
  workTitle: h.workTitle,
  tabTitle: h.tabTitle,
});

/** 한 화(episode)의 하이라이트/메모/이모지/댓글을 시트에서 조회 */
export async function fetchEpisodeHighlights(
  proxyUrl: string,
  workId: string,
  tabId: string
): Promise<HighlightMemo[]> {
  if (!proxyUrl) return [];
  const json = await callGas(proxyUrl, { action: 'getHighlights', workId, tabId });
  return Array.isArray(json.highlights) ? json.highlights : [];
}

/** 모든 작품의 하이라이트/댓글 조회 (하이라이트 모음 화면용) */
export async function fetchAllHighlights(proxyUrl?: string): Promise<HighlightMemo[]> {
  if (!proxyUrl) return [];
  try {
    const json = await callGas(proxyUrl, { action: 'getAllHighlights' });
    return Array.isArray(json.highlights) ? json.highlights : [];
  } catch (e) {
    console.warn('Failed to fetch all highlights:', e);
    return [];
  }
}

/** 하이라이트 / 메모 / 댓글 추가. 서버는 id 기준 upsert 이므로 같은 id 를 다시 보내도 행이 늘지 않습니다. */
export async function addHighlightMemo(proxyUrl: string, highlight: HighlightMemo): Promise<boolean> {
  if (!proxyUrl) return false;
  try {
    await callGas(proxyUrl, { action: 'addHighlight', ...highlightToParams(highlight) });
    return true;
  } catch (e) {
    console.warn('Could not sync highlight to sheet:', e);
    return false;
  }
}

/**
 * 이모지(웹박수) 전송.
 * 서버가 (작품, 화, 문단, 선택문장, 이모지, 작성자) 기준으로 기존 행을 찾아 reactionCount 를 +1 하고,
 * 없을 때만 새 행을 만듭니다. (행 중복 방지)
 * targetId 를 주면 내 행을 id 로 직접 +1 합니다.
 */
export async function reactToHighlight(
  proxyUrl: string,
  hl: HighlightMemo,
  targetId?: string
): Promise<{ id: string; reactionCount: number } | null> {
  if (!proxyUrl) return null;
  try {
    const json = await callGas(proxyUrl, {
      action: 'reactHighlight',
      ...highlightToParams(hl),
      targetId,
    });
    return { id: String(json.id), reactionCount: Number(json.reactionCount) || 1 };
  } catch (e) {
    console.warn('Could not sync reaction to sheet:', e);
    return null;
  }
}

export async function deleteHighlightMemo(proxyUrl: string, highlightId: string): Promise<boolean> {
  if (!proxyUrl) return false;
  try {
    await callGas(proxyUrl, { action: 'deleteHighlight', id: highlightId });
    return true;
  } catch (e) {
    console.warn('Could not sync deletion to sheet:', e);
    return false;
  }
}
