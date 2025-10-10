import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface BigButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  fullWidth?: boolean;
  subtitle?: string;
}

/**
 * BigButton - Botão otimizado para touch screen de totem
 * Altura mínima 100px, ícone grande, texto legível a distância
 */
export const BigButton: React.FC<BigButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  icon: Icon,
  disabled = false,
  className = '',
  fullWidth = false,
  subtitle
}) => {
  const variantClasses = {
    primary: 'bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-blue-700',
    secondary: 'bg-gradient-to-br from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-900 border-gray-300',
    success: 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white border-green-600',
    danger: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-red-600',
    warning: 'bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-orange-600'
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex flex-col items-center justify-center gap-3
        min-h-[120px] px-8 py-6
        rounded-2xl
        font-bold text-2xl
        border-4
        shadow-xl
        transition-all duration-200
        active:scale-95 active:shadow-lg
        ${variantClasses[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {Icon && (
        <Icon size={48} strokeWidth={2.5} />
      )}
      
      <div className="text-center">
        <div className="leading-tight">{children}</div>
        {subtitle && (
          <div className="text-base font-normal opacity-90 mt-1">
            {subtitle}
          </div>
        )}
      </div>
    </button>
  );
};


