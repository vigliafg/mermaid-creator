import { create } from "zustand";
import { toast } from "sonner";
import { api } from "./lib/ipc";
import {
  cleanMermaidSource,
  diagramType,
  ensureDiagramMeta,
  extractMermaidBlocks,
  renderDiagram,
  replaceMermaidBlockSource,
  simplifyQuadrantLabels,
  simplifySequenceActivations,
  simplifyXYChartSeries,
  validateSourceSync,
} from "./lib/diagram";
import { mergeAfterAi } from "./lib/diagram/document";
import { parseThemeMap, resolveTheme, themeForId, type DiagramTheme } from "./lib/diagram/theme";
import {
  applyThemeCommand,
  extractThemeCommand,
  hasThemeCommandFence,
  themeCommandSummary,
} from "./lib/diagram/themeCommand";
import { MAX_FILES, processAttachment } from "./lib/files";
import type {
  AppInfo,
  ChatEvent,
  Conversation,
  Diagram,
  DiagramBoard,
  DiagramInput,
  DiagramVersion,
  KeyStatus,
  Message,
  ModelInfo,
  PendingAttachment,
} from "./types";

type View = "chat" | "library" | "settings";

/** Modello preferito per onboarding e nuovi utenti; l'utente può cambiarlo. */
export const PREFERRED_MODEL_ID = "openai/gpt-4o-mini";
export type WorkspaceMode = "diagram" | "board";

function titleFromText(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "Nuova conversazione";
  return clean.length > 52 ? `${clean.slice(0, 52)}…` : clean;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function validateMermaidSource(
  source: string,
): Promise<{ ok: boolean; error: string }> {
  const sync = validateSourceSync(source);
  if (sync.ok) return { ok: true, error: "" };
  try {
    await renderDiagram(source, "light", "light");
    return { ok: true, error: "" };
  } catch (error) {
    return {
      ok: false,
      error: [sync.error ?? "", errorText(error)].filter(Boolean).join("\n"),
    };
  }
}

async function repairMermaidBlocks(
  blocks: ReturnType<typeof extractMermaidBlocks>,
  content: string,
  modelId: string,
  targetId: string | null,
): Promise<{ content: string; repaired: number; failed: number; invalid: number }> {
  let next = content;
  let repaired = 0;
  let failed = 0;
  let invalid = 0;
  for (let index = 0; index < Math.min(blocks.length, 4); index += 1) {
    const block = blocks[index];
    const validation = await validateMermaidSource(block.source);
    if (validation.ok) continue;
    if (invalid === 0) toast.info("Correggo la sintassi Mermaid…");
    invalid += 1;
    let source = block.source;
    let error = validation.error;
    let fixed = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const raw = await api.diagramRepair(
          modelId,
          source,
          error,
          targetId && index === 0 ? targetId : null,
        );
        const candidate = ensureDiagramMeta(cleanMermaidSource(raw), {
          title: block.title,
          targetId: targetId && index === 0 ? targetId : null,
        });
        const check = await validateMermaidSource(candidate);
        if (check.ok) {
          source = candidate;
          fixed = true;
          break;
        }
        source = candidate;
        error = check.error;
      } catch (repairError) {
        error = errorText(repairError);
        break;
      }
    }
    if (!fixed) {
      const sequenceFixed = simplifySequenceActivations(source);
      if (sequenceFixed !== source) {
        const check = await validateMermaidSource(sequenceFixed);
        if (check.ok) {
          source = sequenceFixed;
          fixed = true;
        }
      }
      if (!fixed) {
        const chartFixed = simplifyXYChartSeries(source);
        if (chartFixed !== source) {
          const check = await validateMermaidSource(chartFixed);
          if (check.ok) {
            source = chartFixed;
            fixed = true;
          }
        }
      }
      if (!fixed) {
        const quadrantFixed = simplifyQuadrantLabels(source);
        if (quadrantFixed !== source) {
          const check = await validateMermaidSource(quadrantFixed);
          if (check.ok) {
            source = quadrantFixed;
            fixed = true;
          }
        }
      }
    }
    if (fixed) {
      next = replaceMermaidBlockSource(next, block.ordinal, source);
      repaired += 1;
    } else {
      failed += 1;
    }
  }
  return { content: next, repaired, failed, invalid };
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
  diagramDirty: boolean;
  viewerExpanded: boolean;
  workspaceMode: WorkspaceMode;
  board: DiagramBoard | null;
  boardLoading: boolean;
  boardEpoch: number;
  boardError: string;
  boardSaveError: string | null;
  boardFlush: (() => Promise<boolean>) | null;
  versions: DiagramVersion[];
  pendingAttachments: PendingAttachment[];
  streaming: boolean;
  streamText: string;
  chatStatus: string;
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
  setDiagramDirty: (dirty: boolean) => void;
  toggleViewerExpanded: () => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  loadBoard: () => Promise<void>;
  replaceBoard: (board: DiagramBoard | null) => void;
  setBoardSaveError: (message: string | null) => void;
  registerBoardFlush: (flush: (() => Promise<boolean>) | null) => void;
  flushBoard: () => Promise<boolean>;
  openBoardFor: (id: string) => Promise<void>;
  focusChat: (diagramId: string | null) => void;
  chatFocusNonce: number;
  setDiagramTheme: (id: string, theme: DiagramTheme) => Promise<void>;
  clearDiagramThemes: (ids: string[]) => Promise<void>;
  saveDiagram: (source: string, title?: string, force?: boolean) => Promise<boolean>;
  restoreVersion: (versionId: string) => Promise<void>;
  toggleLibrary: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setDiagramFeedback: (id: string, feedback: number) => Promise<void>;
  deleteDiagram: (id: string) => Promise<void>;
  loadLibrary: (query?: string) => Promise<void>;
  saveKey: (key: string) => Promise<void>;
  deleteKey: () => Promise<void>;
  refreshKeyStatus: () => Promise<void>;
  setModel: (modelId: string) => Promise<void>;
  preferDefaultModel: () => Promise<void>;
  setSetting: (key: string, value: string) => Promise<void>;
  refreshAppInfo: () => Promise<void>;
}

async function flushBeforeLeaving(get: () => AppStore): Promise<boolean> {
  if (!get().boardFlush) return true;
  const ok = await get().flushBoard();
  if (!ok) {
    toast.error("Lavagna non salvata: resta aperta per non perdere il lavoro");
  }
  return ok;
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
  diagramDirty: false,
  viewerExpanded: false,
  workspaceMode: "diagram",
  board: null,
  boardLoading: false,
  boardEpoch: 0,
  boardError: "",
  boardSaveError: null,
  boardFlush: null,
  chatFocusNonce: 0,
  versions: [],
  pendingAttachments: [],
  streaming: false,
  streamText: "",
  chatStatus: "",
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
        const fallback =
          models.find((model) => model.id === PREFERRED_MODEL_ID) ??
          models.find((model) => !model.id.endsWith(":free")) ??
          models[0];
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
    if (get().diagramDirty) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di aprire una nuova chat");
      return;
    }
    if (!(await flushBeforeLeaving(get))) return;
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
        workspaceMode: "diagram",
        board: null,
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
    if (get().diagramDirty) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di cambiare conversazione");
      return;
    }
    if (get().activeConversationId !== id && !(await flushBeforeLeaving(get))) return;
    set({
      activeConversationId: id,
      view: "chat",
      streamText: "",
      targetDiagramId: null,
      workspaceMode: "diagram",
      board: null,
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
        targetDiagramId: selected,
      });
      if (selected) {
        await get().selectDiagram(selected);
      }
    } catch (error) {
      toast.error(`Conversazione: ${errorText(error)}`);
    }
  },

  deleteConversation: async (id) => {
    if (get().diagramDirty && get().activeConversationId === id) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di eliminare la conversazione");
      return;
    }
    if (
      get().activeConversationId === id &&
      get().workspaceMode === "board" &&
      !(await flushBeforeLeaving(get))
    ) {
      return;
    }
    const removedThemeIds = get()
      .diagrams.filter((item) => item.conversationId === id && !item.inLibrary)
      .map((item) => item.id);
    try {
      await api.conversationDelete(id);
      await get().clearDiagramThemes(removedThemeIds);
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
    const targetId = get().targetDiagramId;
    if (targetId && get().diagramDirty) {
      toast.error("Salva le modifiche al diagramma prima di inviare la richiesta");
      return;
    }
    if (!get().keyStatus?.configured) {
      toast.error("Configura una API key OpenRouter nelle impostazioni");
      return;
    }
    if (get().workspaceMode === "board" && !(await flushBeforeLeaving(get))) return;
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
      const targetDiagram =
        get().diagrams.find((item) => item.id === targetId) ??
        get().library.find((item) => item.id === targetId) ??
        null;
      const baseSource = targetDiagram?.source ?? null;
      const mode = get().settings.theme === "light" ? "light" : "dark";
      const selectedTheme = targetDiagram
        ? themeForId(get().settings, targetDiagram.id)
        : null;
      const targetTheme = selectedTheme
        ? JSON.stringify(
            selectedTheme.preset === "custom"
              ? { preset: "custom", tokens: resolveTheme(selectedTheme, mode) }
              : { preset: selectedTheme.preset },
          )
        : null;
      const attachmentIds = get().pendingAttachments.map((item) => item.id);
      const currentDate = new Date().toISOString().slice(0, 10);
      set({
        streaming: true,
        streamText: "",
        chatStatus: "Analisi e pianificazione…",
        requestId,
        view: "chat",
        workspaceMode: "diagram",
      });

      const handleEvent = (event: ChatEvent) => {
        if (event.event === "status") {
          set({ chatStatus: event.data.message });
          return;
        }
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
          set({ streaming: false, requestId: null, streamText: "", chatStatus: "" });
          void (async () => {
            try {
              const data = event.data as typeof event.data & { message_id?: string };
              const messageId = data.messageId ?? data.message_id;
              if (!messageId) {
                toast.error("Evento di completamento senza messageId");
                return;
              }
              const initialBlocks = extractMermaidBlocks(data.content, {
                closedOnly: true,
              });
              const repaired = await repairMermaidBlocks(
                initialBlocks,
                data.content,
                modelId,
                targetId,
              );
              if (repaired.repaired > 0) {
                toast.success(
                  `Mermaid corretto${repaired.repaired === 1 ? "" : ` (${repaired.repaired} diagrammi)`}`,
                );
                try {
                  await api.messageUpdateContent(messageId, repaired.content);
                } catch (error) {
                  toast.warning(`Testo corretto non salvato: ${errorText(error)}`);
                }
              }
              if (repaired.failed > 0) {
                toast.warning(
                  `${repaired.failed} diagramma/i restano non validi: correggili dall'editor.`,
                );
              }
              const finalContent = repaired.content;
              const themeCommand = extractThemeCommand(finalContent);
              const themeRequested = hasThemeCommandFence(finalContent);
              const blocks = extractMermaidBlocks(finalContent, {
                closedOnly: true,
              });
              const items: DiagramInput[] = blocks.map((block) => ({
                ordinal: block.ordinal,
                title: block.title,
                source: block.source,
                diagramType: diagramType(block.source),
              }));
              const currentTarget = targetId
                ? get().diagrams.find((item) => item.id === targetId) ??
                  get().library.find((item) => item.id === targetId) ??
                  null
                : null;
              const changedDuringStream =
                Boolean(targetId && baseSource !== null && currentTarget && currentTarget.source !== baseSource);
              if (targetId && (get().diagramDirty || changedDuringStream)) {
                toast.warning(
                  "Il diagramma è cambiato durante la generazione: aggiornamento non applicato. Salva e riprova.",
                );
                const messages = await api.messagesList(conversationId!);
                set({ messages });
                return;
              }
              if (targetId && baseSource !== null && items[0]) {
                const merged = mergeAfterAi(baseSource, items[0].source, items[0].diagramType);
                items[0] = { ...items[0], source: merged.source };
                if (merged.dropped.length > 0) {
                  toast.warning(
                    `Stili non applicati a ${merged.dropped.length} elemento/i: ${merged.dropped
                      .slice(0, 3)
                      .join(", ")}${merged.dropped.length > 3 ? "…" : ""}`,
                  );
                }
              }
              const synced = await api.diagramsSync(
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
              // Il diagramma toccato da questa risposta è quello collegato al
              // messaggio appena salvato. Non usare synced[0]: è il primo della
              // conversazione e in presenza di più diagrammi faceva applicare
              // tema e selezione al diagramma sbagliato.
              const affectedId =
                synced.find((item) => item.messageId === messageId)?.id ?? null;
              const first =
                targetId ??
                affectedId ??
                get().selectedDiagramId ??
                synced[0]?.id ??
                diagrams[0]?.id ??
                null;
              const nextTarget = targetId ? first : affectedId;
              set({
                messages,
                diagrams,
                conversations,
                selectedDiagramId: first,
                targetDiagramId: nextTarget,
                diagramDirty: false,
              });
              if (first) {
                await get().selectDiagram(first);
                get().setTarget(nextTarget);
              }
              if (themeCommand) {
                const themeId = targetId ?? affectedId ?? first;
                if (themeId) {
                  const currentMode = get().settings.theme === "light" ? "light" : "dark";
                  const current = resolveTheme(themeForId(get().settings, themeId), currentMode);
                  const nextTheme = applyThemeCommand(themeCommand, current);
                  await get().setDiagramTheme(themeId, nextTheme);
                  toast.success(`Tema aggiornato: ${themeCommandSummary(themeCommand)}`);
                } else {
                  toast.warning("L'AI ha proposto un tema ma non c'è un diagramma a cui applicarlo");
                }
              } else if (themeRequested) {
                toast.warning(
                  "Il modello ha proposto un tema in un formato non riconosciuto: nessun tema è stato applicato.",
                );
              }
              if (targetId && items.length === 0 && !themeCommand) {
                toast.warning("Il modello non ha restituito un diagramma da aggiornare");
              }
            } catch (error) {
              toast.error(`Salvataggio diagrammi: ${errorText(error)}`);
            }
          })();
          return;
        }
        if (event.event === "error" || event.event === "cancelled") {
          set({ streaming: false, requestId: null, streamText: "", chatStatus: "" });
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
          targetTheme,
          attachmentIds,
          currentDate,
        },
        handleEvent,
      );
    } catch (error) {
      set({ streaming: false, requestId: null, streamText: "", chatStatus: "" });
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
    if (get().diagramDirty && id !== get().selectedDiagramId) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di cambiare");
      return;
    }
    if (get().workspaceMode === "board" && !(await flushBeforeLeaving(get))) {
      return;
    }
    set({
      selectedDiagramId: id,
      targetDiagramId: id,
      versions: [],
      workspaceMode: "diagram",
      board: null,
      boardError: "",
    });
    if (!id) return;
    try {
      const versions = await api.diagramVersions(id);
      set({ versions });
    } catch {
      // best effort
    }
  },

  setTarget: (id) => set({ targetDiagramId: id }),

  setDiagramDirty: (dirty) => set({ diagramDirty: dirty }),

  toggleViewerExpanded: () => set((state) => ({ viewerExpanded: !state.viewerExpanded })),

  setWorkspaceMode: (mode) => set({ workspaceMode: mode }),

  replaceBoard: (board) =>
    set((state) => ({ board, boardEpoch: state.boardEpoch + 1 })),

  setBoardSaveError: (message) => set({ boardSaveError: message }),

  registerBoardFlush: (flush) => set({ boardFlush: flush }),

  flushBoard: async () => {
    const flush = get().boardFlush;
    if (!flush) return true;
    try {
      return await flush();
    } catch (error) {
      toast.error(`Salvataggio lavagna: ${errorText(error)}`);
      return false;
    }
  },

  openBoardFor: async (id) => {
    if (get().workspaceMode === "board" && get().selectedDiagramId === id) return;
    if (get().diagramDirty) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di aprire la lavagna");
      return;
    }
    await get().selectDiagram(id);
    if (get().selectedDiagramId !== id) return;
    set((state) => ({ workspaceMode: "board", boardEpoch: state.boardEpoch + 1 }));
    await get().loadBoard();
  },

  focusChat: (diagramId) =>
    set((state) => ({
      view: "chat",
      targetDiagramId: diagramId,
      workspaceMode: "diagram",
      chatFocusNonce: state.chatFocusNonce + 1,
    })),

  loadBoard: async () => {
    const id = get().selectedDiagramId;
    if (!id) {
      set({ board: null, boardLoading: false, boardError: "" });
      return;
    }
    set({ boardLoading: true, boardError: "" });
    try {
      const board = await api.boardGet(id);
      if (get().selectedDiagramId !== id) return;
      set((state) => ({
        board,
        boardLoading: false,
        boardSaveError: null,
        boardEpoch: state.boardEpoch + 1,
      }));
    } catch (error) {
      set({ boardLoading: false, boardError: errorText(error) });
    }
  },

  setDiagramTheme: async (id, theme) => {
    const current = parseThemeMap(get().settings.diagram_themes);
    if (theme.preset === "auto") delete current[id];
    else current[id] = theme;
    await get().setSetting("diagram_themes", JSON.stringify(current));
  },

  clearDiagramThemes: async (ids) => {
    if (!ids.length) return;
    const current = parseThemeMap(get().settings.diagram_themes);
    let changed = false;
    for (const id of ids) {
      if (id in current) {
        delete current[id];
        changed = true;
      }
    }
    if (changed) await get().setSetting("diagram_themes", JSON.stringify(current));
  },

  saveDiagram: async (source, title, force = false) => {
    const id = get().selectedDiagramId;
    if (!id) return false;
    if (!(await get().flushBoard())) {
      toast.error("Lavagna non salvata: versione non creata");
      return false;
    }
    try {
      const diagram = await api.diagramSaveVersion(id, source, title, force);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === diagram.id ? diagram : item)),
        library: state.library.map((item) => (item.id === diagram.id ? diagram : item)),
      }));
      const versions = await api.diagramVersions(id);
      const created = versions.length > get().versions.length;
      set({ versions, diagramDirty: false });
      toast.success(
        created ? "Versione salvata" : "Nessuna modifica da salvare",
      );
      return true;
    } catch (error) {
      toast.error(`Salvataggio versione: ${errorText(error)}`);
      return false;
    }
  },

  restoreVersion: async (versionId) => {
    const id = get().selectedDiagramId;
    if (!id) return;
    if (get().diagramDirty) {
      toast.warning("Salva o annulla le modifiche al diagramma prima di ripristinare");
      return;
    }
    try {
      const diagram = await api.diagramRestore(id, versionId);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === diagram.id ? diagram : item)),
        library: state.library.map((item) => (item.id === diagram.id ? diagram : item)),
      }));
      const versions = await api.diagramVersions(id);
      set({ versions, diagramDirty: false, boardError: "" });
      await get().loadBoard();
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

  setDiagramFeedback: async (id, feedback) => {
    const diagram =
      get().diagrams.find((item) => item.id === id) ??
      get().library.find((item) => item.id === id);
    if (!diagram) return;
    const next = diagram.feedback === feedback ? 0 : feedback;
    set((state) => ({
      diagrams: state.diagrams.map((item) =>
        item.id === id ? { ...item, feedback: next } : item,
      ),
      library: state.library.map((item) =>
        item.id === id ? { ...item, feedback: next } : item,
      ),
    }));
    try {
      const updated = await api.diagramSetFeedback(id, next);
      set((state) => ({
        diagrams: state.diagrams.map((item) => (item.id === id ? updated : item)),
        library: state.library.map((item) => (item.id === id ? updated : item)),
      }));
    } catch (error) {
      set((state) => ({
        diagrams: state.diagrams.map((item) =>
          item.id === id ? { ...item, feedback: diagram.feedback } : item,
        ),
        library: state.library.map((item) =>
          item.id === id ? { ...item, feedback: diagram.feedback } : item,
        ),
      }));
      toast.error(`Feedback: ${errorText(error)}`);
    }
  },

  deleteDiagram: async (id) => {
    if (get().workspaceMode === "board" && get().selectedDiagramId === id) {
      if (!(await flushBeforeLeaving(get))) return;
      set({ workspaceMode: "diagram", board: null });
    }
    try {
      await api.diagramDelete(id);
      await get().clearDiagramThemes([id]);
      set((state) => ({
        diagrams: state.diagrams.filter((item) => item.id !== id),
        library: state.library.filter((item) => item.id !== id),
        selectedDiagramId:
          state.selectedDiagramId === id ? null : state.selectedDiagramId,
        targetDiagramId:
          state.targetDiagramId === id ? null : state.targetDiagramId,
        workspaceMode:
          state.selectedDiagramId === id ? "diagram" : state.workspaceMode,
        board: state.selectedDiagramId === id ? null : state.board,
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

  preferDefaultModel: async () => {
    const preferred = get().models.find((model) => model.id === PREFERRED_MODEL_ID);
    if (!preferred) return;
    if (get().settings.model_id === preferred.id) return;
    await get().setModel(preferred.id);
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
