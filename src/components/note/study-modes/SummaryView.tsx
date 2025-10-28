import React from 'react';

export const SummaryView: React.FC = () => {
  return (
    <div className="space-y-6 pb-12">
      <div className="prose prose-invert max-w-none">
        <div className="text-center py-12">
          <p className="text-white text-lg font-semibold mb-2">
            AI-Generated Summary
          </p>
          <p className="text-[#9ca3af] text-base">
            Summary feature coming soon. AI-generated summaries will appear here.
          </p>
        </div>
      </div>
    </div>
  );
};
