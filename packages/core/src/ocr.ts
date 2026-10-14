import { createCanvas } from "@napi-rs/canvas";
import { createWorker, type Worker } from "tesseract.js";

const MAX_OCR_PDF_PAGES = 10;
const MAX_RENDER_DIMENSION = 2_400;

export interface OcrResult {
  text: string;
  pages: number;
}

async function withWorker<T>(run: (worker: Worker) => Promise<T>): Promise<T> {
  const langPath = process.env.SUPERJOB_OCR_LANG_PATH;
  const worker = await createWorker(
    "eng",
    1,
    langPath ? { langPath, gzip: true } : { gzip: true },
  );

  try {
    return await run(worker);
  } finally {
    await worker.terminate();
  }
}

export async function ocrImage(data: Uint8Array): Promise<OcrResult> {
  return withWorker(async (worker) => {
    const result = await worker.recognize(Buffer.from(data));
    return { text: result.data.text.trim(), pages: 1 };
  });
}

export async function ocrPdf(data: Uint8Array): Promise<OcrResult> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  }).promise;

  const pageCount = document.numPages;
  if (pageCount > MAX_OCR_PDF_PAGES) {
    await document.destroy();
    throw new Error(`OCR is limited to ${MAX_OCR_PDF_PAGES} pages per PDF; this file has ${pageCount}.`);
  }

  try {
    return await withWorker(async (worker) => {
      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(1.5, MAX_RENDER_DIMENSION / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        const renderContext = Object.assign(context, { drawFocusIfNeeded: () => undefined }) as unknown as CanvasRenderingContext2D;
        await page.render({ canvasContext: renderContext, viewport }).promise;
        const result = await worker.recognize(canvas.toBuffer("image/png"));
        pages.push(result.data.text.trim());
        canvas.width = 0;
        canvas.height = 0;
      }
      return { text: pages.filter(Boolean).join("\n\n"), pages: pageCount };
    });
  } finally {
    await document.destroy();
  }
}
