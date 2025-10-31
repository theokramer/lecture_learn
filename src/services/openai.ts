import { aiGateway, DailyLimitError } from './aiGateway';

// Helper function to truncate content to ~2000 tokens (approximately 1500 words)
function truncateContent(content: string, maxWords: number = 1500): string {
  const words = content.split(/\s+/);
  if (words.length <= maxWords) {
    return content;
  }
  
  const truncated = words.slice(0, maxWords).join(' ');
  return truncated + '\n\n[Content truncated for processing...]';
}

// Helper: Build balanced context across multiple uploaded documents found in the note content
// It detects sections introduced by lines like "--- Document: <name> ---" or "File: <name>"
// and allocates an equal share of the word budget to each document to avoid biasing the first one.
function buildBalancedContext(content: string, maxWords: number = 1500): string {
  const lines = content.split(/\n+/);
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
      // new section
      pushSection();
      currentTitle = `Document: ${docHeaderMatch ? docHeaderMatch[1] : (fileHeaderMatch ? fileHeaderMatch[1] : 'Unknown')}`;
      continue;
    }
    currentBuffer.push(rawLine);
  }
  pushSection();

  // If we did not detect sections, fall back to simple truncation
  if (sections.length === 0) {
    return truncateContent(content, maxWords);
  }

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

// Helper function to extract JSON from markdown code blocks
export function extractJSON(text: string): string {
  // Try to find JSON in markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  
  // Try to find JSON object/array directly
  const directMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (directMatch) {
    return directMatch[1];
  }
  
  // Return as-is if no JSON found
  return text;
}

export const openaiService = {
  async transcribeAudio(audioBlob: Blob, storagePath?: string, userId?: string): Promise<string> {
    try {
      return await aiGateway.transcribeAudio(audioBlob, storagePath, userId);
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      console.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio. Please try again.');
    }
  },

  async generateFlashcards(text: string, count: number = 20): Promise<Array<{ front: string; back: string }>> {
    try {
      // Balance content across documents to avoid overweighting the first upload
      const balancedText = buildBalancedContext(text, 1500);
      
      const content = await aiGateway.chatCompletion([
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates educational flashcards. Return a JSON array of flashcards with "front" and "back" properties.',
        },
        {
          role: 'user',
          content: `Create EXACTLY ${count} flashcards from the following materials. Requirements:\n1. Give EQUAL coverage to all documents; do not focus only on early sections\n2. Progress difficulty (definitions/facts → concepts/relationships → applications)\n3. Ensure breadth across distinct topics; avoid redundancy\n4. If multiple documents state the same fact, MERGE that into one clear card (do not duplicate) and prefer the clearest wording\n\nMaterials (balanced excerpts from each document):\n${balancedText}\n\nReturn exactly ${count} flashcards as a JSON array with "front" and "back" properties.`,
        },
      ], { model: 'gpt-4o-mini', temperature: 0.7 });
      const jsonContent = extractJSON(content);
      const flashcards = JSON.parse(jsonContent);
      
      // Ensure we return the requested count (if AI returns less, we take what we have; if more, we truncate)
      return Array.isArray(flashcards) ? flashcards.slice(0, count) : [];
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      console.error('Error generating flashcards:', error);
      throw new Error('Failed to generate flashcards. Please try again or upload shorter content.');
    }
  },

  async generateQuiz(text: string, count: number = 15): Promise<Array<{ question: string; options: string[]; correctAnswer: number }>> {
    try {
      // Balance content across documents to avoid overweighting the first upload
      const balancedText = buildBalancedContext(text, 1500);
      
      const content = await aiGateway.chatCompletion([
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates quiz questions. Return a JSON array of questions with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).',
        },
        {
          role: 'user',
          content: `Create EXACTLY ${count} quiz questions from the following materials. Requirements:\n1. Give EQUAL coverage to all documents; do not bias earlier sections\n2. Mix difficulty (recall → application → analysis) and cover different topics\n3. Make distractors plausible but clearly wrong\n4. If multiple documents repeat the same fact, combine knowledge and avoid duplicate questions\n\nMaterials (balanced excerpts from each document):\n${balancedText}\n\nReturn exactly ${count} quiz questions as a JSON array with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).`,
        },
      ], { model: 'gpt-4o-mini', temperature: 0.7 });
      const jsonContent = extractJSON(content);
      const questions = JSON.parse(jsonContent);
      
      // Ensure we return the requested count
      return Array.isArray(questions) ? questions.slice(0, count) : [];
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      console.error('Error generating quiz:', error);
      throw new Error('Failed to generate quiz. Please try again or upload shorter content.');
    }
  },

  async chatCompletions(messages: Array<{ role: 'user' | 'assistant'; content: string }>, context?: string): Promise<string> {
    // Truncate context to avoid rate limits
    const truncatedContext = context ? truncateContent(context, 1000) : undefined;
    
    const systemMessage = {
      role: 'system' as const,
      content: truncatedContext
        ? `You are a helpful study assistant. Use the following context to answer questions:\n\n${truncatedContext}\n\nIMPORTANT: When writing mathematical formulas or equations, ALWAYS wrap them in dollar signs:
- Inline math: $E = mc^2$ or $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$
- Block math (displayed equations): $$\\int_0^1 f(x) dx$$ or $$\\sum_{i=1}^n x_i$$
Always use $...$ for inline formulas and $$...$$ for displayed equations.`
        : 'You are a helpful study assistant. IMPORTANT: When writing mathematical formulas or equations, ALWAYS wrap them in dollar signs:\n- Inline math: $E = mc^2$ or $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$\n- Block math (displayed equations): $$\\int_0^1 f(x) dx$$ or $$\\sum_{i=1}^n x_i$$\nAlways use $...$ for inline formulas and $$...$$ for displayed equations.',
    };

    try {
      return await aiGateway.chatCompletion([systemMessage as any, ...messages], { model: 'gpt-4o-mini', temperature: 0.7 });
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      throw error;
    }
  },

  async generateExercise(text: string, count: number = 10): Promise<Array<{ question: string; solution: string; notes: string }>> {
    try {
      // Truncate content to avoid rate limits
      const truncatedText = truncateContent(text);
      
      const content = await aiGateway.chatCompletion([
        {
          role: 'system',
          content:
            'You are a helpful assistant that creates practice exercises. Return a JSON array of exercises with "question", "solution", and "notes" properties.',
        },
        {
          role: 'user',
          content: `Create EXACTLY ${count} practice exercises from the following text. Make sure to:
1. Cover ALL important concepts and key topics from the text comprehensively
2. Create exercises in progressive difficulty (start with simpler applications, then more complex ones)
3. Include a variety of exercise types:
   - Problem-solving exercises
   - Application of concepts
   - Analysis and critical thinking
   - Synthesis tasks
4. Each exercise should have a clear, detailed solution
5. Include helpful notes with tips or common pitfalls
6. Ensure comprehensive coverage across different themes and topics

Text:
${truncatedText}

Return exactly ${count} exercises as a JSON array with "question", "solution", and "notes" properties.`,
        },
      ], { model: 'gpt-4o-mini', temperature: 0.7 });
      const jsonContent = extractJSON(content);
      const exercises = JSON.parse(jsonContent);
      
      // Ensure we return the requested count
      return Array.isArray(exercises) ? exercises.slice(0, count) : [];
    } catch (error) {
      if (error instanceof DailyLimitError) throw error;
      console.error('Error generating exercises:', error);
      throw new Error('Failed to generate exercises. Please try again or upload shorter content.');
    }
  },
};
