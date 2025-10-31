import type { SpacedRepetitionCard } from './spacedRepetitionService';

/**
 * Export flashcards to Anki-compatible CSV format
 * CSV format: front;back (Anki expects semicolon-separated for basic cards)
 */
export function exportFlashcardsToAnkiCSV(cards: SpacedRepetitionCard[]): string {
  // Anki CSV format: front;back (semicolon-separated)
  // First line is header (optional, Anki will handle it)
  const csvLines = ['#separator:semicolon', '#html:true'];
  
  cards.forEach((card) => {
    // Escape quotes and HTML
    const front = escapeCSVField(card.front);
    const back = escapeCSVField(card.back);
    csvLines.push(`${front};${back}`);
  });
  
  return csvLines.join('\n');
}

/**
 * Export flashcards to Anki-compatible TSV format (alternative)
 * TSV format is also commonly used by Anki
 */
export function exportFlashcardsToAnkiTSV(cards: SpacedRepetitionCard[]): string {
  // Anki TSV format: front\tback
  const tsvLines: string[] = [];
  
  cards.forEach((card) => {
    const front = escapeTSVField(card.front);
    const back = escapeTSVField(card.back);
    tsvLines.push(`${front}\t${back}`);
  });
  
  return tsvLines.join('\n');
}

/**
 * Escape special characters for CSV
 */
function escapeCSVField(field: string): string {
  // Replace newlines with <br>
  let escaped = field.replace(/\n/g, '<br>');
  
  // If field contains semicolon or quotes, wrap in quotes and escape quotes
  if (escaped.includes(';') || escaped.includes('"') || escaped.includes('\n')) {
    escaped = `"${escaped.replace(/"/g, '""')}"`;
  }
  
  return escaped;
}

/**
 * Escape special characters for TSV
 */
function escapeTSVField(field: string): string {
  // Replace tabs with spaces, newlines with <br>
  return field
    .replace(/\t/g, ' ')
    .replace(/\n/g, '<br>')
    .replace(/\r/g, '');
}

/**
 * Download file with given content and filename
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export flashcards for Anki import
 */
export function exportToAnki(cards: SpacedRepetitionCard[], format: 'csv' | 'tsv' = 'csv'): void {
  const content = format === 'csv' 
    ? exportFlashcardsToAnkiCSV(cards)
    : exportFlashcardsToAnkiTSV(cards);
  
  const extension = format === 'csv' ? 'csv' : 'txt';
  const mimeType = format === 'csv' ? 'text/csv' : 'text/tab-separated-values';
  
  downloadFile(content, `anki-flashcards-${Date.now()}.${extension}`, mimeType);
}

export const exportService = {
  exportFlashcardsToAnkiCSV,
  exportFlashcardsToAnkiTSV,
  exportToAnki,
  downloadFile,
};

