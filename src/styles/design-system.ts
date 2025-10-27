// Design System - Colors, Typography, Spacing

export const colors = {
  // Dark backgrounds
  bgPrimary: '#1a1a1a',
  bgSecondary: '#2a2a2a',
  bgTertiary: '#3a3a3a',
  
  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#9ca3af',
  textTertiary: '#6b7280',
  
  // Accent colors
  accent: '#b85a3a',
  accentGradientStart: '#b85a3a',
  accentGradientEnd: '#d4a944',
  
  // Light theme (for note creation modal)
  lightBg: '#ffffff',
  lightBgSecondary: '#f5f5f5',
  lightText: '#1a1a1a',
  lightTextSecondary: '#6b7280',
  
  // Interactive elements
  hoverBg: '#2d2d2d',
  border: '#3a3a3a',
  borderLight: '#e5e7eb',
  
  // Record button red
  recordRed: '#ef4444',
  
  // Shadows
  shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  shadowLg: '0 10px 15px rgba(0, 0, 0, 0.2)',
};

export const typography = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  
  // Font sizes
  sizeXs: '12px',
  sizeSm: '14px',
  sizeBase: '16px',
  sizeLg: '18px',
  sizeXl: '20px',
  size2xl: '24px',
  size3xl: '32px',
  
  // Font weights
  weightNormal: 400,
  weightMedium: 500,
  weightSemibold: 600,
  weightBold: 700,
  
  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
};

export const borderRadius = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
};

export const transitions = {
  fast: '150ms ease',
  normal: '300ms ease',
  slow: '500ms ease',
};

export const zIndex = {
  base: 0,
  dropdown: 100,
  modal: 200,
  tooltip: 300,
  max: 999,
};
