export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TEXT_CHARS = 2_000_000;
export const MAX_FILES = 6;
export const ACCEPT =
  ".txt,.md,.markdown,.csv,.json,.yaml,.yml,.toml,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.rs,.java,.c,.cpp,.h,.sh,.sql,.pdf,.docx,image/*";

export interface ProcessedAttachment {
  kind: "text" | "image" | "pdf" | "docx";
  mime: string;
  text: string;
  dataBase64: string | null;
  previewUrl: string | null;
  size: number;
}

function cleanText(value: string): string {
  const withoutNulls = value.replace(/\u0000/g, " ");
  if (withoutNulls.length > MAX_TEXT_CHARS) {
    return (
      withoutNulls.slice(0, MAX_TEXT_CHARS) +
      "\n\n[Testo troncato: limite di 2 MB raggiunto]"
    );
  }
  return withoutNulls;
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  const maxPages = Math.min(document.numPages, 300);
  for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
    const page = await document.getPage(pageNo);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push(`[Pagina ${pageNo}]\n${text}`);
  }
  if (document.numPages > maxPages) {
    pages.push(`[PDF con ${document.numPages} pagine: estratte le prime ${maxPages}]`);
  }
  return cleanText(pages.join("\n\n"));
}

async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  return cleanText(result.value ?? "");
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Immagine non valida"));
    image.src = url;
  });
  return image;
}

async function processImage(file: File): Promise<ProcessedAttachment> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return {
      kind: "image",
      mime: "image/jpeg",
      text: "",
      dataBase64: dataUrl.split(",")[1],
      previewUrl: dataUrl,
      size: Math.round((dataUrl.length * 3) / 4),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

function isPdf(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

function isDocx(file: File): boolean {
  return (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  );
}

export async function processAttachment(file: File): Promise<ProcessedAttachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name}: file troppo grande (max 20 MB)`);
  }
  if (isImage(file)) return processImage(file);
  if (isPdf(file)) {
    const text = await extractPdf(file);
    return {
      kind: "pdf",
      mime: "application/pdf",
      text,
      dataBase64: null,
      previewUrl: null,
      size: file.size,
    };
  }
  if (isDocx(file)) {
    const text = await extractDocx(file);
    return {
      kind: "docx",
      mime: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      text,
      dataBase64: null,
      previewUrl: null,
      size: file.size,
    };
  }
  const text = cleanText(await file.text());
  return {
    kind: "text",
    mime: file.type || "text/plain",
    text,
    dataBase64: null,
    previewUrl: null,
    size: file.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
