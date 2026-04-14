import { useEffect, useRef, useState } from "react";
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [closeHintActive, setCloseHintActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (typeof scrollContainer.scrollTo === "function") {
      scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    scrollContainer.scrollTop = 0;
  }, [isOpen, resetScrollKey]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!closeHintActive) return;

    const timeoutId = window.setTimeout(() => {
      setCloseHintActive(false);
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [closeHintActive]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => setCloseHintActive(true)}
    >
      <div 
        className={`flex max-h-[calc(100vh-1.5rem)] w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 dark:bg-gray-800 sm:max-h-[95vh] sm:rounded-2xl ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="z-10 flex flex-shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white p-4 transition-colors dark:border-gray-700 dark:bg-gray-800 sm:gap-4">
            {title && <div className="flex-1 text-lg font-bold text-gray-900 dark:text-white sm:text-xl">{title}</div>}
            {showCloseButton && (
              <button 
                onClick={onClose}
                aria-label="Cerrar modal"
                className={`rounded-full p-2 transition-colors flex-shrink-0 ${closeHintActive ? "bg-red-50 text-red-600 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-800" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
              >
                <X className={`w-5 h-5 ${closeHintActive ? "text-red-500 dark:text-red-300" : "text-gray-500 dark:text-gray-400"}`} />
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
