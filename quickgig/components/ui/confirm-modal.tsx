'use client';

import { useEffect } from 'react';

interface ConfirmModalProps {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmText = 'CONFIRM',
  cancelText = 'CANCEL',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="border-4 border-black bg-white max-w-md w-full">
        {/* Header */}
        <div className="border-b-4 border-black bg-black text-white p-3 sm:p-4">
          <h2 className="font-black text-base sm:text-lg md:text-xl uppercase tracking-tight">
            {title}
          </h2>
        </div>

        {/* Content */}
        {message && (
          <div className="p-4 sm:p-5 md:p-6">
            <p className="font-mono text-xs sm:text-sm text-black">{message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t-4 border-black p-3 sm:p-4 flex gap-2 sm:gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 sm:h-11 md:h-12 border-2 border-black bg-white text-black md:hover:bg-black md:hover:text-white transition-colors duration-200 font-bold text-[10px] sm:text-xs uppercase tracking-wide"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-10 sm:h-11 md:h-12 border-2 border-black bg-black text-white md:hover:bg-white md:hover:text-black transition-colors duration-200 font-bold text-[10px] sm:text-xs uppercase tracking-wide"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
