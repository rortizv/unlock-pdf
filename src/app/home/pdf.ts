import { PDFDocument } from '@cantoo/pdf-lib';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', document.baseURI).href;

export function isPdfBytes(bytes: Uint8Array): boolean {
  const header = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return header.includes('%PDF-');
}

export function looksLikePdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.pdf') ||
    file.type === 'application/pdf' ||
    file.type === 'application/x-pdf'
  );
}

export async function isEncryptedPdf(bytes: Uint8Array): Promise<boolean> {
  try {
    await PDFDocument.load(bytes.slice(), { ignoreEncryption: false });
    return false;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt|password/i.test(message)) {
      return true;
    }
    throw error;
  }
}

export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes.slice(), { password });
  return document.save();
}

export function isWrongPassword(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /password incorrect|needs password/i.test(message);
}

export async function renderFirstPage(
  bytes: Uint8Array,
  canvas: HTMLCanvasElement,
): Promise<number> {
  const task = getDocument({ data: bytes.slice() });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.35 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, viewport }).promise;
    return pdf.numPages;
  } finally {
    await pdf.cleanup();
    await task.destroy();
  }
}

export function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
