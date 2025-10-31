/**
 * Offline sync service using IndexedDB for caching and action queuing
 */
import { supabase } from './supabase';
import type { Note, Folder } from '../types';

const DB_NAME = 'ReactLearningNotes';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const FOLDERS_STORE = 'folders';
const SYNC_QUEUE_STORE = 'syncQueue';

interface SyncAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'note' | 'folder';
  entityId: string;
  data?: any;
  timestamp: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object stores if they don't exist
      if (!database.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = database.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        notesStore.createIndex('folderId', 'folderId', { unique: false });
      }

      if (!database.objectStoreNames.contains(FOLDERS_STORE)) {
        const foldersStore = database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        foldersStore.createIndex('parentId', 'parentId', { unique: false });
      }

      if (!database.objectStoreNames.contains(SYNC_QUEUE_STORE)) {
        const syncQueueStore = database.createObjectStore(SYNC_QUEUE_STORE, { keyPath: 'id' });
        syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Cache notes in IndexedDB
 */
export async function cacheNotes(notes: Note[]): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([NOTES_STORE], 'readwrite');
  const store = transaction.objectStore(NOTES_STORE);

  await Promise.all(
    notes.map((note) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(note);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    })
  );
}

/**
 * Get cached notes from IndexedDB
 */
export async function getCachedNotes(): Promise<Note[]> {
  const database = await initDB();
  const transaction = database.transaction([NOTES_STORE], 'readonly');
  const store = transaction.objectStore(NOTES_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache folders in IndexedDB
 */
export async function cacheFolders(folders: Folder[]): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([FOLDERS_STORE], 'readwrite');
  const store = transaction.objectStore(FOLDERS_STORE);

  await Promise.all(
    folders.map((folder) => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put(folder);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    })
  );
}

/**
 * Get cached folders from IndexedDB
 */
export async function getCachedFolders(): Promise<Folder[]> {
  const database = await initDB();
  const transaction = database.transaction([FOLDERS_STORE], 'readonly');
  const store = transaction.objectStore(FOLDERS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue an action for sync when online
 */
export async function queueSyncAction(action: Omit<SyncAction, 'id' | 'timestamp'>): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_STORE);

  const syncAction: SyncAction = {
    id: `${action.entityType}_${action.entityId}_${Date.now()}`,
    ...action,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const request = store.add(syncAction);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all queued sync actions
 */
export async function getQueuedActions(): Promise<SyncAction[]> {
  const database = await initDB();
  const transaction = database.transaction([SYNC_QUEUE_STORE], 'readonly');
  const store = transaction.objectStore(SYNC_QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove a queued action after successful sync
 */
export async function removeQueuedAction(actionId: string): Promise<void> {
  const database = await initDB();
  const transaction = database.transaction([SYNC_QUEUE_STORE], 'readwrite');
  const store = transaction.objectStore(SYNC_QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.delete(actionId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sync queued actions when back online
 * Simple last-write-wins conflict resolution
 */
export async function syncQueuedActions(): Promise<void> {
  if (!navigator.onLine) {
    return;
  }

  const actions = await getQueuedActions();
  
  for (const action of actions) {
    try {
      // Import services dynamically to avoid circular dependencies
      const { folderService, noteService } = await import('./supabase');

      if (action.entityType === 'note') {
        if (action.type === 'create' && action.data) {
          await noteService.createNote(
            action.data.userId,
            action.data.title,
            action.data.folderId,
            action.data.content
          );
        } else if (action.type === 'update' && action.data) {
          await noteService.updateNote(action.entityId, action.data);
        } else if (action.type === 'delete') {
          await noteService.deleteNote(action.entityId);
        }
      } else if (action.entityType === 'folder') {
        if (action.type === 'create' && action.data) {
          await folderService.createFolder(
            action.data.userId,
            action.data.name,
            action.data.parentId
          );
        } else if (action.type === 'update' && action.data) {
          await folderService.updateFolder(action.entityId, action.data.name);
        } else if (action.type === 'delete') {
          await folderService.deleteFolder(action.entityId);
        }
      }

      // Remove action from queue after successful sync
      await removeQueuedAction(action.id);
    } catch (error) {
      console.error('Failed to sync action:', action, error);
      // Keep action in queue for retry
    }
  }
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  const database = await initDB();
  
  const transactions = [
    database.transaction([NOTES_STORE], 'readwrite'),
    database.transaction([FOLDERS_STORE], 'readwrite'),
  ];

  await Promise.all(
    transactions.map((transaction) => {
      return new Promise<void>((resolve, reject) => {
        const store = transaction.objectStore(transaction.objectStoreNames[0]);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    })
  );
}

