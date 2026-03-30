import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string | React.ReactNode;
  type?: ToastType;
  isOpen: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'info', 
  isOpen, 
  onClose, 
  duration = 5000 
}) => {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertCircle className="w-5 h-5 text-amber-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success': return 'bg-white dark:bg-gray-800 border-green-100 dark:border-green-900/50 shadow-green-100/50 dark:shadow-none text-gray-700 dark:text-gray-200';
      case 'error': return 'bg-white dark:bg-gray-800 border-red-100 dark:border-red-900/50 shadow-red-100/50 dark:shadow-none text-gray-700 dark:text-gray-200';
      case 'warning': return 'bg-white dark:bg-gray-800 border-amber-100 dark:border-amber-900/50 shadow-amber-100/50 dark:shadow-none text-gray-700 dark:text-gray-200';
      default: return 'bg-white dark:bg-gray-800 border-blue-100 dark:border-blue-900/50 shadow-blue-100/50 dark:shadow-none text-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[60] flex items-start gap-3 p-4 rounded-lg shadow-lg border animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md ${getStyles()}`}>
      <div className="shrink-0 mt-0.5">
        {getIcon()}
      </div>
      <div className="flex-1 text-sm leading-relaxed">
        {message}
      </div>
      <button 
        onClick={onClose}
        className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-0.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
