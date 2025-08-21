import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl p-6 border border-white/20
        ${onClick ? 'cursor-pointer hover:shadow-2xl hover:bg-white/80 transition-all duration-300 active:scale-[0.98]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};