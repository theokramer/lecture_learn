import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm text-[#9ca3af] mb-2">{label}</label>
      )}
      <input
        className={`
          w-full px-4 py-2 
          bg-[#2a2a2a] border border-[#3a3a3a] 
          rounded-lg 
          text-white placeholder:text-[#6b7280]
          focus:outline-none focus:border-[#b85a3a] 
          transition-colors duration-300
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-[#ef4444]">{error}</p>
      )}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm text-[#9ca3af] mb-2">{label}</label>
      )}
      <textarea
        className={`
          w-full px-4 py-2 
          bg-[#2a2a2a] border border-[#3a3a3a] 
          rounded-lg 
          text-white placeholder:text-[#6b7280]
          focus:outline-none focus:border-[#b85a3a] 
          transition-colors duration-300
          resize-none
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-[#ef4444]">{error}</p>
      )}
    </div>
  );
};
