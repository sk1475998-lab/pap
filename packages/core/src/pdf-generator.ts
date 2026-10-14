/**
 * Zero-dependency standards-compliant PDF Generator for Tailored Resumes.
 * Produces clean, parseable PDF-1.4 documents without external C/canvas binaries.
 * Fully compatible with pdfjs-dist and ATS resume extractors.
 *
 * Uses WinAnsiEncoding (code points 0x20–0xFF / Latin-1 Supplement) which
 * covers the full Western European character set including accented letters,
 * bullet points, dashes, and curly quotes.
 */

/**
 * Map a Unicode string to WinAnsiEncoding (Latin-1 Supplement, code points
 * 0x20–0xFF) so PDF readers display it correctly.
 *
 * FIX: The previous implementation used `replace(/[^\x20-\x7E]/g, ' ')` which
 * silently stripped:
 *   - Bullet points (U+2022 `•`) → blank space
 *   - Em-dash (U+2014 `—`) → blank space
 *   - Smart quotes (U+201C/201D `“”`) → blank space
 *   - ALL accented characters (`é`, `ü`, `à`…) → blank space
 * This caused employers to receive unformatted text walls with gaps where
 * bullet points and international names should have been.
 *
 * Now:
 *   1. WinAnsi range (0x20–0xFF) is kept as-is — Helvetica supports all of it.
 *   2. Common Unicode → WinAnsi mappings are applied (bullets, dashes, quotes).
 *   3. Remaining out-of-range characters are transliterated to ASCII look-alikes.
 *   4. PDF special chars ( \ ( ) ) are escaped.
 */
function escapePdfString(str: string): string {
  // Step 1: Map common out-of-range Unicode characters to WinAnsi equivalents
  const unicodeToWinAnsi: Record<string, string> = {
    // Quotation marks
    "\u2018": "\x91", // left single quotation mark  ‘ → WinAnsi 0x91
    "\u2019": "\x92", // right single quotation mark ’ → WinAnsi 0x92
    "\u201C": "\x93", // left double quotation mark  “ → WinAnsi 0x93
    "\u201D": "\x94", // right double quotation mark ” → WinAnsi 0x94
    // Dashes
    "\u2013": "\x96", // en-dash  – → WinAnsi 0x96
    "\u2014": "\x97", // em-dash  — → WinAnsi 0x97
    // Bullet & ellipsis
    "\u2022": "\x95", // bullet   • → WinAnsi 0x95
    "\u2026": "\x85", // ellipsis … → WinAnsi 0x85
    // Trademark / copyright
    "\u2122": "\x99", // trade mark ™ → WinAnsi 0x99
    "\u00A9": "\xa9", // copyright  © (already in Latin-1, kept for clarity)
    "\u00AE": "\xae", // registered ® (already in Latin-1)
    // Common spacing variants
    "\u00A0": " ",    // non-breaking space → regular space
    "\u200B": "",     // zero-width space → removed
  };

  // Step 2: Replace known Unicode → WinAnsi mappings
  let result = str;
  for (const [unicode, winAnsi] of Object.entries(unicodeToWinAnsi)) {
    result = result.split(unicode).join(winAnsi);
  }

  // Step 3: For any remaining out-of-range characters (above 0xFF),
  // transliterate to ASCII approximations rather than replacing with a space.
  result = result.replace(/[\u0100-\uFFFF]/g, (ch) => {
    // Normalize: decompose accented chars (e.g. é → e + combining acute)
    const normalized = ch.normalize("NFD");
    // Keep only ASCII base characters from the decomposition
    const ascii = normalized.replace(/[\u0300-\u036f]/g, ""); // strip combining diacriticals
    return ascii && ascii.charCodeAt(0) <= 0x7E ? ascii : "?";
  });

  // Step 4: Escape PDF string special characters
  result = result
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  return result;
}

export interface PdfGeneratorOptions {
  fontSize?: number;
  lineHeight?: number;
  margin?: number;
  pageWidth?: number;
  pageHeight?: number;
}

/**
 * Compile plain or tailored resume text into a valid PDF binary buffer.
 */
export function textToPdf(
  text: string,
  options: PdfGeneratorOptions = {}
): Uint8Array {
  const fontSize = options.fontSize ?? 10;
  const lineHeight = options.lineHeight ?? 14;
  const margin = options.margin ?? 50;
  const pageWidth = options.pageWidth ?? 612; // US Letter
  const pageHeight = options.pageHeight ?? 792;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // Approximate character width for standard Helvetica: ~0.55 * fontSize
  const charWidth = fontSize * 0.52;
  const maxCharsPerLine = Math.floor(usableWidth / charWidth);

  // Wrap lines
  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  const wrappedLines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      wrappedLines.push("");
      continue;
    }
    const words = rawLine.split(" ");
    let curLine = "";
    for (const word of words) {
      if ((curLine + " " + word).trim().length <= maxCharsPerLine) {
        curLine = curLine ? curLine + " " + word : word;
      } else {
        if (curLine) wrappedLines.push(curLine);
        curLine = word;
      }
    }
    if (curLine) wrappedLines.push(curLine);
  }

  // Paginate lines
  const linesPerPage = Math.floor(usableHeight / lineHeight);
  const pages: string[][] = [];
  for (let i = 0; i < wrappedLines.length; i += linesPerPage) {
    pages.push(wrappedLines.slice(i, i + linesPerPage));
  }
  if (pages.length === 0) pages.push([""]);

  // Build PDF 1.4 objects
  let output = "%PDF-1.4\n";
  const offsets: number[] = [];

  const addObject = (content: string): number => {
    offsets.push(output.length);
    const objNum = offsets.length;
    output += `${objNum} 0 obj\n${content}\nendobj\n`;
    return objNum;
  };

  // Obj 1: Catalog
  const catalogNum = 1;
  const pagesRootNum = 2;
  const fontNum = 3;

  offsets.push(output.length);
  output += `1 0 obj\n<< /Type /Catalog /Pages ${pagesRootNum} 0 R >>\nendobj\n`;

  // Placeholders for page obj numbers
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];

  // Obj 2: Pages container placeholder (will be constructed after)
  // To keep deterministic object numbering, let's pre-assign:
  // 1: Catalog
  // 2: Pages
  // 3: Font
  // 4.. (4 + pages.length - 1): Page objects
  // (4 + pages.length).. (4 + pages.length*2 - 1): Content stream objects

  const numPages = pages.length;
  const firstPageNum = 4;
  const firstContentNum = firstPageNum + numPages;

  // Obj 2: Pages root
  offsets.push(output.length);
  const kids = Array.from({ length: numPages }, (_, i) => `${firstPageNum + i} 0 R`).join(" ");
  output += `2 0 obj\n<< /Type /Pages /Kids [ ${kids} ] /Count ${numPages} >>\nendobj\n`;

  // Obj 3: Standard Helvetica Font
  offsets.push(output.length);
  output += `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;

  // Write Page objects
  for (let p = 0; p < numPages; p++) {
    offsets.push(output.length);
    const pageNum = firstPageNum + p;
    const contentNum = firstContentNum + p;
    output += `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${pageWidth} ${pageHeight} ] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNum} 0 R >>\nendobj\n`;
  }

  // Write Content Streams
  for (let p = 0; p < numPages; p++) {
    offsets.push(output.length);
    const pageLines = pages[p];
    let stream = `BT\n/F1 ${fontSize} Tf\n`;
    let curY = pageHeight - margin - fontSize;

    for (const line of pageLines) {
      if (line) {
        stream += `1 0 0 1 ${margin} ${curY} Tm (${escapePdfString(line)}) Tj\n`;
      }
      curY -= lineHeight;
    }
    stream += "ET\n";

    output += `${firstContentNum + p} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`;
  }

  // Xref table
  const xrefOffset = output.length;
  const totalObjects = offsets.length;
  output += `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    const formatted = String(offset).padStart(10, "0");
    output += `${formatted} 00000 n \n`;
  }

  // Trailer
  output += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return new TextEncoder().encode(output);
}
