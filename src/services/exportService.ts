import TurndownService from 'turndown';
import type { SpacedRepetitionCard } from './spacedRepetitionService';

/**
 * Escape a field for CSV format
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Escape a field for TSV format
 */
function escapeTSVField(field: string): string {
  return field.replace(/\t/g, ' ').replace(/\n/g, '<br>');
}

/**
 * Download a file with the given content
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
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

export const exportService = {
  /**
   * Export flashcards to Anki format (CSV or TSV)
   */
  exportToAnki(cards: SpacedRepetitionCard[], format: 'csv' | 'tsv' = 'csv'): void {
    if (cards.length === 0) {
      alert('No flashcards to export');
      return;
    }

    if (format === 'csv') {
      const csvRows = cards.map(card => {
        const front = escapeCSVField(card.front);
        const back = escapeCSVField(card.back);
        return `${front},${back}`;
      });

      const csvContent = csvRows.join('\n');
      downloadFile(csvContent, 'flashcards.csv', 'text/csv');
    } else {
      const tsvRows = cards.map(card => {
        const front = escapeTSVField(card.front);
        const back = escapeTSVField(card.back);
        return `${front}\t${back}`;
      });

      const tsvContent = tsvRows.join('\n');
      downloadFile(tsvContent, 'flashcards.tsv', 'text/tab-separated-values');
    }
  },


  /**
   * Export note as Markdown
   */
  async exportNoteToMarkdown(noteTitle: string, noteContent: string, summary?: string): Promise<void> {
    try {
      const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
      });

      let markdown = `# ${noteTitle}\n\n`;

      // Only export summary if provided
      if (summary && summary.trim()) {
        markdown += turndown.turndown(summary);
        markdown += '\n';
      } else {
        // If no summary, but noteContent is provided, export that
        if (noteContent && noteContent.trim()) {
          markdown += turndown.turndown(noteContent);
          markdown += '\n';
        }
      }

      downloadFile(markdown, `${noteTitle.replace(/[^a-z0-9]/gi, '_')}.md`, 'text/markdown;charset=utf-8');
    } catch (error) {
      console.error('Error exporting to Markdown:', error);
      throw new Error('Failed to export note to Markdown');
    }
  },

  /**
   * Strip HTML tags from text (simple version)
   */
  stripHTML(html: string): string {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },
};
