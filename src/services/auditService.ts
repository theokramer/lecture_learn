/**
 * Audit logging service for comprehensive security and activity tracking
 * Logs authentication events, security events, data access, and API usage
 */

import { supabase } from './supabase';

export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  SIGNUP_SUCCESS = 'signup_success',
  SIGNUP_FAILURE = 'signup_failure',
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_COMPLETE = 'password_reset_complete',
  OAUTH_SUCCESS = 'oauth_success',
  OAUTH_FAILURE = 'oauth_failure',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // Data access events
  NOTE_CREATED = 'note_created',
  NOTE_UPDATED = 'note_updated',
  NOTE_DELETED = 'note_deleted',
  FOLDER_CREATED = 'folder_created',
  FOLDER_UPDATED = 'folder_updated',
  FOLDER_DELETED = 'folder_deleted',
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_DELETED = 'document_deleted',
  
  // API usage events
  AI_GENERATION_REQUESTED = 'ai_generation_requested',
  AI_GENERATION_COMPLETED = 'ai_generation_completed',
  AI_GENERATION_FAILED = 'ai_generation_failed',
  
  // System events
  ERROR_OCCURRED = 'error_occurred',
  CONFIGURATION_CHANGED = 'configuration_changed',
}

export interface AuditLogEntry {
  event_type: AuditEventType;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  success?: boolean;
}

/**
 * Logs an audit event to Supabase
 * Handles errors gracefully to prevent audit logging from breaking the app
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Get current user if available
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get client information
    const ipAddress = entry.ip_address || 'unknown';
    const userAgent = entry.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown');
    
    const auditEntry = {
      event_type: entry.event_type,
      user_id: entry.user_id || user?.id || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: entry.details || {},
      severity: entry.severity || 'low',
      success: entry.success !== undefined ? entry.success : true,
      created_at: new Date().toISOString(),
    };

    // Insert into audit_log table
    // Note: This assumes the audit_log table exists in Supabase
    // The table should be created with the SQL schema provided
    const { error } = await supabase
      .from('audit_log')
      .insert(auditEntry);

    if (error) {
      // Log to console in development, but don't throw
      if (import.meta.env.DEV) {
        console.warn('Failed to log audit event:', error);
      }
      // Optionally, you could queue failed audit logs for retry
    }
  } catch (error) {
    // Silently fail audit logging to prevent it from breaking the app
    // But log in development for debugging
    if (import.meta.env.DEV) {
      console.warn('Audit logging error (non-critical):', error);
    }
  }
}

/**
 * Helper functions for common audit events
 */

export async function logLoginSuccess(userId: string, method: string = 'email'): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.LOGIN_SUCCESS,
    user_id: userId,
    details: { method },
    severity: 'low',
    success: true,
  });
}

export async function logLoginFailure(email: string, reason: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.LOGIN_FAILURE,
    details: { email: email.substring(0, 10) + '...', reason }, // Partial email for privacy
    severity: 'medium',
    success: false,
  });
}

export async function logLogout(userId: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.LOGOUT,
    user_id: userId,
    severity: 'low',
    success: true,
  });
}

export async function logSignupSuccess(userId: string, method: string = 'email'): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.SIGNUP_SUCCESS,
    user_id: userId,
    details: { method },
    severity: 'low',
    success: true,
  });
}

export async function logSignupFailure(email: string, reason: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.SIGNUP_FAILURE,
    details: { email: email.substring(0, 10) + '...', reason },
    severity: 'medium',
    success: false,
  });
}

export async function logRateLimitExceeded(userId: string, resource: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.RATE_LIMIT_EXCEEDED,
    user_id: userId,
    details: { resource },
    severity: 'medium',
    success: false,
  });
}

export async function logUnauthorizedAttempt(userId: string | null, resource: string, action: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
    user_id: userId || undefined,
    details: { resource, action },
    severity: 'high',
    success: false,
  });
}

export async function logNoteCreated(userId: string, noteId: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.NOTE_CREATED,
    user_id: userId,
    details: { note_id: noteId },
    severity: 'low',
    success: true,
  });
}

export async function logNoteDeleted(userId: string, noteId: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.NOTE_DELETED,
    user_id: userId,
    details: { note_id: noteId },
    severity: 'medium',
    success: true,
  });
}

export async function logDocumentUploaded(userId: string, documentId: string, fileType: string, fileSize: number): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.DOCUMENT_UPLOADED,
    user_id: userId,
    details: { document_id: documentId, file_type: fileType, file_size: fileSize },
    severity: 'low',
    success: true,
  });
}

export async function logAIGenerationRequested(userId: string, type: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.AI_GENERATION_REQUESTED,
    user_id: userId,
    details: { generation_type: type },
    severity: 'low',
    success: true,
  });
}

export async function logAIGenerationCompleted(userId: string, type: string, duration?: number): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.AI_GENERATION_COMPLETED,
    user_id: userId,
    details: { generation_type: type, duration_ms: duration },
    severity: 'low',
    success: true,
  });
}

export async function logAIGenerationFailed(userId: string, type: string, error: string): Promise<void> {
  await logAuditEvent({
    event_type: AuditEventType.AI_GENERATION_FAILED,
    user_id: userId,
    details: { generation_type: type, error },
    severity: 'medium',
    success: false,
  });
}

export async function logError(error: unknown, context: string, userId?: string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  await logAuditEvent({
    event_type: AuditEventType.ERROR_OCCURRED,
    user_id: userId,
    details: { context, error_message: errorMessage.substring(0, 200) }, // Truncate long errors
    severity: 'medium',
    success: false,
  });
}

