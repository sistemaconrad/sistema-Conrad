import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { TOAST_DURATION } from '../constants';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ 
  message, 
  type, 
  onClose, 
  duration = TOAST_DURATION 
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500'
  };

  const icons = {
    success: <CheckCircle2 size={20} />,
    error: <AlertCircle size={20} />,
    info: <Info size={20} />
  };

  return (
    <div className={`fixed top-4 right-4 ${styles[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-slide-in-right max-w-md`}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button 
        onClick={onClose}
        className="ml-2 hover:bg-white/20 rounded p-1 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X size={18} />
      </button>
    </div>
  );
};
