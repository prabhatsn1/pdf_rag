// components/ConnectionStatus.tsx
// Status indicator showing Gemini API connection status

'use client';

import { useEffect, useState } from 'react';

interface ConnectionStatusProps {
  className?: string;
}

export default function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [message, setMessage] = useState<string>('Checking connection...');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();

        if (data.success) {
          setStatus('connected');
          setMessage(
            `Connected to Gemini (${data.model || 'embedding-001'} - ${data.dimension || 768}D)`
          );
        } else {
          setStatus('disconnected');
          setMessage(data.message || 'Failed to connect');
        }
      } catch (error) {
        setStatus('disconnected');
        setMessage('Connection error - check your network');
      }
    };

    checkConnection();

    // Recheck every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    checking: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      dot: 'bg-yellow-500',
      text: 'text-yellow-700 dark:text-yellow-300',
    },
    connected: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      dot: 'bg-green-500',
      text: 'text-green-700 dark:text-green-300',
    },
    disconnected: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      dot: 'bg-red-500',
      text: 'text-red-700 dark:text-red-300',
    },
  };

  const colors = statusColors[status];

  return (
    <div
      className={`fixed bottom-4 right-4 ${className}`}
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Status dot */}
      <button
        className={`px-3 py-2 rounded-lg border ${colors.bg} ${colors.border} ${colors.text} 
          text-xs font-medium flex items-center gap-2 transition-all duration-200
          hover:shadow-md cursor-pointer`}
        title={message}
      >
        <span className={`w-2 h-2 rounded-full ${colors.dot}`}>
          {status === 'checking' && (
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          )}
        </span>
        <span className="inline-block">
          {status === 'connected' && 'Gemini Connected'}
          {status === 'checking' && 'Checking...'}
          {status === 'disconnected' && 'Connection Error'}
        </span>
      </button>

      {/* Tooltip */}
      {showDetails && (
        <div
          className={`absolute bottom-full right-0 mb-2 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border} 
            ${colors.text} text-xs whitespace-nowrap shadow-lg z-50 max-w-[200px] w-max`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
