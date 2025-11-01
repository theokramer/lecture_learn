import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  onClick,
  hoverable = true,
}) => {
  const baseStyles = 'bg-bg-secondary rounded-lg shadow-md border border-border-primary transition-all duration-300';
  
  if (onClick || hoverable) {
    return (
      <motion.div
        whileHover={hoverable ? { scale: 1.02 } : {}}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`${baseStyles} ${hoverable ? 'hover:bg-bg-hover hover:shadow-lg hover:border-accent/30' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={`${baseStyles} ${className}`}>
      {children}
    </div>
  );
};
