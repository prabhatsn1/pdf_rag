'use client';

// components/Citation.tsx
// Citation chip component for displaying source references

import type { Citation as CitationType } from '@/lib/types';

interface CitationProps {
  citation: CitationType;
  onClick?: (citation: CitationType) => void;
}

export default function Citation({ citation, onClick }: CitationProps) {
  return (
    <button
      onClick={() => onClick?.(citation)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium
        bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
        border border-blue-200 dark:border-blue-800 rounded-full
        hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
        cursor-pointer"
      title={citation.text}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span>Page {citation.pageNumber}</span>
      <span className="text-blue-500 dark:text-blue-400">•</span>
      <span className="opacity-75">{citation.chunkId}</span>
    </button>
  );
}

interface CitationListProps {
  citations: CitationType[];
  onCitationClick?: (citation: CitationType) => void;
}

export function CitationList({ citations, onCitationClick }: CitationListProps) {
  if (citations.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Sources:</span>
      {citations.map((citation, index) => (
        <Citation
          key={`${citation.chunkId}-${index}`}
          citation={citation}
          onClick={onCitationClick}
        />
      ))}
    </div>
  );
}
