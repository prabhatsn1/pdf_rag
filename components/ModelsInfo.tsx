// components/ModelsInfo.tsx
// Display list of available models and their capabilities

'use client';

import { useEffect, useState } from 'react';

interface Model {
  displayName: string;
  name: string;
  description: string;
  version: string;
  supportedGenerationMethods: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

export default function ModelsInfo() {
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModels, setShowModels] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/models');
        const data = await response.json();

        if (data.success) {
          setModels(data.models);
          setError(null);
        } else {
          setError(data.message || 'Failed to fetch models');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  if (loading) {
    return (
      <button
        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 
          text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        disabled
      >
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Loading models...
      </button>
    );
  }

  if (error) {
    return (
      <button
        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30
          text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        title={error}
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4v2m0 4v2M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {models.length} models
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowModels(!showModels)}
        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30
          text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {models.length} models available
      </button>

      {showModels && models.length > 0 && (
        <div
          className="absolute top-full mt-2 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border 
          border-gray-200 dark:border-gray-700 z-50 max-h-[500px] overflow-y-auto min-w-[500px]"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Available Models ({models.length})
            </h3>
          </div>

          {/* Models List */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {models.map((model) => (
              <div
                key={model.name}
                className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {model.displayName}
                    </h4>
                    <code className="text-xs text-gray-500 dark:text-gray-400">{model.name}</code>
                  </div>
                  {model.version && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      {model.version}
                    </span>
                  )}
                </div>

                {model.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {model.description}
                  </p>
                )}

                {/* Supported Methods */}
                {model.supportedGenerationMethods &&
                  model.supportedGenerationMethods.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supported Methods:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {model.supportedGenerationMethods.map((method) => (
                          <span
                            key={method}
                            className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 
                            text-green-700 dark:text-green-400 px-2 py-0.5 rounded"
                          >
                            {method === 'generateContent' && '💬'}
                            {method === 'embedContent' && '🔗'}
                            {method === 'streamGenerateContent' && '📡'}
                            {method}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Parameters */}
                {(model.temperature !== undefined ||
                  model.topP !== undefined ||
                  model.topK !== undefined) && (
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <p className="font-medium mb-1">Parameters:</p>
                    <div className="space-y-0.5">
                      {model.temperature !== undefined && <p>• Temperature: {model.temperature}</p>}
                      {model.topP !== undefined && <p>• Top P: {model.topP}</p>}
                      {model.topK !== undefined && <p>• Top K: {model.topK}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
