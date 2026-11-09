import React, { useEffect, useRef, useState } from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { loginWithGoogleIdToken } from '../services/auth';
import { getSavedGasProxyUrl } from '../services/gasProxyService';
import { GOOGLE_CLIENT_ID } from '../config';
import { ReaderUser } from '../types/novel';

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthGateProps {
  onSuccess: (user: ReaderUser) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSuccess }) => {
  const { effectiveColors, settings } = useReaderSettings();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    const handleCredential = async (response: { credential?: string }) => {
      if (!response.credential) return;
      setError(null);
      setLoading(true);
      try {
        const user = await loginWithGoogleIdToken(getSavedGasProxyUrl(), response.credential);
        onSuccessRef.current(user);
      } catch (err: any) {
        setError(err.message || 'ログインに失敗しました。');
        setLoading(false);
      }
    };

    const init = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: 'signin_with',
        width: 260,
      });
    };

    if (window.google?.accounts?.id) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = init;
      script.onerror = () => setError('Googleログインを読み込めませんでした。ネットワークを確認してください。');
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center items-center px-6 py-16"
      style={{
        backgroundColor: effectiveColors.bg,
        color: effectiveColors.text,
      }}
    >
      <div
        className="w-full text-left"
        style={{ maxWidth: `min(100%, ${Math.min(settings.contentWidth, 540)}px)` }}
      >
        {/* Title with slash */}
        <div className="mb-12">
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: effectiveColors.subText }}
          >
            Private Novel Library
          </p>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-wide flex items-baseline gap-2">
            <span style={{ color: effectiveColors.subText }}>/</span>
            <span>書斎</span>
          </h1>
        </div>

        {/* Description */}
        <div
          className="space-y-4 text-sm sm:text-base leading-relaxed mb-10"
          style={{ color: effectiveColors.subText }}
        >
          <p>
            執筆者が個人で管理する非公開の小説閲覧室です。
          </p>
          <p>
            作品一覧および本文の閲覧には、管理者のGoogleスプレッドシートで許可されたGoogleアカウントが必要です。
          </p>
          <p className="text-xs pt-2">
            ※ 外部データベース(Firebase等)は一切使用していません。原稿URLや管理シートが外部に公開されることはありません。
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="text-xs py-2 mb-4"
            style={{ color: '#E53E3E' }}
          >
            {error}
          </div>
        )}

        {/* Google Sign-In (ID token is verified on the GAS side; no database) */}
        <div className="space-y-3">
          <div ref={buttonRef} className={loading ? 'opacity-50 pointer-events-none' : ''} />
          {loading && (
            <p className="text-xs font-mono" style={{ color: effectiveColors.subText }}>
              / 入室確認中…
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
