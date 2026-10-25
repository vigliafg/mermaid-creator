/// <reference types="vite/client" />

declare module "mammoth/mammoth.browser" {
  export function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
}

interface Window {
  EXCALIDRAW_ASSET_PATH?: string;
}
