import { Channel, invoke } from "@tauri-apps/api/core";
import type {
  AppInfo,
  Attachment,
  AttachmentImport,
  ChatEvent,
  Conversation,
  Diagram,
  DiagramInput,
  DiagramVersion,
  KeyInfo,
  KeySaveResult,
  KeyStatus,
  Message,
  ModelInfo,
  SendRequest,
} from "../types";

export const api = {
  appInfo: () => invoke<AppInfo>("app_info"),

  keyStatus: () => invoke<KeyStatus>("key_status"),
  keySet: (key: string) => invoke<KeySaveResult>("key_set", { key }),
  keyTest: () => invoke<KeyInfo>("key_test"),
  keyDelete: () => invoke<void>("key_delete"),

  modelsList: () => invoke<ModelInfo[]>("models_list"),

  settingsAll: () => invoke<Record<string, string>>("settings_all"),
  settingsGet: (key: string) => invoke<string | null>("settings_get", { key }),
  settingsSet: (key: string, value: string) =>
    invoke<void>("settings_set", { key, value }),

  conversationsList: () => invoke<Conversation[]>("conversations_list"),
  conversationCreate: (title: string, modelId: string) =>
    invoke<Conversation>("conversation_create", { title, modelId }),
  conversationRename: (id: string, title: string) =>
    invoke<void>("conversation_rename", { id, title }),
  conversationDelete: (id: string) =>
    invoke<void>("conversation_delete", { id }),

  messagesList: (conversationId: string) =>
    invoke<Message[]>("messages_list", { conversationId }),

  attachmentImport: (input: AttachmentImport) =>
    invoke<Attachment>("attachment_import", { input }),
  attachmentPreview: (id: string) =>
    invoke<string>("attachment_preview", { id }),
  attachmentDelete: (id: string) =>
    invoke<void>("attachment_delete", { id }),

  chatSend: (request: SendRequest, onEvent: (event: ChatEvent) => void) => {
    const channel = new Channel<ChatEvent>();
    channel.onmessage = onEvent;
    return invoke<void>("chat_send", { request, onEvent: channel });
  },
  chatCancel: (requestId: string) =>
    invoke<void>("chat_cancel", { requestId }),

  diagramsList: (conversationId: string) =>
    invoke<Diagram[]>("diagrams_list", { conversationId }),
  libraryList: (query?: string) =>
    invoke<Diagram[]>("library_list", { query: query ?? null }),
  diagramGet: (id: string) => invoke<Diagram | null>("diagram_get", { id }),
  diagramsSync: (
    conversationId: string,
    messageId: string,
    targetDiagramId: string | null,
    items: DiagramInput[],
  ) =>
    invoke<Diagram[]>("diagrams_sync", {
      conversationId,
      messageId,
      targetDiagramId,
      items,
    }),
  diagramSaveVersion: (id: string, source: string, title?: string) =>
    invoke<Diagram>("diagram_save_version", { id, source, title: title ?? null }),
  diagramRestore: (diagramId: string, versionId: string) =>
    invoke<Diagram>("diagram_restore", { diagramId, versionId }),
  diagramSetFlags: (
    id: string,
    inLibrary?: boolean,
    favorite?: boolean,
  ) =>
    invoke<Diagram>("diagram_set_flags", {
      id,
      inLibrary: inLibrary ?? null,
      favorite: favorite ?? null,
    }),
  diagramDelete: (id: string) => invoke<void>("diagram_delete", { id }),
  diagramVersions: (id: string) =>
    invoke<DiagramVersion[]>("diagram_versions", { id }),

  saveFile: (path: string, data: string, binary: boolean) =>
    invoke<void>("save_file", { path, data, binary }),
};
