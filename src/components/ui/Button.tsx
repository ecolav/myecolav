import React from 'react';
import { DivideIcon as LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  disabled = false,
  className = '',
  type = 'button',
  fullWidth = false
}) => {
  const baseClasses = 'flex items-center justify-center gap-3 font-bold rounded-xl transition-all duration-200 active:scale-95 border';
  
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg border-blue-600 hover:border-blue-700',
    secondary: 'bg-white/80 hover:bg-white text-gray-800 shadow-md border-gray-200 hover:border-gray-300',
    danger: 'bg-red-500 hover:bg-red-600 text-white shadow-lg border-red-500 hover:border-red-600',
    success: 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg border-emerald-500 hover:border-emerald-600'
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-base min-h-[44px]',      // Padrão web
    md: 'px-6 py-3 text-lg min-h-[50px]',        // Touch mínimo (sutilmente maior)
    lg: 'px-8 py-4 text-xl min-h-[56px]',        // Touch confortável
    xl: 'px-10 py-5 text-2xl min-h-[64px]'       // Touch ações principais
  };

  const iconSize = size === 'xl' ? 40 : size === 'lg' ? 32 : size === 'md' ? 24 : 20;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
};