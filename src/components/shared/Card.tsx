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
  const baseStyles = 'bg-[#2a2a2a] rounded-lg shadow-md';
  
  if (onClick || hoverable) {
    return (
      <motion.div
        whileHover={hoverable ? { scale: 1.02, backgroundColor: '#2d2d2d' } : {}}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`${baseStyles} ${className} ${onClick ? 'cursor-pointer' : ''}`}
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
