import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const baseStyles = 'rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg';
  
  const variants = {
    primary: 'bg-accent text-white hover:bg-[var(--accent-hover)] border border-accent hover:border-[var(--accent-hover)] shadow-glow hover:shadow-glow-lg',
    secondary: 'bg-bg-secondary text-text-primary hover:bg-bg-hover border border-border-primary hover:border-border-secondary',
    ghost: 'bg-transparent text-text-primary hover:bg-bg-hover',
    danger: 'bg-red-500 text-white hover:bg-red-600 border border-red-500 hover:border-red-600',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
};
