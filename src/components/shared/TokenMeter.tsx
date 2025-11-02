import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';

interface TokenUsage {
  count: number;
  token_count: number;
  limit: number;
}

/**
 * TokenMeter component displays daily token usage with progress bar
 * Shows tokens used / limit and reset time
 */
export const TokenMeter: React.FC = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetTime, setResetTime] = useState<Date | null>(null);

  const fetchUsage = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get today's date in UTC
      const today = new Date();
      const usageDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

      // Get user's daily limit
      const { data: accountLimit } = await supabase
        .from('account_limits')
        .select('daily_ai_limit')
        .eq('user_id', user.id)
        .maybeSingle();

      const dailyLimit = accountLimit?.daily_ai_limit ?? 150;

      // Get today's usage
      // Try to get both count and token_count, but fallback to just count if token_count column doesn't exist
      let usageData: any = null;
      const { data, error } = await supabase
        .from('daily_ai_usage')
        .select('count, token_count')
        .eq('user_id', user.id)
        .eq('usage_date', usageDate)
        .maybeSingle();
      
      if (error) {
        // If error (likely token_count column doesn't exist), try without it
        console.log('Error fetching with token_count, trying count only:', error);
        const { data: countOnly } = await supabase
          .from('daily_ai_usage')
          .select('count')
          .eq('user_id', user.id)
          .eq('usage_date', usageDate)
          .maybeSingle();
        usageData = countOnly;
      } else {
        usageData = data;
      }

      const currentCount = usageData?.count ?? 0;
      const tokenCount = usageData?.token_count ?? 0;

      setUsage({
        count: currentCount,
        token_count: tokenCount,
        limit: dailyLimit,
      });

      // Calculate reset time (midnight UTC tomorrow)
      const reset = new Date(Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() + 1,
        0,
        0,
        0
      ));
      setResetTime(reset);
    } catch (error) {
      console.error('Error fetching token usage:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Refresh after AI requests (listen for custom events)
  useEffect(() => {
    const handleAiRequest = () => {
      // Small delay to ensure database is updated
      setTimeout(fetchUsage, 1000);
    };

    window.addEventListener('ai-request-complete', handleAiRequest);
    return () => window.removeEventListener('ai-request-complete', handleAiRequest);
  }, []);

  if (!user || loading || !usage) {
    return null;
  }

  // Skip display for premium users
  if (user.email?.toLowerCase().endsWith('@premium.de')) {
    return null;
  }

  const percentage = (usage.count / usage.limit) * 100;

  // Format reset time
  const formatResetTime = (reset: Date) => {
    const now = new Date();
    const diffMs = reset.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 0) {
      return `Resets in ${diffHours}h ${diffMinutes}m`;
    }
    return `Resets in ${diffMinutes}m`;
  };

  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary border border-border-primary">
      <div className="flex flex-col items-end min-w-[120px]">
        <div className="text-xs text-text-secondary">
          {usage.count} / {usage.limit} requests
        </div>
        {usage.token_count > 0 && (
          <div className="text-xs text-text-secondary">
            ~{usage.token_count.toLocaleString()} tokens
          </div>
        )}
        {resetTime && (
          <div className="text-xs text-text-tertiary mt-0.5">
            {formatResetTime(resetTime)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-[100px]">
        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isAtLimit
                ? 'bg-red-500'
                : isNearLimit
                ? 'bg-yellow-500'
                : 'bg-accent'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

