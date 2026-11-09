import React, { useState } from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';
import { loginWithPassword } from '../services/auth';
import { getSavedGasProxyUrl } from '../services/gasProxyService';
import { ReaderUser } from '../types/novel';

interface AuthGateProps {
  onSuccess: (user: ReaderUser) => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onSuccess }) => {
  const { effectiveColors, settings } = useReaderSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithPassword(getSavedGasProxyUrl(), email, password);
      onSuccess(user);
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました。');
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: effectiveColors.text,
    borderBottom: `1px solid ${effectiveColors.subText}`,
  };

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
            作品一覧および本文の閲覧には、管理者に許可されたメールアドレスと、共有の合言葉が必要です。
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

        {/* E-mail + shared password (verified on the GAS side; no database) */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <input
              type="email"
              autoComplete="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full py-2 text-sm outline-none"
              style={inputStyle}
              disabled={loading}
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="合言葉"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-2 text-sm outline-none"
              style={inputStyle}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="text-sm font-mono tracking-wide disabled:opacity-40"
            style={{ color: effectiveColors.text }}
          >
            {loading ? '/ 入室確認中…' : '/ 入室する →'}
          </button>
        </form>
      </div>
    </div>
  );
};
