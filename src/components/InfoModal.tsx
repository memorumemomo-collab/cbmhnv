import React from 'react';
import { useReaderSettings } from '../context/ReaderSettingsContext';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  const { effectiveColors } = useReaderSettings();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-0 bg-black/15 backdrop-blur-[2px]">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <aside
        style={{
          backgroundColor: effectiveColors.bg,
          color: effectiveColors.text,
        }}
        className="relative z-10 w-full sm:max-w-md h-full overflow-y-auto px-8 sm:px-12 py-12 sm:py-16 text-xs leading-relaxed"
      >
        <div className="flex items-center justify-between pb-3 mb-10 border-b border-current opacity-80">
          <h2 className="text-sm font-medium tracking-tight">/ 書斎の構造と方針</h2>
          <button
            onClick={onClose}
            className="hover:underline transition-opacity"
            style={{ color: effectiveColors.subText }}
            aria-label="閉じる"
          >
            閉じる
          </button>
        </div>

        <div className="space-y-8">
          <section>
            <div className="font-medium mb-1.5" style={{ color: effectiveColors.text }}>/ 非公開の原則</div>
            <p className="leading-relaxed" style={{ color: effectiveColors.subText }}>
              当サイトは商業小説プラットフォームではなく、著者が執筆した原稿を個人的に保管し、許可された読者のみが静かに閲覧するための非公開閲覧室です。
            </p>
          </section>

          <section>
            <div className="font-medium mb-1.5" style={{ color: effectiveColors.text }}>/ 原稿連携システム (Google Docs)</div>
            <p className="leading-relaxed" style={{ color: effectiveColors.subText }}>
              1シリーズは Google Docs 文書1つに対応し、各エピソードは文書内部のタブ(tabId)で管理されます。元の装飾に左右されず、文芸誌風の独自活字で快適に読書できます。
            </p>
          </section>

          <section>
            <div className="font-medium mb-1.5" style={{ color: effectiveColors.text }}>/ 権限・作品管理 (Google Sheets)</div>
            <p className="leading-relaxed" style={{ color: effectiveColors.subText }}>
              作品登録および読者のアクセス権限は、管理用 Google Sheets にて直接管理されます。閲覧画面には管理用の不要なカードやボタンは一切表示されません。
            </p>
          </section>
        </div>

        <div className="mt-14 pt-6 border-t border-current flex justify-end opacity-60">
          <button
            onClick={onClose}
            className="hover:underline transition-opacity py-1 font-medium"
            style={{ color: effectiveColors.subText }}
          >
            / 閉じる
          </button>
        </div>
      </aside>
    </div>
  );
};
