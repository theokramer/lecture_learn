/**
 * Theme utility functions for applying customization preferences
 */

/**
 * Apply accent color to document via CSS custom property
 */
export function applyAccentColor(color: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-gradient-start', color);
    
    // Calculate a complementary gradient end color (slightly lighter/yellower)
    const lighterColor = lightenColor(color, 0.3);
    document.documentElement.style.setProperty('--accent-gradient-end', lighterColor);
    
    // Calculate hover and light variants
    const hoverColor = lightenColor(color, 0.15);
    const lightColor = lightenColor(color, 0.25);
    document.documentElement.style.setProperty('--accent-hover', hoverColor);
    document.documentElement.style.setProperty('--accent-light', lightColor);
    
    // Calculate glow color with opacity
    const glowColor = hexToRgba(color, 0.3);
    document.documentElement.style.setProperty('--accent-glow', glowColor);
  }
}

/**
 * Apply font size scaling to document via CSS custom property
 */
export function applyFontSize(multiplier: number): void {
  if (typeof document !== 'undefined') {
    // Clamp between 0.75 and 2.0
    const clamped = Math.max(0.75, Math.min(2.0, multiplier));
    document.documentElement.style.setProperty('--font-size-multiplier', clamped.toString());
  }
}

/**
 * Apply editor font preference
 */
export function applyEditorFont(font: 'default' | 'monospace'): void {
  if (typeof document !== 'undefined') {
    if (font === 'monospace') {
      document.documentElement.classList.add('editor-monospace');
    } else {
      document.documentElement.classList.remove('editor-monospace');
    }
  }
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Lighten
  const newR = Math.min(255, Math.round(r + (255 - r) * percent));
  const newG = Math.min(255, Math.round(g + (255 - g) * percent));
  const newB = Math.min(255, Math.round(b + (255 - b) * percent));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex color to rgba string
 */
function hexToRgba(hex: string, alpha: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


