'use client';

// components/UploadDropzone.tsx
// Drag and drop PDF upload component

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadDropzoneProps {
  onUploadComplete: (docId: string, chunkCount: number, filename: string) => void;
  onUploadError: (error: string) => void;
}

interface UploadState {
  isUploading: boolean;
  progress: 'idle' | 'uploading' | 'processing' | 'embedding' | 'complete';
  progressMessage: string;
}

export default function UploadDropzone({ onUploadComplete, onUploadError }: UploadDropzoneProps) {
  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 'idle',
    progressMessage: '',
  });

  const uploadFile = useCallback(
    async (file: File) => {
      setState({ isUploading: true, progress: 'uploading', progressMessage: 'Uploading file...' });

      try {
        const formData = new FormData();
        formData.append('file', file);

        setState((s) => ({ ...s, progress: 'processing', progressMessage: 'Processing PDF...' }));

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        setState({ isUploading: false, progress: 'complete', progressMessage: 'Upload complete!' });
        onUploadComplete(data.docId, data.chunkCount, file.name);

        // Reset after a delay
        setTimeout(() => {
          setState({ isUploading: false, progress: 'idle', progressMessage: '' });
        }, 2000);
      } catch (error) {
        setState({ isUploading: false, progress: 'idle', progressMessage: '' });
        onUploadError(error instanceof Error ? error.message : 'Upload failed');
      }
    },
    [onUploadComplete, onUploadError]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate file type
      if (file.type !== 'application/pdf') {
        onUploadError('Only PDF files are allowed');
        return;
      }

      // Validate file size (20MB)
      if (file.size > 20 * 1024 * 1024) {
        onUploadError('File size must be less than 20MB');
        return;
      }

      uploadFile(file);
    },
    [onUploadError, uploadFile]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    maxSize: 20 * 1024 * 1024,
    disabled: state.isUploading,
  });

  const getBorderColor = () => {
    if (isDragReject) return 'border-red-500 bg-red-50 dark:bg-red-950';
    if (isDragActive) return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
    if (state.progress === 'complete') return 'border-green-500 bg-green-50 dark:bg-green-950';
    return 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500';
  };

  return (
    <div
      {...getRootProps()}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
        transition-colors duration-200
        ${getBorderColor()}
        ${state.isUploading ? 'cursor-not-allowed opacity-75' : ''}
      `}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          {state.isUploading ? (
            <svg
              className="animate-spin h-6 w-6 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          ) : state.progress === 'complete' ? (
            <svg
              className="h-6 w-6 text-green-500"
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
          ) : (
            <svg
              className="h-6 w-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          )}
        </div>

        {/* Text */}
        <div>
          {state.isUploading ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{state.progressMessage}</p>
          ) : state.progress === 'complete' ? (
            <p className="text-sm text-green-600 dark:text-green-400">Upload complete!</p>
          ) : isDragActive ? (
            <p className="text-sm text-blue-600 dark:text-blue-400">Drop your PDF here...</p>
          ) : isDragReject ? (
            <p className="text-sm text-red-600 dark:text-red-400">Only PDF files are allowed</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Drop your PDF here, or click to select
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Maximum file size: 20MB
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
