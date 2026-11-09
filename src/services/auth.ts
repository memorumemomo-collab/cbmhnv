import { ReaderUser } from '../types/novel';

const USER_STORAGE_KEY = 'shosai_reader_user_v2';
const TOKEN_STORAGE_KEY = 'shosai_session_token_v1';

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

// Logged in only when BOTH the user info and the server-issued session token exist.
let currentUser: ReaderUser | null = (() => {
  const user = readJson<ReaderUser>(USER_STORAGE_KEY);
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  return user && token ? user : null;
})();

type AuthListener = (user: ReaderUser | null) => void;
const listeners: Set<AuthListener> = new Set();

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener(currentUser);
    } catch (e) {
      console.error(e);
    }
  });
};

export const initAuth = (
  onAuthSuccess?: (user: ReaderUser) => void,
  onAuthFailure?: () => void
) => {
  if (currentUser) {
    onAuthSuccess?.(currentUser);
  } else {
    onAuthFailure?.();
  }

  const listener: AuthListener = (user) => {
    if (user) onAuthSuccess?.(user);
    else onAuthFailure?.();
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getCurrentUser = (): ReaderUser | null => currentUser;

/** Session token issued by the GAS proxy (HMAC-signed, no database). */
export const getSessionToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * Exchange a Google ID token (from Google Identity Services) for a GAS session token.
 * The GAS side verifies the token with Google and checks the sheet-based allow list.
 */
export const loginWithGoogleIdToken = async (
  proxyUrl: string,
  idToken: string
): Promise<ReaderUser> => {
  const url = new URL(proxyUrl);
  url.searchParams.set('action', 'login');
  url.searchParams.set('idToken', idToken);

  const res = await fetch(url.toString(), { method: 'GET', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`ログインに失敗しました (${res.status})`);
  const json = await res.json();

  if (!json.success) {
    const err = new Error(json.message || json.error || 'ログインに失敗しました。');
    if (json.error === 'PERMISSION_DENIED') (err as any).isPermissionDenied = true;
    throw err;
  }

  const user: ReaderUser = {
    email: String(json.email).toLowerCase(),
    name: json.name || String(json.email).split('@')[0],
    picture: json.picture || undefined,
  };

  currentUser = user;
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_STORAGE_KEY, json.token);
  } catch {}

  notifyListeners();
  return user;
};

export const logout = async (): Promise<void> => {
  currentUser = null;
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('shosai_reader_user_v1'); // legacy (email-only login)
  } catch {}
  notifyListeners();
};
