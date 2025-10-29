import OpenAI from 'openai';

const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

if (!apiKey) {
  throw new Error('Missing OpenAI API key. Please check your .env file.');
}

const openai = new OpenAI({
  apiKey,
  dangerouslyAllowBrowser: true,
});

// Helper function to truncate content to ~2000 tokens (approximately 1500 words)
function truncateContent(content: string, maxWords: number = 1500): string {
  const words = content.split(/\s+/);
  if (words.length <= maxWords) {
    return content;
  }
  
  const truncated = words.slice(0, maxWords).join(' ');
  return truncated + '\n\n[Content truncated for processing...]';
}

// Helper function to extract JSON from markdown code blocks
function extractJSON(text: string): string {
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
  async transcribeAudio(audioBlob: Blob): Promise<string> {
    const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    return transcription.text;
  },

  async generateFlashcards(text: string, count: number = 20): Promise<Array<{ front: string; back: string }>> {
    try {
      // Truncate content to avoid rate limits
      const truncatedText = truncateContent(text);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper, faster model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates educational flashcards. Return a JSON array of flashcards with "front" and "back" properties.',
          },
          {
            role: 'user',
            content: `Create EXACTLY ${count} flashcards from the following text. Make sure to:
1. Cover ALL important concepts and key information from the text
2. Include flashcards in progressive difficulty (easier definitions and facts first, then more complex concepts)
3. Ensure comprehensive coverage of diverse topics and themes
4. Create cards that help test different aspects: definitions, relationships, processes, and applications
5. Avoid redundancy - each flashcard should cover unique information

Text:
${truncatedText}

Return exactly ${count} flashcards as a JSON array with "front" and "back" properties.`,
          },
        ],
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content || '[]';
      const jsonContent = extractJSON(content);
      const flashcards = JSON.parse(jsonContent);
      
      // Ensure we return the requested count (if AI returns less, we take what we have; if more, we truncate)
      return Array.isArray(flashcards) ? flashcards.slice(0, count) : [];
    } catch (error) {
      console.error('Error generating flashcards:', error);
      throw new Error('Failed to generate flashcards. Please try again or upload shorter content.');
    }
  },

  async generateQuiz(text: string, count: number = 15): Promise<Array<{ question: string; options: string[]; correctAnswer: number }>> {
    try {
      // Truncate content to avoid rate limits
      const truncatedText = truncateContent(text);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper, faster model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates quiz questions. Return a JSON array of questions with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).',
          },
          {
            role: 'user',
            content: `Create EXACTLY ${count} quiz questions from the following text. Make sure to:
1. Cover ALL important concepts and information from the text comprehensively
2. Include questions in progressive difficulty (basic recall first, then application, then analysis)
3. Use diverse question types:
   - Recall questions (Who, What, When, Where)
   - Application questions (How to apply concepts)
   - Analysis questions (Why, relationships between concepts)
4. Ensure each question tests different aspects of the content
5. Make incorrect options plausible but clearly wrong
6. Cover different topics and themes to ensure comprehensive coverage

Text:
${truncatedText}

Return exactly ${count} quiz questions as a JSON array with "question", "options" (array of 4 strings), and "correctAnswer" (index 0-3).`,
          },
        ],
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content || '[]';
      const jsonContent = extractJSON(content);
      const questions = JSON.parse(jsonContent);
      
      // Ensure we return the requested count
      return Array.isArray(questions) ? questions.slice(0, count) : [];
    } catch (error) {
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
        ? `You are a helpful study assistant. Use the following context to answer questions:\n\n${truncatedContext}`
        : 'You are a helpful study assistant.',
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Use cheaper model with higher rate limits
      messages: [systemMessage, ...messages],
      temperature: 0.7,
    });

    return completion.choices[0].message.content || '';
  },

  async generateExercise(text: string, count: number = 10): Promise<Array<{ question: string; solution: string; notes: string }>> {
    try {
      // Truncate content to avoid rate limits
      const truncatedText = truncateContent(text);
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Use cheaper, faster model
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates practice exercises. Return a JSON array of exercises with "question", "solution", and "notes" properties.',
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
        ],
        temperature: 0.7,
      });

      const content = completion.choices[0].message.content || '[]';
      const jsonContent = extractJSON(content);
      const exercises = JSON.parse(jsonContent);
      
      // Ensure we return the requested count
      return Array.isArray(exercises) ? exercises.slice(0, count) : [];
    } catch (error) {
      console.error('Error generating exercises:', error);
      throw new Error('Failed to generate exercises. Please try again or upload shorter content.');
    }
  },
};
