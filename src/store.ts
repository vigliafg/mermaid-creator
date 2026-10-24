import { create } from "zustand";
import { toast } from "sonner";
import { api } from "./lib/ipc";
import { extractMermaidBlocks, diagramType } from "./lib/diagram";
import { MAX_FILES, processAttachment } from "./lib/files";
import type {
  AppInfo,
  ChatEvent,
  Conversation,
  Diagram,
  DiagramInput,
  DiagramVersion,
  KeyStatus,
  Message,
  ModelInfo,
  PendingAttachment,
} from "./types";

type View = "chat" | "library" | "settings";

function titleFromText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nuova conversazione";
  return clean.length > 52 ? `${clean.slice(0, 52)}…` : clean;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

interface AppStore {
  view: View;
  keyStatus: KeyStatus | null;
  appInfo: AppInfo | null;
  models: ModelInfo[];
  modelsLoading: boolean;
  settings: Record<string, string>;
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  diagrams: Diagram[];
  library: Diagram[];
  libraryQuery: string;
  selectedDiagramId: string | null;
  targetDiagramId: string | null;
  versions: DiagramVersion[];
  pendingAttachments: PendingAttachment[];
  streaming: boolean;
  streamText: string;
  requestId: string | null;
  loading: boolean;
  onboardingDismissed: boolean;

  init: () => Promise<void>;
  dismissOnboarding: () => void;
  refreshModels: () => Promise<void>;
  setView: (view: View) => void;
  newChat: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  cancelStream: () => Promise<void>;
  attachFiles: (files: File[]) => Promise<void>;
  removePendingAttachment: (id: string) => Promise<void>;
  selectDiagram: (id: string | null) => Promise<void>;
  setTarget: (id: string | null) => void;
  saveDiagram: (source: string, title?: string) => Promise<void>;
  restoreVersion: (versionId: string) => Promise<void>;
  toggleLibrary: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  deleteDiagram: (id: string) => Promise<void>;
  loadLibrary: (query?: string) => Promise<void>;
  saveKey: (key: string) => Promise<void>;
  deleteKey: () => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  refreshAppInfo: () => Promise<void>;
}

export const useApp = create<AppStore>((set, get) => ({
  view: "chat",
  keyStatus: null,
  appInfo: null,
  models: [],
  modelsLoading: false,
  settings: { theme: "dark", model_id: "" },
  conversations: [],
  activeConversationId: null,
  messages: [],
  diagrams: [],
  library: [],
  libraryQuery: "",
  selectedDiagramId: null,
  targetDiagramId: null,
  versions: [],
  pendingAttachments: [],
  streaming: false,
  streamText: "",
  requestId: null,
  loading: true,
  onboardingDismissed: false,

  dismissOnboarding: () => set({ onboardingDismissed: true }),

  init: async () => {
    try {
      const [keyStatus, settings, conversations, appInfo] = await Promise.all([
        api.keyStatus(),
        api.settingsAll(),
        api.conversationsList(),
        api.appInfo(),
      ]);
      set({
        keyStatus,
        settings: { theme: "dark", model_id: "", ...settings },
        conversations,
        appInfo,
        loading: false,
      });
      if (keyStatus.configured) {
        void get().refreshModels();
        if (conversations.length > 0) {
          await get().selectConversation(conversations[0].id);
        }
      }
    } catch (error) {
      set({ loading: false });
      toast.error(`Avvio incompleto: ${errorText(error)}`);
    }
  },

  refreshModels: async () => {
    set({ modelsLoading: true });
    try {
      const models = await api.modelsList();
      models.sort((a, b) => a.name.localeCompare(b.name));
      set({ models, modelsLoading: false });
      const current = get().settings.model_id;
      if (!current || !models.some((model) => model.id === current)) {
        const fallback = models.find((model) => !model.id.endsWith(":free")) ?? models[0];
        if (fallback) {
          await get().setSetting("model_id", fallback.id);
        }
      }
    } catch (error) {
      set({ modelsLoading: false });
      toast.error(`Catalogo modelli: ${errorText(error)}`);
    }
  },

  setView: (view) => set({ view }),

  newChat: async () => {
    if (get().streaming) {
      toast.info("Annulla la generazione in corso prima di aprire una nuova chat");
      return;
    }
    const modelId = get().settings.model_id || get().models[0]?.id || "";
    try {
      const conversation = await api.conversationCreate(
        "Nuova conversazione",
        modelId,
      );
      set((state) => ({
        view: "chat",
        activeConversationId: conversation.id,
        conversations: [
          conversation,
          ...state.conversations.filter((item) => item.id !== conversation.id),
        ],
        messages: [],
        diagrams: [],
        selectedDiagramId: null,
        targetDiagramId: null,
        versions: [],
        streamText: "",
        pendingAttachments: [],
      }));
    } catch (error) {
      // Se il backend non è disponibile, almeno riporta l'UI a una chat vuota.
      set({
        view: "chat",
        activeConversationId: null,
        messages: [],
        diagrams: [],
        selectedDiagramId: null,
        targetDiagramId: null,
        versions: [],
        streamText: "",
        pendingAttachments: [],
      });
      toast.error(`Nuova chat: ${errorText(error)}`);
    }
  },

  selectConversation: async (id) => {
    set({
      activeConversationId: id,
      view: "chat",
      streamText: "",
      targetDiagramId: null,
    });
    try {
      const [messages, diagrams] = await Promise.all([
        api.messagesList(id),
        api.diagramsList(id),
      ]);
      const selected = diagrams[0]?.id ?? null;
      set({
        messages,
        diagrams,
        selectedDiagramId: selected,
        targetDiagramId: null,
      });
      if (selected) {
        await get().selectDiagram(selected);
        get().setTarget(null);
      }
    } catch (error) {
      toast.error(`Conversazione: ${errorText(error)}`);
    }
  },

  deleteConversation: async (id) => {
    try {
      await api.conversationDelete(id);
      const conversations = get().conversations.filter((item) => item.id !== id);
      set({ conversations });
      if (get().activeConversationId === id) {
        get().newChat();
      }
      toast.success("Conversazione eliminata");
    } catch (error) {
      toast.error(`Eliminazione: ${errorText(error)}`);
    }
  },

  sendMessage: async (text) => {
    if (get().streaming) return;
    if (!get().keyStatus?.configured) {
      toast.error("Configura una API key OpenRouter nelle impostazioni");
      return;
    }
    const modelId = get().settings.model_id;
    if (!modelId) {
      toast.error("Seleziona un modello nelle impostazioni");
      return;
    }

    let conversationId = get().activeConversationId;
    try {
      if (!conversationId) {
        const conversation = await api.conversationCreate(
          titleFromText(text),
          modelId,
        );
        conversationId = conversation.id;
        set({
          activeConversationId: conversation.id,
          conversations: [conversation, ...get().conversations],
        });
      }

      const requestId = crypto.randomUUID();
      const targetId = get().targetDiagramId;
      const attachmentIds = get().pendingAttachments.map((item) => item.id);
      set({
        streaming: true,
        streamText: "",
        requestId,
        view: "chat",
      });

      const handleEvent = (event: ChatEvent) => {
        if (event.event === "delta") {
          set((state) => ({ streamText: state.streamText + event.data.text }));
          return;
        }
        if (event.event === "started") {
          set({ pendingAttachments: [] });
          void api
            .messagesList(conversationId!)
            .then((messages) => set({ messages }))
            .catch(() => undefined);
          return;
        }
        if (event.event === "done") {
          set({ streaming: false, requestId: null, streamText: "" });
          void (async () => {
            try {
              const data = event.data as typeof event.data & { message_id?: string };
              const messageId = data.messageId ?? data.message_id;
              if (!messageId) {
                toast.error("Evento di completamento senza messageId");
                return;
              }
              const blocks = extractMermaidBlocks(data.content, {
                closedOnly: true,
              });
              const items: DiagramInput[] = blocks.map((block) => ({
                ordinal: block.ordinal,
                title: block.title,
                source: block.source,
                diagramType: diagramType(block.source),
              }));
              await api.diagramsSync(
                conversationId!,
                messageId,
                targetId,
                items,
              );
              const [messages, diagrams, conversations] = await Promise.all([
                api.messagesList(conversationId!),
                api.diagramsList(conversationId!),
                api.conversationsList(),
              ]);
              const first = targetId ?? diagrams[0]?.id ?? null;
              set({
                messages,
                diagrams,
                conversations,
                selectedDiagramId: first,
                targetDiagramId: targetId ? first : null,
              });
              if (first) {
                await get().selectDiagram(first);
                get().setTarget(targetId ? first : null);
              }
              if (targetId && items.length === 0) {
                toast.warning("Il modello non ha restituito un diagramma da aggiornare");
              }
            } catch (error) {
              toast.error(`Salvataggio diagrammi: ${errorText(error)}`);
            }
          })();
          return;
        }
        if (event.event === "error" || event.event === "cancelled") {
          set({ streaming: false, requestId: null, streamText: "" });
          void api
            .messagesList(conversationId!)
            .then((messages) => set({ messages }))
            .catch(() => undefined);
          if (event.event === "cancelled") {
            toast.info("Generazione annullata");
          } else {
            toast.error(event.data.message);
          }
        }
      };

      await api.chatSend(
        {
          requestId,
          conversationId,
          modelId,
          text,
          targetDiagramId: targetId,
          attachmentIds,
        },
        handleEvent,
      );
    } catch (error) {
      set({ streaming: false, requestId: null, streamText: "" });
      toast.error(errorText(error));
    }
  },

  cancelStream: async () => {
    const requestId = get().requestId;
    if (!requestId) return;
    try {
      await api.chatCancel(requestId);
    } catch (error) {
      toast.error(`Annullamento: ${errorText(error)}`);
    }
  },

  attachFiles: async (files) => {
    const current = get().pendingAttachments;
    const room = MAX_FILES - current.length;
    if (room <= 0) {
      toast.error(`Massimo ${MAX_FILES} allegati per messaggio`);
      return;
    }
    for (const file of files.slice(0, room)) {
      try {
        const processed = await processAttachment(file);
        const attachment = await api.attachmentImport({
          filename: file.name,
          mime: processed.mime,
          kind: processed.kind,
          text: processed.text,
          dataBase64: processed.dataBase64,
        });
        set((state) => ({
          pendingAttachments: [
            ...state.pendingAttachments,
            {
              id: attachment.id,
              filename: attachment.filename,
              kind: attachment.kind,
              mime: attachment.mime,
              size: attachment.size,
              previewUrl: processed.previewUrl,
            },
          ],
        }));
      } catch (error) {
        toast.error(`${file.name}: ${errorText(error)}`);
      }
    }
  },

  removePendingAttachment: async (id) => {
    set((state) => ({
      pendingAttachments: state.pendingAttachments.filter((item) => item.id !== id),
    }));
    try {
      await api.attachmentDelete(id);
    } catch {
      // best effort
    }
  },

  selectDiagram: async (id) => {
    set({ selectedDiagramId: id, targetDiagramId: id, versions: [] });
    if (!id) return;
    try {
      const versions = await api.diagramVersions(id);
      set({ versions });
    } catch {
      // best effort
    }
  },

  setTarget: (id) => set({ targetDiagramId: id }),

  saveDiagram: async (source, title) => {
    const id = get().selectedDiagramId;
    if (!id) return;
    try {
      const diagram = await api.diagramSaveVersion(id, source, title);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === diagram.id ? diagram : item)),
        library: state.library.map((item) => (item.id === diagram.id ? diagram : item)),
      }));
      const versions = await api.diagramVersions(id);
      set({ versions });
      toast.success("Versione salvata");
    } catch (error) {
      toast.error(`Salvataggio versione: ${errorText(error)}`);
    }
  },

  restoreVersion: async (versionId) => {
    const id = get().selectedDiagramId;
    if (!id) return;
    try {
      const diagram = await api.diagramRestore(id, versionId);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === diagram.id ? diagram : item)),
        library: state.library.map((item) => (item.id === diagram.id ? diagram : item)),
      }));
      const versions = await api.diagramVersions(id);
      set({ versions });
      toast.success("Versione ripristinata");
    } catch (error) {
      toast.error(`Ripristino: ${errorText(error)}`);
    }
  },

  toggleLibrary: async (id) => {
    const diagram =
      get().diagrams.find((item) => item.id === id) ??
      get().library.find((item) => item.id === id);
    if (!diagram) return;
    try {
      const updated = await api.diagramSetFlags(id, !diagram.inLibrary, undefined);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === id ? updated : item)),
        library: updated.inLibrary
          ? [updated, ...state.library.filter((item) => item.id !== id)]
          : state.library.filter((item) => item.id !== id),
      }));
      toast.success(updated.inLibrary ? "Salvato in libreria" : "Rimosso dalla libreria");
    } catch (error) {
      toast.error(`Libreria: ${errorText(error)}`);
    }
  },

  toggleFavorite: async (id) => {
    const diagram =
      get().diagrams.find((item) => item.id === id) ??
      get().library.find((item) => item.id === id);
    if (!diagram) return;
    try {
      const updated = await api.diagramSetFlags(id, undefined, !diagram.favorite);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === id ? updated : item)),
        library: state.library.map((item) => (item.id === id ? updated : item)),
      }));
    } catch (error) {
      toast.error(`Preferito: ${errorText(error)}`);
    }
  },

  deleteDiagram: async (id) => {
    try {
      await api.diagramDelete(id);
      set((state) => ({
        diagrams: state.diagrams.filter((item) => item.id !== id),
        library: state.library.filter((item) => item.id !== id),
        selectedDiagramId:
          state.selectedDiagramId === id ? null : state.selectedDiagramId,
        targetDiagramId:
          state.targetDiagramId === id ? null : state.targetDiagramId,
      }));
      toast.success("Diagramma eliminato");
    } catch (error) {
      toast.error(`Eliminazione diagramma: ${errorText(error)}`);
    }
  },

  loadLibrary: async (query = "") => {
    try {
      const library = await api.libraryList(query);
      set({ library, libraryQuery: query, view: "library" });
    } catch (error) {
      toast.error(`Libreria: ${errorText(error)}`);
    }
  },

  saveKey: async (key) => {
    const result = await api.keySet(key);
    set({
      keyStatus: {
        configured: true,
        masked: result.info.label,
        warning: result.warning,
      },
    });
    if (result.warning) toast.warning(result.warning);
    else toast.success("API key salvata");
    await get().refreshModels();
  },

  deleteKey: async () => {
    try {
      await api.keyDelete();
    } catch (error) {
      toast.warning(errorText(error));
    }
    set({
      keyStatus: { configured: false, masked: null, warning: null },
      models: [],
    });
  },

  refreshKeyStatus: async () => {
    try {
      const keyStatus = await api.keyStatus();
      set({ keyStatus });
    } catch (error) {
      toast.error(errorText(error));
    }
  },

  setModel: async (modelId) => {
    set((state) => ({ settings: { ...state.settings, model_id: modelId } }));
    try {
      await api.settingsSet("model_id", modelId);
    } catch (error) {
      toast.error(`Modello: ${errorText(error)}`);
    }
  },

  setSetting: async (key, value) => {
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
    try {
      await api.settingsSet(key, value);
    } catch (error) {
      toast.error(`Impostazione: ${errorText(error)}`);
    }
  },

  refreshAppInfo: async () => {
    try {
      set({ appInfo: await api.appInfo() });
    } catch {
      // best effort
    }
  },
}));
