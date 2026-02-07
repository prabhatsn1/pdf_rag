'use client';

// components/Message.tsx
// Chat message component with markdown-like formatting

import { CitationList } from './Citation';
import type { Citation } from '@/lib/types';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  isStreaming?: boolean;
  onCopy?: () => void;
  onCitationClick?: (citation: Citation) => void;
}

export default function Message({
  role,
  content,
  citations = [],
  isStreaming = false,
  onCopy,
  onCitationClick,
}: MessageProps) {
  const isUser = role === 'user';

  // Simple markdown-like formatting
  const formatContent = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Code block
        const code = part.slice(3, -3);
        const lines = code.split('\n');
        const language = lines[0]?.trim() || '';
        const codeContent = language ? lines.slice(1).join('\n') : code;

        return (
          <pre
            key={index}
            className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 my-2 overflow-x-auto"
          >
            <code className="text-sm font-mono">{codeContent.trim()}</code>
          </pre>
        );
      }

      // Regular text with inline formatting
      return <span key={index}>{formatInlineText(part)}</span>;
    });
  };

  const formatInlineText = (text: string) => {
    // Process inline code
    const parts = text.split(/(`[^`]+`)/g);

    return parts.map((part, index) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={index}
            className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Handle bold text
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return boldParts.map((boldPart, i) => {
        if (boldPart.startsWith('**') && boldPart.endsWith('**')) {
          return <strong key={`${index}-${i}`}>{boldPart.slice(2, -2)}</strong>;
        }
        return boldPart;
      });
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}
      `}
      >
        {isUser ? (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-600 dark:text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        )}
      </div>

      {/* Message content */}
      <div
        className={`
        flex-1 max-w-[85%] rounded-2xl px-4 py-3
        ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }
      `}
      >
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {formatContent(content)}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
          )}
        </div>

        {/* Citations */}
        {!isUser && citations.length > 0 && !isStreaming && (
          <CitationList citations={citations} onCitationClick={onCitationClick} />
        )}

        {/* Copy button for assistant messages */}
        {!isUser && !isStreaming && content && (
          <div className="flex justify-end mt-2">
            <button
              onClick={onCopy}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                flex items-center gap-1 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
