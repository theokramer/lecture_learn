import { createClient } from '@supabase/supabase-js';
import type { Note, Folder, Document, DocumentType } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Folder operations
export const folderService = {
  async getFolders(userId: string, parentId: string | null = null): Promise<Folder[]> {
    let query = supabase
      .from('folders')
      .select('*')
      .eq('user_id', userId);

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((f: any) => ({
      id: f.id,
      name: f.name,
      parentId: f.parent_id,
      createdAt: new Date(f.created_at),
    }));
  },

  async createFolder(userId: string, name: string, parentId: string | null): Promise<Folder> {
    const { data, error } = await supabase
      .from('folders')
      .insert({
        user_id: userId,
        name,
        parent_id: parentId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      parentId: data.parent_id,
      createdAt: new Date(data.created_at),
    };
  },

  async updateFolder(id: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .update({ name })
      .eq('id', id);

    if (error) throw error;
  },

  async deleteFolder(id: string): Promise<void> {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Note operations
export const noteService = {
  async getNotes(userId: string, folderId: string | null = null): Promise<Note[]> {
    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId);

    if (folderId === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', folderId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    const notes = await Promise.all(
      data.map(async (n: any) => {
        // Fetch documents for each note
        const { data: documents } = await supabase
          .from('documents')
          .select('*')
          .eq('note_id', n.id)
          .order('uploaded_at', { ascending: false });

        const parsedDocuments = documents?.map((doc: any) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          url: doc.storage_path,
          size: doc.size,
          uploadedAt: new Date(doc.uploaded_at),
        })) || [];

        return {
          id: n.id,
          title: n.title,
          content: n.content || '',
          folderId: n.folder_id,
          createdAt: new Date(n.created_at),
          documents: parsedDocuments,
        };
      })
    );

    return notes;
  },

  async createNote(userId: string, title: string, folderId: string | null, content: string = ''): Promise<Note> {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        title,
        folder_id: folderId,
        content,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      title: data.title,
      content: data.content || '',
      folderId: data.folder_id,
      createdAt: new Date(data.created_at),
      documents: [],
    };
  },

  async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.folderId !== undefined) updateData.folder_id = updates.folderId;

    const { error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;
  },

  async deleteNote(id: string): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async searchNotes(userId: string, query: string): Promise<Note[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content || '',
      folderId: n.folder_id,
      createdAt: new Date(n.created_at),
      documents: [],
    }));
  },
};

// Document operations
export const documentService = {
  async getDocuments(noteId: string): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('note_id', noteId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return data.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type as DocumentType,
      url: doc.storage_path,
      size: doc.size,
      uploadedAt: new Date(doc.uploaded_at),
    }));
  },

  async createDocument(noteId: string, file: File, storagePath: string): Promise<Document> {
    const documentType = documentService.getFileType(file.type);
    
    const { data, error } = await supabase
      .from('documents')
      .insert({
        note_id: noteId,
        name: file.name,
        type: documentType,
        storage_path: storagePath,
        size: file.size,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      type: data.type,
      url: data.storage_path,
      size: data.size,
      uploadedAt: new Date(data.uploaded_at),
    };
  },

  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async renameDocument(documentId: string, newName: string): Promise<void> {
    const { error } = await supabase
      .from('documents')
      .update({ name: newName })
      .eq('id', documentId);

    if (error) throw error;
  },

  async updateDocumentOrder(documentId: string, newOrder: Date): Promise<void> {
    // Update uploaded_at to change order (simple approach without schema changes)
    const { error } = await supabase
      .from('documents')
      .update({ uploaded_at: newOrder.toISOString() })
      .eq('id', documentId);

    if (error) throw error;
  },

  getFileType(mimeType: string): DocumentType {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
    return 'text';
  },
};

// File upload operations - re-export from enhanced storageService
export { storageService } from './storageService';

// Helper functions for generating study content
async function generateExercisesHelper(content: string) {
  try {
    const { openaiService, extractJSON } = await import('./openai');
    
    const prompt = `Based on the following note content, generate 8-10 practical exercises that help students practice and apply what they've learned. 

Note content:
${content}

Return a JSON array of exercise objects, each with:
- "question": A clear, practical exercise or problem the student should solve
- "solution": A detailed step-by-step solution or answer
- "notes": Helpful feedback or additional information

Make the exercises:
1. Practical and applicable to the content
2. Progressive in difficulty (easier to harder)
3. Cover different aspects of the topic
4. Include clear instructions

IMPORTANT: Return ONLY valid JSON array. Escape all special characters properly. Use \\n for newlines in strings. Ensure all quotes within strings are escaped. Do not include any markdown formatting, just pure JSON.`;

    const response = await openaiService.chatCompletions(
      [{ role: 'user', content: prompt }],
      'You are an educational assistant creating practice exercises. Always return valid JSON with properly escaped characters.'
    );
    
    // Extract JSON using the helper from openai.ts
    let jsonString = extractJSON(response);
    
    // If extractJSON didn't find anything, try simple array match
    if (!jsonString || jsonString === response) {
      const arrayMatch = response.match(/(\[[\s\S]*\])/);
      if (arrayMatch) {
        jsonString = arrayMatch[1];
      } else {
        console.warn('No JSON array found in exercise generation response');
        return [];
      }
    }
    
    // Clean up the JSON string - remove any leading/trailing whitespace
    jsonString = jsonString.trim();
    
    // Try to find the actual array boundaries
    const firstBracket = jsonString.indexOf('[');
    const lastBracket = jsonString.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      jsonString = jsonString.substring(firstBracket, lastBracket + 1);
    }
    
    try {
      // Try parsing the JSON
      return JSON.parse(jsonString);
    } catch (parseError: any) {
      // If parsing fails, log detailed error information
      console.error('Error parsing exercises JSON:', parseError);
      console.error('Parse error position:', parseError.message);
      console.error('JSON preview (first 1000 chars):', jsonString.substring(0, 1000));
      
      // Try to recover by finding the position and fixing common issues
      const errorMatch = parseError.message.match(/position (\d+)/);
      if (errorMatch) {
        const errorPos = parseInt(errorMatch[1], 10);
        console.error('Error at position:', errorPos);
        console.error('Context around error:', jsonString.substring(Math.max(0, errorPos - 50), Math.min(jsonString.length, errorPos + 50)));
    }
      
    return [];
    }
  } catch (error) {
    console.error('Error generating exercises:', error);
    return [];
  }
}

async function generateFeynmanTopicsHelper(content: string) {
  try {
    const { openaiService } = await import('./openai');
    const prompt = `Based on this note content, generate 3-4 specific topics that a student could practice explaining using the Feynman Technique. Focus on the main concepts, terms, or ideas that would be good for teaching.\n\nNote content:\n${content}\n\nReturn a JSON array of objects with "title" (short topic title starting with "Explain:") and "description" (brief description). Keep titles concise (max 50 chars).`;
    
    const response = await openaiService.chatCompletions(
      [{ role: 'user', content: prompt }],
      'You are an educational assistant helping create practice topics.'
    );
    
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const topics = JSON.parse(jsonMatch[0]);
      return topics.map((t: any, idx: number) => ({
        id: (idx + 1).toString(),
        title: t.title || `Topic ${idx + 1}`,
        description: t.description || '',
      }));
    }
    return [];
  } catch (error) {
    console.error('Error generating feynman topics:', error);
    return [];
  }
}

// Generate all study content for a note
async function generateAllStudyContent(noteId: string, content: string) {
  if (!content || content.trim().length < 50) {
    return; // Not enough content to generate study content
  }

  try {
    const { openaiService } = await import('./openai');
    const { summaryService } = await import('./summaryService');

    // Check if study_content exists and if summary already exists
    const { data: existingRows } = await supabase
      .from('study_content')
      .select('id, summary')
      .eq('note_id', noteId)
      .order('updated_at', { ascending: false });

    // Handle duplicates: use the most recent row
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
    
    // Clean up duplicates if found
    if (existingRows && existingRows.length > 1) {
      const duplicateIds = existingRows.slice(1).map(row => row.id);
      await supabase
        .from('study_content')
        .delete()
        .in('id', duplicateIds)
    }

    const hasExistingSummary = existing?.summary && existing.summary.trim() !== '';

    // Fetch documents metadata for summary context (only if we need to generate summary)
    const documentsPromise = !hasExistingSummary 
      ? documentService.getDocuments(noteId)
      : Promise.resolve([]);

    // Generate study materials in parallel
    // Only generate summary if it doesn't already exist
    const studyContentPromises = [
      openaiService.generateFlashcards(content),
      openaiService.generateQuiz(content),
      generateExercisesHelper(content),
      generateFeynmanTopicsHelper(content),
    ];

    // Add summary generation only if it doesn't exist
    if (!hasExistingSummary) {
      const documents = await documentsPromise;
      studyContentPromises.push(
        summaryService.generateIntelligentSummary(content, documents, { detailLevel: 'standard' })
      );
    } else {
      // Add a resolved promise to keep array alignment
      studyContentPromises.push(Promise.resolve(''));
    }

    const [flashcardsData, quizData, exercisesData, feynmanTopicsData, summaryData] = await Promise.allSettled(studyContentPromises);

    const flashcards = flashcardsData.status === 'fulfilled' 
      ? flashcardsData.value.map((f: any) => ({ id: `gen-${Date.now()}-${Math.random()}`, ...f }))
      : [];
    
    const quizQuestions = quizData.status === 'fulfilled'
      ? quizData.value.map((q: any, idx: number) => ({
          id: `gen-${Date.now()}-${idx}`,
          question: q.question,
          options: q.options,
          correct: q.correctAnswer || q.correct,
        }))
      : [];

    const exercises = exercisesData.status === 'fulfilled'
      ? exercisesData.value
      : [];

    const feynmanTopics = feynmanTopicsData.status === 'fulfilled'
      ? feynmanTopicsData.value
      : [];

    // Only set summary if we generated a new one (and it was successful)
    const summaryHtml = !hasExistingSummary && summaryData.status === 'fulfilled'
      ? summaryData.value
      : '';

    const contentData: any = {};
    
    contentData.flashcards = flashcards;
    contentData.quiz_questions = quizQuestions;
    contentData.exercises = exercises;
    contentData.feynman_topics = feynmanTopics;
    
    // Only include summary in update if we generated a new one
    // Never overwrite existing summary
    if (summaryHtml && !hasExistingSummary) {
      contentData.summary = summaryHtml;
    }

    // Use upsert pattern: try to update first, if no rows affected, then insert
    // This prevents race conditions where multiple inserts happen simultaneously
    if (existing) {
      // Clean up any duplicates first
      if (existingRows && existingRows.length > 1) {
        const duplicateIds = existingRows.slice(1).map(row => row.id);
        await supabase
          .from('study_content')
          .delete()
          .in('id', duplicateIds)
      }
      
      // Update only the most recent row (by ID) - summary will be preserved automatically (not in contentData if it exists)
      const { error } = await supabase
        .from('study_content')
        .update(contentData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Before inserting, double-check to prevent race conditions
      // If another request created a row between our check and insert, update it instead
      const { data: checkRows } = await supabase
        .from('study_content')
        .select('id')
        .eq('note_id', noteId)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (checkRows && checkRows.length > 0) {
        // Row was created by another request, update it instead
        const { error } = await supabase
          .from('study_content')
          .update(contentData)
          .eq('id', checkRows[0].id);
        
        if (error) throw error;
      } else {
        // Safe to insert
        const { error } = await supabase
          .from('study_content')
          .insert({
            note_id: noteId,
            ...contentData,
          });

        if (error) {
          // If insert fails due to duplicate, try to update instead
          if (error.code === '23505') { // Unique violation (if constraint exists)
            const { data: existingRow } = await supabase
              .from('study_content')
              .select('id')
              .eq('note_id', noteId)
              .order('updated_at', { ascending: false })
              .limit(1)
              .single();
            
            if (existingRow) {
              const { error: updateError } = await supabase
                .from('study_content')
                .update(contentData)
                .eq('id', existingRow.id);
              
              if (updateError) throw updateError;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    }

    console.log('Successfully generated and saved all study content');
  } catch (error) {
    console.error('Error generating study content:', error);
    // Don't throw - this is background generation
  }
}

// Study Content operations
export const studyContentService = {
  async getStudyContent(noteId: string) {
    const { data, error } = await supabase
      .from('study_content')
      .select('*')
      .eq('note_id', noteId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading study content:', error);
      // Return empty data if there's an error
      return {
        summary: '',
        flashcards: [],
        quizQuestions: [],
        exercises: [],
        feynmanTopics: [],
      };
    }

    // Handle case where multiple rows exist (data integrity issue)
    if (data && data.length > 1) {
      // Use the most recent row (already sorted by updated_at DESC)
      const mostRecent = data[0];
      
      // Clean up duplicates in background (keep the most recent one)
      const duplicateIds = data.slice(1).map(row => row.id);
      if (duplicateIds.length > 0) {
        await supabase
          .from('study_content')
          .delete()
          .in('id', duplicateIds);
      }
      
      return {
        summary: mostRecent.summary || '',
        flashcards: mostRecent.flashcards || [],
        quizQuestions: mostRecent.quiz_questions || [],
        exercises: mostRecent.exercises || [],
        feynmanTopics: mostRecent.feynman_topics || [],
      };
    }
    
    // Normal case: 0 or 1 row
    const singleData = data && data.length > 0 ? data[0] : null;
    return singleData ? {
      summary: singleData.summary || '',
      flashcards: singleData.flashcards || [],
      quizQuestions: singleData.quiz_questions || [],
      exercises: singleData.exercises || [],
      feynmanTopics: singleData.feynman_topics || [],
    } : {
      summary: '',
      flashcards: [],
      quizQuestions: [],
      exercises: [],
      feynmanTopics: [],
    };
  },

  async generateAndSaveAllStudyContent(noteId: string, content: string) {
    return generateAllStudyContent(noteId, content);
  },

  async generateAndSaveSummary(noteId: string, content: string, detailLevel: 'concise' | 'standard' | 'comprehensive' = 'standard') {
    try {
      // Check if summary already exists - never regenerate if it exists
      const existingContent = await this.getStudyContent(noteId);
      if (existingContent.summary && existingContent.summary.trim() !== '') {
        console.log('Summary already exists for note, returning existing summary');
        return existingContent.summary;
      }

      // No summary exists, generate a new one
      const { summaryService } = await import('./summaryService');
      const documents = await documentService.getDocuments(noteId);
      const summary = await summaryService.generateIntelligentSummary(content, documents, { detailLevel });
      await this.saveSummary(noteId, summary);
      return summary;
    } catch (error) {
      console.error('Error generating/saving summary:', error);
      throw error;
    }
  },

  async saveStudyContent(
    noteId: string, 
    data: {
      summary?: string;
      flashcards?: any[];
      quizQuestions?: any[];
      exercises?: any[];
      feynmanTopics?: any[];
    }
  ) {
    // Check if study_content exists for this note
    const { data: existingRows } = await supabase
      .from('study_content')
      .select('id')
      .eq('note_id', noteId)
      .order('updated_at', { ascending: false });

    // Handle duplicates: use the most recent row
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
    
    // Clean up duplicates if found
    if (existingRows && existingRows.length > 1) {
      const duplicateIds = existingRows.slice(1).map(row => row.id);
      const { error: deleteError } = await supabase
        .from('study_content')
        .delete()
        .in('id', duplicateIds);
      
      if (deleteError) {
        console.error('Error cleaning up duplicates:', deleteError);
      }
    }

    const contentData: any = {};
    
    if (data.summary !== undefined) contentData.summary = data.summary;
    if (data.flashcards !== undefined) contentData.flashcards = data.flashcards;
    if (data.quizQuestions !== undefined) contentData.quiz_questions = data.quizQuestions;
    if (data.exercises !== undefined) contentData.exercises = data.exercises;
    if (data.feynmanTopics !== undefined) contentData.feynman_topics = data.feynmanTopics;

    // Use upsert pattern: try to update first, if no rows affected, then insert
    // This prevents race conditions where multiple inserts happen simultaneously
    if (existing) {
      // Clean up any duplicates first
      if (existingRows && existingRows.length > 1) {
        const duplicateIds = existingRows.slice(1).map(row => row.id);
        const { error: updateError } = await supabase
          .from('study_content')
          .delete()
          .in('id', duplicateIds);
        
        if (updateError) {
          console.error('Error cleaning up duplicates:', updateError);
        }
      }
      
      // Update only the most recent row (by ID)
      const { error } = await supabase
        .from('study_content')
        .update(contentData)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Before inserting, double-check to prevent race conditions
      // If another request created a row between our check and insert, update it instead
      const { data: checkRows } = await supabase
        .from('study_content')
        .select('id')
        .eq('note_id', noteId)
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (checkRows && checkRows.length > 0) {
        // Row was created by another request, update it instead
        const { error } = await supabase
          .from('study_content')
          .update(contentData)
          .eq('id', checkRows[0].id);
        
        if (error) throw error;
      } else {
        // Safe to insert
        const { error } = await supabase
          .from('study_content')
          .insert({
            note_id: noteId,
            ...contentData,
          });

        if (error) {
          // If insert fails due to duplicate, try to update instead
          if (error.code === '23505') { // Unique violation (if constraint exists)
            const { data: existingRow } = await supabase
              .from('study_content')
              .select('id')
              .eq('note_id', noteId)
              .order('updated_at', { ascending: false })
              .limit(1)
              .single();
            
            if (existingRow) {
              const { error: updateError } = await supabase
                .from('study_content')
                .update(contentData)
                .eq('id', existingRow.id);
              
              if (updateError) throw updateError;
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    }
  },

  async saveSummary(noteId: string, summary: string) {
    return this.saveStudyContent(noteId, { summary });
  },

  async getSummariesForNotes(noteIds: string[]) {
    if (!noteIds || noteIds.length === 0) {
      return {} as Record<string, string>;
    }

    const { data, error } = await supabase
      .from('study_content')
      .select('note_id, summary')
      .in('note_id', noteIds);

    if (error) {
      console.error('Error loading summaries for notes:', error);
      return {} as Record<string, string>;
    }

    const map: Record<string, string> = {};
    (data || []).forEach((row: any) => {
      map[row.note_id] = row.summary || '';
    });
    return map;
  },
};

// User operations
export const userService = {
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};
