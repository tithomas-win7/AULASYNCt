import { HttpError } from "../errors.js";

export const maxInput = 8000;

const indexEntry = /(?:[.·…]\s*){3,}(?:\d+|[ivxlcdm]+)?\s*$/iu;
const frontMatter =
  /^(?:[©®]|copyright\b|todos los derechos reservados\b|all rights reserved\b|isbn\b|(?:índice(?:\s+(?:general|temático|de contenidos))?|tabla de contenidos|sumario|contents)\s*$)/iu;

function readablePage(pageText: string) {
  const lines = pageText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const firstIndexEntry = lines.findIndex((line) => indexEntry.test(line));
  if (firstIndexEntry >= 0) {
    const lastIndexEntry = lines
      .map((line) => indexEntry.test(line))
      .lastIndexOf(true);
    const before = lines.slice(0, firstIndexEntry);
    const after = lines.slice(lastIndexEntry + 1);
    // The index may start or finish on the same page as body text.
    return [...before, ...after]
      .filter((line) => !frontMatter.test(line) && !/^\d+$/u.test(line))
      .filter((line) => line.split(/\s+/u).length >= 9 && /[.!?]$/u.test(line))
      .join("\n");
  }
  return lines
    .filter((line) => !frontMatter.test(line) && !/^\d+$/u.test(line))
    .join("\n");
}

async function withPdfDocument<T>(
  data: Uint8Array,
  process: (pdf: import("pdfjs-dist").PDFDocumentProxy) => Promise<T>,
  invalid: HttpError,
): Promise<T> {
  if (data.length > 5 * 1024 * 1024)
    throw new HttpError(422, "El PDF supera el tamaño admitido.");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: Uint8Array.from(data),
    stopAtErrors: true,
    isEvalSupported: false,
    useSystemFonts: false,
    useWasm: false,
  });
  const timeout = setTimeout(() => {
    void task.destroy().catch(() => undefined);
  }, 5000);
  try {
    return await process(await task.promise);
  } catch {
    throw invalid;
  } finally {
    clearTimeout(timeout);
    await task.destroy().catch(() => undefined);
  }
}

export async function validatePdf(data: Uint8Array) {
  await withPdfDocument(
    data,
    async (pdf) => {
      if (!pdf.numPages) throw new Error("PDF sin páginas");
      await pdf.getPage(1);
    },
    new HttpError(400, "El PDF está dañado o no se puede abrir."),
  );
}

export function extractPdf(data: Uint8Array) {
  return withPdfDocument(
    data,
    async (pdf) => {
      let text = "";
      for (
        let page = 1;
        page <= Math.min(pdf.numPages, 60) && text.length < maxInput;
        page++
      ) {
        const content = await (await pdf.getPage(page)).getTextContent();
        const pageText = content.items
          .map((item) =>
            "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "",
          )
          .join("");
        const readable = readablePage(pageText);
        if (readable) text += readable.slice(0, maxInput - text.length) + "\n";
      }
      return text.slice(0, maxInput).trim();
    },
    new HttpError(422, "No se pudo extraer texto de este PDF."),
  );
}
