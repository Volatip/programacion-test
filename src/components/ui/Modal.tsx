import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  resetScrollKey?: string | number | null;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = "max-w-lg",
  showCloseButton = true,
  resetScrollKey = null,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [isOpen, resetScrollKey]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      ref={overlayRef}
    >
      <div 
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="bg-white dark:bg-gray-800 z-10 border-b border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between flex-shrink-0 gap-4 transition-colors">
            {title && <div className="text-xl font-bold text-gray-900 dark:text-white flex-1">{title}</div>}
            {showCloseButton && (
              <button 
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        )}
        <div ref={scrollContainerRef} className="overflow-y-auto flex-1">
            {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
