import React from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';

interface AccessDeniedProps {
  userEmail?: string | null;
  onRetry: () => void;
  onSwitchAccount: () => void;
  onLogout: () => void;
  isRetrying?: boolean;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  userEmail,
  onRetry,
  onSwitchAccount,
  onLogout,
  isRetrying = false,
}) => {
  const { effectiveColors, settings } = useReaderSettings();

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
        style={{ maxWidth: `min(100%, ${Math.min(settings.contentWidth, 560)}px)` }}
      >
        {/* Title */}
        <div className="mb-10">
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{ color: effectiveColors.subText }}
          >
            Access Restriction
          </p>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-wide flex items-baseline gap-2">
            <span style={{ color: effectiveColors.subText }}>/</span>
            <span>入室制限</span>
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-4 text-sm sm:text-base leading-relaxed mb-10">
          <p>
            閲覧権限が確認できませんでした。
          </p>
          <p style={{ color: effectiveColors.subText }}>
            現在ログイン中のアカウント
            {userEmail && (
              <span className="font-mono mx-1 underline" style={{ color: effectiveColors.text }}>
                {userEmail}
              </span>
            )}
            は、管理者の管理用スプレッドシートの共有対象に含まれていません。
          </p>
          <p className="text-xs pt-1" style={{ color: effectiveColors.subText }}>
            ※ 本書斎の作品リストおよび本文を閲覧するには、執筆者によるGoogleスプレッドシートへの共有（閲覧権限の付与）が必要です。
          </p>
        </div>

        {/* Action links */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2 text-sm">
          <button
            type="button"
            onClick={onRetry}
            disabled={isRetrying}
            className="cursor-pointer tracking-wider hover:opacity-75 transition-opacity pb-0.5 border-b"
            style={{ color: effectiveColors.text, borderColor: effectiveColors.text }}
          >
            {isRetrying ? '権限を再確認中…' : '権限を再確認する（更新）'}
          </button>

          <button
            type="button"
            onClick={onSwitchAccount}
            className="cursor-pointer tracking-wider hover:opacity-75 transition-opacity pb-0.5 border-b"
            style={{ color: effectiveColors.subText, borderColor: effectiveColors.subText }}
          >
            別のアカウントで入室し直す
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer tracking-wider hover:opacity-75 transition-opacity pb-0.5"
            style={{ color: effectiveColors.subText }}
          >
            退出（ログアウト）
          </button>
        </div>
      </div>
    </div>
  );
};
