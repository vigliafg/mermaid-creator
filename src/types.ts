export interface Conversation {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
}

export interface Attachment {
  id: string;
  messageId: string | null;
  ordinal: number;
  kind: "text" | "image" | "pdf" | "docx" | string;
  filename: string;
  mime: string;
  size: number;
  hasFile: boolean;
  extractedText: string;
  createdAt: number;
}

export interface Message {
  id: string;
  conversationId: string;
  seq: number;
  role: "user" | "assistant" | string;
  content: string;
  status: string;
  modelId: string;
  targetDiagramId: string | null;
  usageJson: string | null;
  error: string | null;
  createdAt: number;
  attachments: Attachment[];
}

export interface Diagram {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  ordinal: number;
  title: string;
  source: string;
  diagramType: string;
  inLibrary: boolean;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DiagramVersion {
  id: string;
  diagramId: string;
  versionNo: number;
  source: string;
  origin: string;
  /** Scena Excalidraw salvata insieme alla versione, se esisteva. */
  boardSnapshot: string | null;
  createdAt: number;
}

export type BoardOrigin = "diagram" | "manual";

export interface DiagramBoard {
  diagramId: string;
  /** Documento Excalidraw completo: elements + appState + files. */
  sceneJson: string;
  origin: BoardOrigin;
  /** Sorgente Mermaid esatto da cui è stata generata (null se manuale). */
  baseSource: string | null;
  createdAt: number;
  updatedAt: number;
}

export type BoardQuality = "semantic" | "generic" | "image";

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number | null;
  promptPrice: number;
  completionPrice: number;
  supportsVision: boolean;
  supportsTools: boolean;
  description: string;
}

export interface FreeModelQuota {
  used: number;
  limit: number;
  remaining: number;
}

export interface KeyInfo {
  label: string;
  usage: number;
  limit: number | null;
  limitRemaining: number | null;
  isFreeTier: boolean;
  freeModelDailyRequests: FreeModelQuota | null;
}

export interface KeyStatus {
  configured: boolean;
  masked: string | null;
  warning: string | null;
}

export interface KeySaveResult {
  stored: boolean;
  warning: string | null;
  info: KeyInfo;
}

export interface AppInfo {
  dataDir: string;
  version: string;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
}

export type ChatEvent =
  | { event: "started"; data: { userMessageId: string; assistantMessageId: string } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: { messageId: string; content: string; usage: ChatUsage | null } }
  | { event: "error"; data: { message: string; partial: string } }
  | { event: "cancelled"; data: { message: string; partial: string } };

export interface SendRequest {
  requestId: string;
  conversationId: string;
  modelId: string;
  text: string;
  targetDiagramId: string | null;
  targetTheme: string | null;
  attachmentIds: string[];
}

export interface AttachmentImport {
  filename: string;
  mime: string;
  kind: string;
  text: string;
  dataBase64: string | null;
}

export interface PendingAttachment {
  id: string;
  filename: string;
  kind: string;
  mime: string;
  size: number;
  previewUrl: string | null;
}

export interface DiagramInput {
  ordinal: number;
  title: string;
  source: string;
  diagramType: string;
}
