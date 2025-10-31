import React, { createContext, useContext, useState } from 'react';

interface PdfSelectionContextType {
  selectedText: string;
  setSelectedText: (text: string) => void;
  clearSelection: () => void;
}

const PdfSelectionContext = createContext<PdfSelectionContextType | undefined>(undefined);

export const PdfSelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedText, setSelectedText] = useState('');

  const clearSelection = () => setSelectedText('');

  return (
    <PdfSelectionContext.Provider value={{ selectedText, setSelectedText, clearSelection }}>
      {children}
    </PdfSelectionContext.Provider>
  );
};

export const usePdfSelection = () => {
  const context = useContext(PdfSelectionContext);
  if (!context) {
    throw new Error('usePdfSelection must be used within PdfSelectionProvider');
  }
  return context;
};

