import { supabase } from './supabase';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ChatConversation {
  id: string;
  noteId?: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ChatMessage[];
}

/**
 * Get or create a conversation for a note
 */
export async function getOrCreateConversation(
  userId: string,
  noteId?: string
): Promise<string> {
  if (!noteId) {
    // Create a new conversation without a note
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId,
        note_id: null,
        title: 'New Conversation',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  // Try to find existing conversation for this note
  const { data: existing, error: fetchError } = await supabase
    .from('chat_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('note_id', noteId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing) {
    return existing.id;
  }

  // Create new conversation for this note
  const { data: newConv, error: insertError } = await supabase
    .from('chat_conversations')
    .insert({
      user_id: userId,
      note_id: noteId,
      title: 'Chat',
    })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return newConv.id;
}

/**
 * Load conversation messages
 */
export async function loadConversationMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((msg) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: new Date(msg.created_at),
  }));
}

/**
 * Save a message to the conversation
 */
export async function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<void> {
  const { error } = await supabase.from('chat_messages').insert({
    conversation_id: conversationId,
    role,
    content,
  });

  if (error) throw error;

  // Update conversation's updated_at timestamp
  const { error: updateError } = await supabase
    .from('chat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) throw updateError;
}

/**
 * Get recent conversations for a user
 */
export async function getRecentConversations(
  userId: string,
  limit: number = 10
): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Load messages for each conversation
  const conversations: ChatConversation[] = [];
  for (const conv of data || []) {
    const messages = await loadConversationMessages(conv.id);
    conversations.push({
      id: conv.id,
      noteId: conv.note_id || undefined,
      title: conv.title || undefined,
      createdAt: new Date(conv.created_at),
      updatedAt: new Date(conv.updated_at),
      messages,
    });
  }

  return conversations;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  const { error } = await supabase
    .from('chat_conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) throw error;
}

export const chatHistoryService = {
  getOrCreateConversation,
  loadConversationMessages,
  saveMessage,
  getRecentConversations,
  deleteConversation,
  updateConversationTitle,
};

