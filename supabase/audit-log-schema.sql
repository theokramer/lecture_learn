-- Audit Log Table Schema
-- Run this in your Supabase SQL Editor to create the audit_log table for comprehensive security logging

-- Create audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45), -- IPv6 can be up to 45 chars
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  success BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_severity ON audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_audit_log_success ON audit_log(success);

-- Enable Row Level Security (RLS)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own audit logs
-- Admins can view all audit logs (you may need to create an admin role/function)
CREATE POLICY "Users can view their own audit logs"
  ON audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can insert audit logs (for backend operations)
-- Note: This allows the service to log events, but regular users cannot insert directly
-- Audit logs should only be inserted via the auditService.ts, which uses the service role

-- Optionally, create a function to automatically clean up old audit logs
-- This keeps the table size manageable while preserving recent logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
  -- Delete audit logs older than 90 days (adjust as needed)
  DELETE FROM audit_log
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup (if pg_cron extension is available)
-- Uncomment if you want automatic cleanup:
-- SELECT cron.schedule('cleanup-audit-logs', '0 2 * * *', 'SELECT cleanup_old_audit_logs()');

-- Optional: Create a view for security monitoring
CREATE OR REPLACE VIEW audit_log_security_summary AS
SELECT 
  DATE(created_at) as date,
  event_type,
  severity,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users
FROM audit_log
WHERE severity IN ('high', 'critical') OR success = false
GROUP BY DATE(created_at), event_type, severity
ORDER BY date DESC, severity DESC;

-- Grant permissions
-- Allow authenticated users to read their own logs
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT ON audit_log_security_summary TO authenticated;

-- Note: INSERT permissions should only be granted to service_role
-- The application should use service_role key for inserting audit logs
-- or use a database function that validates the request


