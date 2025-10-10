import React, { useEffect } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';

interface SuccessFeedbackProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  submessage?: string;
  duration?: number;
  onClose?: () => void;
  autoClose?: boolean;
}

export const SuccessFeedback: React.FC<SuccessFeedbackProps> = ({
  type,
  message,
  submessage,
  duration = 2000,
  onClose,
  autoClose = true
}) => {
  useEffect(() => {
    if (autoClose && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  const config = {
    success: {
      bg: 'bg-green-500',
      icon: Check,
      iconBg: 'bg-green-600',
      text: 'text-white'
    },
    error: {
      bg: 'bg-red-500',
      icon: X,
      iconBg: 'bg-red-600',
      text: 'text-white'
    },
    warning: {
      bg: 'bg-orange-500',
      icon: AlertTriangle,
      iconBg: 'bg-orange-600',
      text: 'text-white'
    }
  };

  const Icon = config[type].icon;

  return (
    <div 
      className={`fixed inset-0 z-50 ${config[type].bg} flex flex-col items-center justify-center animate-in fade-in zoom-in duration-200`}
      onClick={onClose}
    >
      <div className="text-center">
        {/* Icon */}
        <div className={`w-40 h-40 ${config[type].iconBg} rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl animate-bounce`}>
          <Icon size={100} className="text-white" strokeWidth={3} />
        </div>

        {/* Message */}
        <h2 className={`text-6xl font-bold ${config[type].text} mb-4 drop-shadow-lg`}>
          {message}
        </h2>

        {submessage && (
          <p className={`text-3xl ${config[type].text} opacity-90 drop-shadow`}>
            {submessage}
          </p>
        )}

        {/* Progress bar (apenas se autoClose) */}
        {autoClose && (
          <div className="mt-12 w-96 mx-auto">
            <div className="h-3 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full animate-progress"
                style={{ animation: `progress ${duration}ms linear` }}
              />
            </div>
          </div>
        )}

        {/* Toque para fechar */}
        {!autoClose && onClose && (
          <button
            onClick={onClose}
            className="mt-12 px-12 py-6 bg-white text-gray-900 text-2xl font-bold rounded-2xl hover:bg-gray-100 active:scale-95 transition-all shadow-lg"
          >
            Toque para continuar
          </button>
        )}
      </div>

      <style>{`
        @keyframes progress {
          from { width: 100%; }
          to { width: 0%; }
        }
        .animate-progress {
          animation: progress ${duration}ms linear;
        }
      `}</style>
    </div>
  );
};

// Hook para usar o feedback facilmente
export function useSuccessFeedback() {
  const [feedback, setFeedback] = React.useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    submessage?: string;
  } | null>(null);

  const showSuccess = (message: string, submessage?: string) => {
    setFeedback({ type: 'success', message, submessage });
  };

  const showError = (message: string, submessage?: string) => {
    setFeedback({ type: 'error', message, submessage });
  };

  const showWarning = (message: string, submessage?: string) => {
    setFeedback({ type: 'warning', message, submessage });
  };

  const hide = () => {
    setFeedback(null);
  };

  const FeedbackComponent = feedback ? (
    <SuccessFeedback
      type={feedback.type}
      message={feedback.message}
      submessage={feedback.submessage}
      onClose={hide}
    />
  ) : null;

  return {
    showSuccess,
    showError,
    showWarning,
    hide,
    FeedbackComponent
  };
}


