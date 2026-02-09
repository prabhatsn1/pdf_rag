'use client';

// app/page.tsx
// Main page with PDF upload and chat interface

import { useState } from 'react';
import UploadDropzone from '@/components/UploadDropzone';
import Chat from '@/components/Chat';
import ModelsInfo from '@/components/ModelsInfo';

interface DocumentInfo {
  docId: string;
  filename: string;
  chunkCount: number;
}

export default function Home() {
  const [document, setDocument] = useState<DocumentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = (docId: string, chunkCount: number, filename: string) => {
    setDocument({ docId, filename, chunkCount });
    setError(null);
  };

  const handleUploadError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleClearDocument = () => {
    setDocument(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">PDF RAG Chat</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ask questions about your PDF documents
                </p>
              </div>
            </div>

            {document && (
              <div className="flex items-center gap-3">
                <ModelsInfo />
                <button
                  onClick={handleClearDocument}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200
                    px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  Upload new document
                </button>
              </div>
            )}
            {!document && <ModelsInfo />}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
          {/* Left panel - Upload */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Document</h2>

              {!document ? (
                <>
                  <UploadDropzone
                    onUploadComplete={handleUploadComplete}
                    onUploadError={handleUploadError}
                  />

                  {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {/* Document card */}
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
                          {document.filename}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                          {document.chunkCount} chunks indexed
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Document info */}
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-2">
                    <p className="flex justify-between">
                      <span>Document ID:</span>
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {document.docId}
                      </code>
                    </p>
                  </div>

                  {/* Tips */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tips for better results:
                    </h3>
                    <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                      <li>• Ask specific questions about the document content</li>
                      <li>• Request citations when asking for facts</li>
                      <li>• Use follow-up questions to dive deeper</li>
                      <li>• Ask for summaries of specific sections</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Chat */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-full flex flex-col overflow-hidden">
              <Chat docId={document?.docId || null} documentName={document?.filename} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
