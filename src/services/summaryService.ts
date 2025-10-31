import { aiGateway, DailyLimitError } from './aiGateway';
import type { Document } from '../types';

interface DocumentContent {
  name: string;
  type: string;
  content: string;
  hasAudio?: boolean;
  hasSlides?: boolean;
}

// Helper: Build balanced context across multiple uploaded documents found in the note content
// It detects sections introduced by lines like "--- Document: <name> ---" or "File: <name>"
// and allocates an equal share of the word budget to each document so later uploads receive equal weight.
function buildBalancedContext(content: string, maxWords: number = 1500): string {
  const lines = (content || '').split(/\n+/);
  const sections: Array<{ title: string; text: string }> = [];
  let currentTitle = 'Document';
  let currentBuffer: string[] = [];

  const pushSection = () => {
    const text = currentBuffer.join('\n').trim();
    if (text) sections.push({ title: currentTitle, text });
    currentBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const docHeaderMatch = line.match(/^---\s*Document:\s*(.+?)\s*---$/i);
    const fileHeaderMatch = line.match(/^File:\s*(.+)$/i);
    if (docHeaderMatch || fileHeaderMatch) {
      pushSection();
      currentTitle = `Document: ${docHeaderMatch ? docHeaderMatch[1] : (fileHeaderMatch ? fileHeaderMatch[1] : 'Unknown')}`;
      continue;
    }
    currentBuffer.push(rawLine);
  }
  pushSection();

  if (sections.length === 0) return content || '';

  const perSectionBase = Math.floor(maxWords / sections.length) || 1;
  let remainder = maxWords - perSectionBase * sections.length;

  const pickFromSection = (text: string, wordsToTake: number): string => {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= wordsToTake) return text.trim();
    return words.slice(0, wordsToTake).join(' ') + '\n[truncated]';
  };

  const balancedParts: string[] = [];
  for (const section of sections) {
    let allocation = perSectionBase;
    if (remainder > 0) {
      allocation += 1;
      remainder -= 1;
    }
    const picked = pickFromSection(section.text, allocation);
    balancedParts.push(`${section.title}\n${picked}`.trim());
  }

  return balancedParts.join('\n\n');
}

export const summaryService = {
  /**
   * Generate a concise, high-signal title from note content and optional documents.
   * Returns a short title suitable for a note list. Falls back to a default if generation fails.
   */
  async generatePerfectTitle(noteContent: string, documents: Document[] = []): Promise<string> {
    try {
      const trimmed = (noteContent || '').trim();
      if (!trimmed) return 'New Note';

      const docNames = (documents || []).slice(0, 6).map(d => `${d.name} [${d.type}]`).join(', ');

      const system = `You are an expert copywriter. Create the single best, specific, human-friendly title from provided content. 
Rules:  
- 4–12 words, Title Case  
- No quotes, no punctuation at end  
- Be specific (topic, angle, scope)  
- No placeholders  
- Prefer content over filenames if they conflict`;

      const user = `Content:\n${trimmed}\n\nDocuments: ${docNames || 'none'}\n\nReturn ONLY the title.`;

      const content = await aiGateway.chatCompletion([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], { model: 'gpt-4o-mini', temperature: 0.4 });

      let title = (content || '').trim();
      // Strip wrapping quotes/backticks if any
      if ((title.startsWith('"') && title.endsWith('"')) || (title.startsWith('\'') && title.endsWith('\''))) {
        title = title.slice(1, -1).trim();
      }
      title = title.replace(/^`+|`+$/g, '').trim();

      // Enforce short length, Title Case-ish
      if (title.length > 90) title = title.slice(0, 90).trim();
      if (!title) return 'New Note';
      return title.replace(/[\.!?\s]+$/g, '');
    } catch (err) {
      console.error('Error generating title:', err);
      return 'New Note';
    }
  },
  /**
   * Intelligently generates a comprehensive summary by analyzing all documents
   * and their relationships (e.g., audio + slides complementing each other)
   */
  async generateIntelligentSummary(
    noteContent: string,
    documents: Document[],
    options?: { detailLevel?: 'concise' | 'standard' | 'comprehensive' }
  ): Promise<string> {
    try {
      // Analyze document types and their relationships
      const docAnalysis = this.analyzeDocumentTypes(documents);
      
      // Build balanced note content to ensure equal representation across uploads
      const chunkWordLimits: Record<string, number> = {
        concise: 900,
        standard: 1300,
        comprehensive: 1700,
      };
      const detail = options?.detailLevel || 'comprehensive';
      const chunkSize = chunkWordLimits[detail] || 1300;
      const balancedNoteContent = buildBalancedContext(noteContent, chunkSize * 2);
      
      // Build context for AI
      const context = {
        noteContent: balancedNoteContent,
        documents: docAnalysis,
        hasAudioSlidesCombo: docAnalysis.hasAudio && docAnalysis.hasSlides,
        detailLevel: detail,
      };

      // Create intelligent prompt based on document types
      const systemPrompt = this.generateSystemPrompt(context);

      // Determine chunk size based on detail level (cost effective):
      // concise: smaller chunks, standard: medium, comprehensive: larger
      // (already computed above)

      // If the note content is very long, summarize in chunks and then merge
      const chunks = this.splitIntoChunksByWords(context.noteContent, chunkSize);

      if (chunks.length > 1) {
        const partialSummaries: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          const partPrompt = this.generateUserPrompt({
            ...context,
            noteContent: chunks[i],
            partInfo: { index: i + 1, total: chunks.length },
          });

          const partRaw = await aiGateway.chatCompletion([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: partPrompt },
          ], { model: 'gpt-4o-mini', temperature: 0.7 });
          partialSummaries.push(this.sanitizeHtmlOutput(partRaw));
        }

        // Merge partial summaries into a single comprehensive summary
        const mergePrompt = this.generateMergePrompt(partialSummaries);
        const mergedRaw = await aiGateway.chatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: mergePrompt },
        ], { model: 'gpt-4o-mini', temperature: 0.5 });
        return this.sanitizeHtmlOutput(mergedRaw);
      } else {
        const userPrompt = this.generateUserPrompt(context);
        const raw = await aiGateway.chatCompletion([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ], { model: 'gpt-4o-mini', temperature: 0.7 });
        return this.sanitizeHtmlOutput(raw);
      }
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate summary');
    }
  },

  /**
   * Normalize model output to ensure ONLY the HTML content remains:
   * - Strips wrapping quotes
   * - Removes surrounding markdown/code fences
   * - Trims whitespace
   */
  sanitizeHtmlOutput(content: string): string {
    let result = content.trim();

    // Remove common markdown code fences that sometimes wrap HTML
    const fencedMatch = result.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fencedMatch) {
      result = fencedMatch[1].trim();
    }

    // Strip single pair of wrapping quotes if the entire payload is quoted
    if ((result.startsWith('"') && result.endsWith('"')) || (result.startsWith('\'') && result.endsWith('\''))) {
      result = result.slice(1, -1).trim();
    }

    // Some models wrap in <p>"..."</p> — remove quotes in that case
    result = result.replace(/(<p>)\s*(["'])([\s\S]*?)\2\s*(<\/p>)/g, (_m, p1, _q, inner, p4) => `${p1}${inner}${p4}`);

    return result;
  },

  splitIntoChunksByWords(text: string, maxWords: number): string[] {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return [text];
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
  },

  estimateTargetWords(text: string, detailLevel: 'concise' | 'standard' | 'comprehensive', isPart: boolean): { min: number; max: number } {
    const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;
    // Base ranges per detail level (single summary)
    const base: Record<string, [number, number]> = {
      concise: [400, 800],
      standard: [900, 1500],
      comprehensive: [1500, 2600],
    };
    let [minBase, maxBase] = base[detailLevel] || base.standard;

    // Scale by input size: small inputs get less, large inputs more
    if (wordCount < 800) {
      minBase = Math.max(350, Math.round(minBase * 0.6));
      maxBase = Math.max(700, Math.round(maxBase * 0.7));
    } else if (wordCount > 4000) {
      minBase = Math.round(minBase * 1.3);
      maxBase = Math.round(maxBase * 1.5);
    }

    // If this is for a part, proportionally reduce
    if (isPart) {
      minBase = Math.max(300, Math.round(minBase * 0.5));
      maxBase = Math.max(600, Math.round(maxBase * 0.6));
    }
    return { min: minBase, max: maxBase };
  },

  analyzeDocumentTypes(documents: Document[]): {
    hasAudio: boolean;
    hasSlides: boolean;
    hasText: boolean;
    audioCount: number;
    slidesCount: number;
    textCount: number;
    documents: DocumentContent[];
  } {
    const analysis = {
      hasAudio: false,
      hasSlides: false,
      hasText: false,
      audioCount: 0,
      slidesCount: 0,
      textCount: 0,
      documents: [] as DocumentContent[],
    };

    documents.forEach((doc) => {
      const isAudio = doc.type === 'audio' || doc.type === 'video';
      const isSlide = doc.name.toLowerCase().includes('slide') ||
                      doc.name.toLowerCase().includes('presentation') ||
                      (doc.type === 'pdf' && doc.name.toLowerCase().match(/slide|presentation/i));
      const isText = doc.type === 'pdf' || doc.type === 'doc' || doc.type === 'text';

      if (isAudio) {
        analysis.hasAudio = true;
        analysis.audioCount++;
        analysis.documents.push({
          name: doc.name,
          type: doc.type,
          content: `[Audio recording: ${doc.name}]`,
          hasAudio: true,
        });
      } else if (isSlide) {
        analysis.hasSlides = true;
        analysis.slidesCount++;
        analysis.documents.push({
          name: doc.name,
          type: doc.type,
          content: `[Slides: ${doc.name}]`,
          hasSlides: true,
        });
      } else if (isText) {
        analysis.hasText = true;
        analysis.textCount++;
        analysis.documents.push({
          name: doc.name,
          type: doc.type,
          content: `[Document: ${doc.name}]`,
        });
      }
    });

    return analysis;
  },

  generateSystemPrompt(context: any): string {
    let prompt = `You are an expert educator and summarizer. Your task is to create a comprehensive, well-structured summary that helps students understand ALL concepts from their learning materials.

CRITICAL: You MUST output ONLY valid HTML that can be used directly in a TipTap rich text editor. Use HTML tags for all formatting. Do NOT wrap the entire response in quotes.

IMPORTANT GUIDELINES FOR HTML OUTPUT:
1. Give EQUAL coverage to all uploaded documents; avoid over-representing the first sections
2. Where multiple documents state the same information, COMBINE and clarify (do not duplicate)
3. Use the voice recording/audio as the PRIMARY source of information when present
4. Use slides or supplementary materials to clarify and supplement information from the audio
5. If information differs between sources, explain ALL perspectives and mark them clearly
6. Include EVERY important concept - nothing should be left out
7. Use proper HTML heading tags: <h1> for main title, <h2> for major sections, <h3> for subsections
8. Create HTML tables using <table>, <thead>, <tbody>, <tr>, <th>, <td> tags when presenting data in tabular format
9. Use <ul> and <li> for unordered lists, <ol> and <li> for ordered lists
10. Use <strong> for bold text, <em> for italic, <mark> for highlighting; to add color emphasis, you MAY use inline styles such as <span style="color:#10b981">correct</span> or <span style="color:#ef4444">warning</span> ONLY when semantically appropriate.
11. Use <blockquote> for important quotations or citations
12. For mathematical formulas, use inline LaTeX with $...$ and block LaTeX with $$...$$
13. Include definitions, explanations, and context for all important terms
14. Cite specific sources (e.g., "As mentioned in the lecture..." or "According to the slides...")
15. Avoid any non-HTML wrappers such as markdown fences or JSON.
16. NEVER include instructional headings or example-only sections (like "Visual Emphasis") in the output. Only include real content derived from the sources.
17. Replace all placeholders with actual content, and OMIT any section that has no content to fill.`;

    if (context.hasAudioSlidesCombo) {
      prompt += `

SPECIAL INSTRUCTIONS FOR AUDIO + SLIDES COMBINATION:
- The audio recording is the main narrative - follow it as your primary source
- Use slides to clarify visuals, diagrams, formulas, or exact quotations
- When the audio mentions "as you can see on the slide", incorporate that content
- If the audio is unclear on a topic, use the slides to fill in the gaps
- Make sure to indicate when specific information comes from slides vs. audio`;
    }

    return prompt;
  },

  generateUserPrompt(context: any): string {
    const partInfo = context.partInfo ? ` (Part ${context.partInfo.index} of ${context.partInfo.total})` : '';
    const targetWords = this.estimateTargetWords(context.noteContent, context.detailLevel, !!context.partInfo);
    let prompt = `Create a comprehensive summary in HTML format${partInfo}. Do not include any instructional text or placeholder labels. Replace placeholders with actual content and omit sections that don't apply.

Target length: approximately ${targetWords.min}-${targetWords.max} words (adapt to content density). Keep coherent and readable.

<h1>[Main Title - Course/Subject Name]</h1>

<h2>Overview</h2>
<p>[Brief overview of the topic/content]</p>

<h2>Key Concepts</h2>
<p>[Detailed explanation of all key concepts with definitions]</p>

<h3>Concept 1: [Name]</h3>
<p>[Detailed explanation with proper citations]</p>

<h3>Concept 2: [Name]</h3>
<p>[Detailed explanation with proper citations]</p>

<h2>Formulas and Equations</h2>
<p>[All mathematical formulas using LaTeX notation]</p>
<ul>
  <li>Formula 1: Use inline LaTeX like $x = y + z$</li>
  <li>Formula 2: Use block LaTeX for display: $$E = mc^2$$</li>
</ul>

<h2>Important Definitions</h2>
<ul>
  <li><strong>Term 1</strong>: Definition with context</li>
  <li><strong>Term 2</strong>: Definition with context</li>
</ul>

<h2>Data Tables</h2>
<p>When presenting data that benefits from tabular format, create HTML tables like this:</p>
<table>
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data 1</td>
      <td>Data 2</td>
    </tr>
  </tbody>
</table>

<h2>Key Takeaways</h2>
<ol>
  <li>[Most important point]</li>
  <li>[Second important point]</li>
</ol>

<h2>References to Source Materials</h2>
<p>[Explicit citations like "According to the lecture..." or "As shown in the slides..."]</p>

---

SOURCE MATERIALS (balanced excerpts across documents):
${context.noteContent}

DOCUMENTS PROVIDED (types only):
${JSON.stringify(context.documents, null, 2)}

CRITICAL REQUIREMENTS:
1. Output ONLY valid HTML - no markdown syntax
2. Give EQUAL coverage to all uploaded documents; avoid over-representing the first sections
3. Merge overlapping information across documents; avoid duplicates and prefer clear phrasing
4. Use proper HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <strong>, <em>, <blockquote>
5. Include HTML tables when data would benefit from tabular presentation
6. Use LaTeX for all mathematical notation: $inline$ and $$block$$
7. Include explicit citations for sources
8. Structure the content naturally with proper semantic HTML tags
9. NO markdown syntax (no #, ##, **, -, etc.) - use HTML tags only
10. Do NOT wrap the entire response in quotes or backticks; return pure HTML only
11. Target length: approximately ${targetWords.min}-${targetWords.max} words for this ${context.partInfo ? 'part' : 'summary'}, adjusted as needed by content fidelity.`;

    return prompt;
  },

  generateMergePrompt(partSummaries: string[]): string {
    const partsHtml = partSummaries
      .map((html, idx) => `<section data-part="${idx + 1}">${html}</section>`)
      .join('\n');

    const prompt = `Merge the following HTML summary sections into ONE cohesive, deduplicated, comprehensive HTML summary. Keep proper semantic structure, consolidate overlapping content, and ensure smooth flow. Include tables where helpful, LaTeX for math, and citations. Do NOT include any instructional text, and return ONLY pure HTML (no quotes, no fences).

${partsHtml}`;

    return prompt;
  },
};

