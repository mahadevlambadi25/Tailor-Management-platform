import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  className?: string;
  containerClassName?: string;
  role?: string;
  ariaLabel?: string;
  ariaModal?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-lg',
  className = '',
  containerClassName = 'items-center justify-center p-3 sm:p-4',
  role = 'dialog',
  ariaLabel,
  ariaModal = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scrolling and attach escape key listener
  useEffect(() => {
    if (!isOpen || !mounted) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, mounted, onClose, closeOnEscape]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto">
      {/* Full viewport backdrop: starts strictly at top:0, left:0, covers 100vw x 100vh */}
      <div
        className="fixed inset-0 w-full h-full bg-black/50 backdrop-blur-sm"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal positioning layer */}
      <div
        className={`relative z-[100000] flex min-h-screen w-full ${containerClassName}`}
        onClick={closeOnBackdropClick ? onClose : undefined}
      >
        {/* Modal dialog */}
        <div
          role={role}
          aria-modal={ariaModal}
          aria-label={ariaLabel}
          className={`relative z-[100001] w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
