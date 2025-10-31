/**
 * Spaced Repetition Service
 * Implements the SM-2 algorithm for optimal flashcard review scheduling
 * Based on SuperMemo 2 algorithm by Piotr Wozniak
 */

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

export interface SpacedRepetitionCard {
  id: string;
  front: string;
  back: string;
  noteId?: string; // Track which note this card belongs to
  folderId?: string; // Track which folder this card belongs to
  // Spaced repetition fields
  easeFactor: number; // Starts at 2.5, adjusts based on performance
  interval: number; // Days until next review (or minutes for wrong answers)
  repetitions: number; // Number of successful reviews in a row
  nextReviewDate: string; // ISO datetime string (YYYY-MM-DDTHH:mm:ss)
  lastReviewed?: string; // ISO datetime string
  quality?: Quality; // Last quality rating (0-5)
  intervalType?: 'minutes' | 'days'; // Type of interval (minutes for wrong, days for correct)
}

/**
 * SM-2 Algorithm: Calculate next interval and ease factor based on quality
 * Quality scale:
 * 0: Complete blackout (forgot completely) - review in 5 minutes
 * 1: Wrong but remembered some - review in 15 minutes
 * 2: Hard (correct but difficult) - review in 1 hour
 * 3: Hard (correct but difficult) - review in 4 hours
 * 4: Good (correct response) - review in 1 day
 * 5: Easy (perfect response) - review in 4-6 days (based on ease factor)
 */
export function calculateNextReview(
  card: Omit<SpacedRepetitionCard, 'front' | 'back' | 'id'>,
  quality: Quality
): { 
  easeFactor: number; 
  interval: number; 
  repetitions: number; 
  nextReviewDate: string;
  intervalType: 'minutes' | 'days';
} {
  let { easeFactor, interval, repetitions } = card;
  let intervalType: 'minutes' | 'days' = 'days';

  // Update ease factor based on quality (only for correct responses)
  if (quality >= 3) {
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    // Ensure ease factor doesn't drop below 1.3
    easeFactor = Math.max(1.3, easeFactor);
  } else {
    // Wrong answers reduce ease factor more significantly
    easeFactor = easeFactor - 0.2;
    easeFactor = Math.max(1.3, easeFactor);
  }

  const now = new Date();
  let nextReviewDate = new Date();

  if (quality === 0) {
    // Completely wrong - review in 5 minutes
    interval = 5;
    intervalType = 'minutes';
    nextReviewDate.setMinutes(now.getMinutes() + 5);
    repetitions = 0;
  } else if (quality === 1) {
    // Wrong but remembered some - review in 15 minutes
    interval = 15;
    intervalType = 'minutes';
    nextReviewDate.setMinutes(now.getMinutes() + 15);
    repetitions = 0;
  } else if (quality === 2) {
    // Hard - review in 1 hour
    interval = 60;
    intervalType = 'minutes';
    nextReviewDate.setHours(now.getHours() + 1);
    repetitions = Math.max(0, repetitions - 1);
  } else if (quality === 3) {
    // Hard but correct - review in 4 hours
    interval = 240; // 4 hours in minutes
    intervalType = 'minutes';
    nextReviewDate.setHours(now.getHours() + 4);
    repetitions = repetitions > 0 ? repetitions : 1;
  } else if (quality === 4) {
    // Good - review in 1 day
    interval = 1;
    intervalType = 'days';
    nextReviewDate.setDate(now.getDate() + 1);
    repetitions = repetitions + 1;
  } else {
    // Easy (quality 5) - use exponential growth
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 4;
    } else if (repetitions === 2) {
      interval = 7;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    intervalType = 'days';
    nextReviewDate.setDate(now.getDate() + interval);
    repetitions = repetitions + 1;
  }
  
  return {
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval,
    repetitions,
    nextReviewDate: nextReviewDate.toISOString(),
    intervalType,
  };
}

/**
 * Initialize a new card with default spaced repetition values
 */
export function initializeSpacedRepetitionCard(
  id: string,
  front: string,
  back: string,
  noteId?: string,
  folderId?: string
): SpacedRepetitionCard {
  const now = new Date().toISOString();
  
  return {
    id,
    front,
    back,
    noteId,
    folderId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReviewDate: now, // New cards are due immediately
    lastReviewed: undefined,
    quality: undefined,
    intervalType: 'days',
  };
}

/**
 * Convert quality rating from user response
 * - Wrong/Incorrect -> 0-1
 * - Difficult -> 2-3
 * - Correct but hard -> 4
 * - Easy/Perfect -> 5
 */
export function qualityFromResponse(isCorrect: boolean, difficulty: 'easy' | 'normal' | 'hard' = 'normal'): Quality {
  if (!isCorrect) {
    return 0; // Wrong answer
  }
  
  switch (difficulty) {
    case 'easy':
      return 5;
    case 'hard':
      return 3;
    default:
      return 4;
  }
}

/**
 * Get cards due for review (nextReviewDate <= now)
 */
export function getCardsDueForReview(cards: SpacedRepetitionCard[]): SpacedRepetitionCard[] {
  const now = new Date();
  return cards.filter((card) => {
    const reviewDate = new Date(card.nextReviewDate);
    return reviewDate <= now;
  });
}

/**
 * Get cards that are hard (quality <= 3 or ease factor < 2.0)
 */
export function getHardCards(cards: SpacedRepetitionCard[]): SpacedRepetitionCard[] {
  return cards.filter((card) => {
    if (card.quality !== undefined && card.quality <= 3) return true;
    if (card.easeFactor < 2.0) return true;
    return false;
  });
}

/**
 * Get cards due today or in the next N days
 */
export function getCardsDueInDays(cards: SpacedRepetitionCard[], days: number = 7): SpacedRepetitionCard[] {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + days);
  futureDate.setHours(23, 59, 59, 999);
  
  return cards.filter((card) => {
    const reviewDate = new Date(card.nextReviewDate);
    return reviewDate <= futureDate && reviewDate >= now;
  });
}

/**
 * Upgrade old flashcard format to spaced repetition format
 */
export function upgradeToSpacedRepetition(
  card: { id: string; front: string; back: string },
  noteId?: string,
  folderId?: string
): SpacedRepetitionCard {
  return initializeSpacedRepetitionCard(card.id, card.front, card.back, noteId, folderId);
}

/**
 * Sort cards by priority (due soonest first)
 */
export function sortCardsByPriority(cards: SpacedRepetitionCard[]): SpacedRepetitionCard[] {
  return [...cards].sort((a, b) => {
    const dateA = new Date(a.nextReviewDate).getTime();
    const dateB = new Date(b.nextReviewDate).getTime();
    return dateA - dateB;
  });
}

export const spacedRepetitionService = {
  calculateNextReview,
  initializeSpacedRepetitionCard,
  qualityFromResponse,
  getCardsDueForReview,
  getCardsDueInDays,
  getHardCards,
  upgradeToSpacedRepetition,
  sortCardsByPriority,
};

