import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true,
});
import type { Note, Document } from '../types';

interface DocumentContent {
  name: string;
  type: string;
  content: string;
  hasAudio?: boolean;
  hasSlides?: boolean;
}

export const summaryService = {
  /**
   * Intelligently generates a comprehensive summary by analyzing all documents
   * and their relationships (e.g., audio + slides complementing each other)
   */
  async generateIntelligentSummary(
    noteContent: string,
    documents: Document[]
  ): Promise<string> {
    try {
      // Analyze document types and their relationships
      const docAnalysis = this.analyzeDocumentTypes(documents);
      
      // Build context for AI
      const context = {
        noteContent,
        documents: docAnalysis,
        hasAudioSlidesCombo: docAnalysis.hasAudio && docAnalysis.hasSlides,
      };

      // Create intelligent prompt based on document types
      const systemPrompt = this.generateSystemPrompt(context);
      const userPrompt = this.generateUserPrompt(context);

      // Call OpenAI directly with proper message structure
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
      });

      return completion.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating summary:', error);
      throw new Error('Failed to generate summary');
    }
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

CRITICAL: You MUST output ONLY valid HTML that can be used directly in a TipTap rich text editor. Use HTML tags for all formatting.

IMPORTANT GUIDELINES FOR HTML OUTPUT:
1. Use the voice recording/audio as the PRIMARY source of information
2. Use slides or supplementary materials to clarify and supplement information from the audio
3. If information differs between sources, explain ALL perspectives and mark them clearly
4. Include EVERY important concept - nothing should be left out
5. Use proper HTML heading tags: <h1> for main title, <h2> for major sections, <h3> for subsections
6. Create HTML tables using <table>, <thead>, <tbody>, <tr>, <th>, <td> tags when presenting data in tabular format
7. Use <ul> and <li> for unordered lists, <ol> and <li> for ordered lists
8. Use <strong> for bold text, <em> for italic, <mark> for highlighting
9. Use <blockquote> for important quotations or citations
10. For mathematical formulas, use inline LaTeX with $...$ and block LaTeX with $$...$$
11. Include definitions, explanations, and context for all important terms
12. Cite specific sources (e.g., "As mentioned in the lecture..." or "According to the slides...")`;

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
    let prompt = `Create a comprehensive summary in HTML format with the following structure:

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

SOURCE MATERIALS:
${context.noteContent}

DOCUMENTS PROVIDED:
${JSON.stringify(context.documents, null, 2)}

CRITICAL REQUIREMENTS:
1. Output ONLY valid HTML - no markdown syntax
2. Use proper HTML tags: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <table>, <strong>, <em>, <blockquote>
3. Include HTML tables when data would benefit from tabular presentation
4. Use LaTeX for all mathematical notation: $inline$ and $$block$$
5. Make sure your summary includes EVERY concept mentioned in the source materials
6. Include explicit citations for sources
7. Structure the content naturally with proper semantic HTML tags
8. NO markdown syntax (no #, ##, **, -, etc.) - use HTML tags only`;

    return prompt;
  },
};

