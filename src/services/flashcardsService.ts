import { supabase } from './supabase';
import type { SpacedRepetitionCard } from './spacedRepetitionService';
import { spacedRepetitionService } from './spacedRepetitionService';

/**
 * Get all flashcards from all notes for a user
 */
export async function getAllFlashcards(userId: string): Promise<SpacedRepetitionCard[]> {
  // Get all notes for the user
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, folder_id')
    .eq('user_id', userId);

  if (notesError) throw notesError;
  if (!notes || notes.length === 0) return [];

  // Get all study content for these notes
  const noteIds = notes.map(n => n.id);
  const { data: studyContent, error: studyError } = await supabase
    .from('study_content')
    .select('note_id, flashcards')
    .in('note_id', noteIds);

  if (studyError) throw studyError;

  // Flatten all flashcards and add note/folder info
  const allCards: SpacedRepetitionCard[] = [];
  
  (studyContent || []).forEach((sc: any) => {
    const note = notes.find(n => n.id === sc.note_id);
    const flashcards = sc.flashcards || [];
    
    flashcards.forEach((card: any) => {
      // Upgrade old format if needed
      const spacedCard: SpacedRepetitionCard = card.easeFactor !== undefined
        ? { ...card, noteId: sc.note_id, folderId: note?.folder_id || undefined }
        : spacedRepetitionService.upgradeToSpacedRepetition(
            card,
            sc.note_id,
            note?.folder_id || undefined
          );
      allCards.push(spacedCard);
    });
  });

  return allCards;
}

/**
 * Get all flashcards from notes in a specific folder
 */
export async function getFlashcardsByFolder(userId: string, folderId: string): Promise<SpacedRepetitionCard[]> {
  // Get all notes in this folder (including subfolders recursively)
  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, folder_id')
    .eq('user_id', userId)
    .eq('folder_id', folderId);

  if (notesError) throw notesError;
  if (!notes || notes.length === 0) return [];

  const noteIds = notes.map(n => n.id);
  const { data: studyContent, error: studyError } = await supabase
    .from('study_content')
    .select('note_id, flashcards')
    .in('note_id', noteIds);

  if (studyError) throw studyError;

  const allCards: SpacedRepetitionCard[] = [];
  
  (studyContent || []).forEach((sc: any) => {
    const note = notes.find(n => n.id === sc.note_id);
    const flashcards = sc.flashcards || [];
    
    flashcards.forEach((card: any) => {
      const spacedCard: SpacedRepetitionCard = card.easeFactor !== undefined
        ? { ...card, noteId: sc.note_id, folderId: note?.folder_id || undefined }
        : spacedRepetitionService.upgradeToSpacedRepetition(
            card,
            sc.note_id,
            note?.folder_id || undefined
          );
      allCards.push(spacedCard);
    });
  });

  return allCards;
}

/**
 * Get flashcards from a specific note
 */
export async function getFlashcardsByNote(noteId: string): Promise<SpacedRepetitionCard[]> {
  const { data: studyContent, error } = await supabase
    .from('study_content')
    .select('flashcards')
    .eq('note_id', noteId)
    .maybeSingle();

  if (error) throw error;
  if (!studyContent || !studyContent.flashcards) return [];

  const flashcards = studyContent.flashcards || [];
  return flashcards.map((card: any) => {
    return card.easeFactor !== undefined
      ? { ...card, noteId }
      : spacedRepetitionService.upgradeToSpacedRepetition(card, noteId);
  });
}

/**
 * Save updated flashcard back to database
 */
export async function saveFlashcard(card: SpacedRepetitionCard): Promise<void> {
  if (!card.noteId) {
    console.warn('Cannot save card without noteId');
    return;
  }

  // Get current study content
  const { data: studyContent, error: fetchError } = await supabase
    .from('study_content')
    .select('flashcards')
    .eq('note_id', card.noteId)
    .maybeSingle();

  if (fetchError) {
    // If study_content doesn't exist yet, create it
    if (fetchError.code === 'PGRST116') {
      const { error: insertError } = await supabase
        .from('study_content')
        .insert({
          note_id: card.noteId,
          flashcards: [card],
        });
      if (insertError) throw insertError;
      return;
    }
    throw fetchError;
  }

  const flashcards = (studyContent?.flashcards || []) as SpacedRepetitionCard[];
  const cardIndex = flashcards.findIndex(c => c.id === card.id);
  
  let updatedFlashcards: SpacedRepetitionCard[];
  if (cardIndex >= 0) {
    // Update existing card
    updatedFlashcards = flashcards.map(c => 
      c.id === card.id ? card : c
    );
  } else {
    // Card not found, add it
    updatedFlashcards = [...flashcards, card];
  }

  // Update the study content
  const { error: updateError } = await supabase
    .from('study_content')
    .update({ flashcards: updatedFlashcards })
    .eq('note_id', card.noteId);

  if (updateError) throw updateError;
}

export const flashcardsService = {
  getAllFlashcards,
  getFlashcardsByFolder,
  getFlashcardsByNote,
  saveFlashcard,
};

