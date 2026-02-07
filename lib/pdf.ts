/* eslint-disable @typescript-eslint/no-explicit-any */
// lib/pdf.ts
// PDF parsing with per-page text extraction

import type { PageContent } from './types';

/**
 * Parse a PDF buffer and extract text content with page numbers
 */
export async function parsePDF(buffer: Buffer): Promise<PageContent[]> {
  // Use pdf2json for server-side parsing (no canvas dependencies)
  const PDFParser = (await import('pdf2json')).default;

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`Failed to parse PDF: ${errData.parserError || 'Unknown error'}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        const pages: PageContent[] = [];

        // Extract text from each page
        if (pdfData.Pages && Array.isArray(pdfData.Pages)) {
          for (let i = 0; i < pdfData.Pages.length; i++) {
            const page = pdfData.Pages[i];
            const pageText = extractTextFromPage(page);

            if (pageText.trim()) {
              pages.push({
                pageNumber: i + 1,
                text: normalizeText(pageText),
              });
            }
          }
        }

        if (pages.length === 0) {
          reject(new Error('No text content found in PDF'));
        } else {
          resolve(pages);
        }
      } catch (error) {
        reject(
          new Error(
            `Failed to process PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    });

    // Parse the buffer
    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Extract text from a pdf2json page object
 */
function extractTextFromPage(page: any): string {
  if (!page.Texts || !Array.isArray(page.Texts)) {
    return '';
  }

  return page.Texts.map((text: any) => {
    if (text.R && Array.isArray(text.R)) {
      return text.R.map((run: any) => {
        // Decode URI encoded text
        return decodeURIComponent(run.T || '');
      }).join(' ');
    }
    return '';
  })
    .filter((t: string) => t.trim())
    .join(' ');
}

/**
 * Normalize text by cleaning up whitespace and common artifacts
 */
function normalizeText(text: string): string {
  return (
    text
      // Replace multiple spaces with single space
      .replace(/[ \t]+/g, ' ')
      // Normalize line endings
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive newlines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Final trim
      .trim()
  );
}

/**
 * Get estimated page count from a PDF buffer
 */
export async function getPageCount(buffer: Buffer): Promise<number> {
  const PDFParser = (await import('pdf2json')).default;

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser(null, true);

    pdfParser.on('pdfParser_dataError', (errData: any) => {
      reject(new Error(`Failed to get page count: ${errData.parserError || 'Unknown error'}`));
    });

    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      const pageCount = pdfData.Pages?.length || 1;
      resolve(pageCount);
    });

    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Validate that a buffer appears to be a valid PDF
 */
export function validatePDFBuffer(buffer: Buffer): boolean {
  // Check for PDF magic number (%PDF-)
  if (buffer.length < 5) return false;

  const header = buffer.slice(0, 5).toString('ascii');
  return header === '%PDF-';
}
