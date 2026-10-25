import {
  ArrowUp,
  ChevronDown,
  FileImage,
  FileText,
  LayoutGrid,
  Loader2,
  Paperclip,
  Square,
  Star,
  Target,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../store";
import { ACCEPT, MAX_FILES, formatBytes } from "../lib/files";
import type { Attachment, ChatUsage, Message, PendingAttachment } from "../types";
import { api } from "../lib/ipc";
import {
  extractThemeCommand,
  hasThemeCommandFence,
  stripThemeCommands,
  themeCommandSummary,
} from "../lib/diagram/themeCommand";
import { Markdown } from "./Markdown";
import { ModelPicker } from "./ModelPicker";
import { DiagramCatalog } from "./DiagramCatalog";

function time(value: number): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: Attachment | PendingAttachment;
  onRemove?: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(
    "previewUrl" in attachment ? attachment.previewUrl : null,
  );
  const isImage = attachment.kind === "image";

  useEffect(() => {
    if (!isImage || preview || !("id" in attachment)) return;
    let cancelled = false;
    void api
      .attachmentPreview(attachment.id)
      .then((url) => {
        if (!cancelled) setPreview(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [attachment, isImage, preview]);

  return (
    <div className="attachment-chip">
      {isImage && preview ? (
        <img src={preview} alt={attachment.filename} />
      ) : isImage ? (
        <FileImage size={16} />
      ) : attachment.kind === "pdf" || attachment.kind === "docx" ? (
        <FileText size={16} />
      ) : (
        <FileText size={16} />
      )}
      <div className="attachment-meta">
        <span title={attachment.filename}>{attachment.filename}</span>
        <small>
          {attachment.kind} · {formatBytes(attachment.size)}
        </small>
      </div>
      {onRemove && (
        <button className="icon-btn" onClick={onRemove} aria-label="Rimuovi allegato">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function UsageLine({ message }: { message: Message }) {
  if (!message.usageJson) return null;
  try {
    const usage = JSON.parse(message.usageJson) as ChatUsage;
    return (
      <div className="usage-line">
        {usage.promptTokens} input · {usage.completionTokens} output
        {typeof usage.cost === "number" ? ` · $${usage.cost.toFixed(5)}` : ""}
      </div>
    );
  } catch {
    return null;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const diagrams = useApp((s) => s.diagrams);
  const selectDiagram = useApp((s) => s.selectDiagram);
  const openBoardFor = useApp((s) => s.openBoardFor);
  if (message.status === "streaming") return null;
  const isUser = message.role === "user";
  const messageDiagrams = diagrams.filter((diagram) => diagram.messageId === message.id);
  const themeCommand = !isUser ? extractThemeCommand(message.content) : null;
  const themeRequested = !isUser && hasThemeCommandFence(message.content);
  const visibleContent = isUser ? message.content : stripThemeCommands(message.content);

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"}`}>
      <div className={`message-bubble ${isUser ? "user-bubble" : "assistant-bubble"}`}>
        {isUser ? (
          <div className="user-text">{message.content}</div>
        ) : visibleContent ? (
          <Markdown content={visibleContent} />
        ) : themeCommand || themeRequested ? null : (
          <div className="muted">Nessun testo restituito.</div>
        )}

        {themeCommand && (
          <div className="theme-note">
            Tema del diagramma: {themeCommandSummary(themeCommand)}
          </div>
        )}
        {themeRequested && !themeCommand && (
          <div className="theme-note warn">
            Tema richiesto in un formato non riconosciuto: nessun tema applicato.
          </div>
        )}

        {message.status !== "complete" && message.status !== "streaming" && (
          <div className={`message-status ${message.status}`}>
            {message.status === "error"
              ? message.error || "Errore durante la generazione"
              : message.status === "cancelled"
                ? "Generazione annullata"
                : message.status === "interrupted"
                  ? "Generazione interrotta. Puoi riprovare."
                  : message.status}
          </div>
        )}

        {message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((attachment) => (
              <AttachmentChip key={attachment.id} attachment={attachment} />
            ))}
          </div>
        )}

        {messageDiagrams.length > 0 && (
          <div className="diagram-cards">
            {messageDiagrams.map((diagram) => (
              <div className="diagram-card-wrap" key={diagram.id}>
                <button
                  className="diagram-card"
                  onClick={() => void selectDiagram(diagram.id)}
                >
                  <span className="diagram-card-icon">
                    <Workflow size={17} />
                  </span>
                  <span className="diagram-card-copy">
                    <strong>{diagram.title}</strong>
                    <small>{diagram.diagramType}</small>
                  </span>
                  <span className="diagram-card-open">Apri</span>
                </button>
                <button
                  className="diagram-card-board"
                  title="Apri la lavagna Excalidraw di questo diagramma"
                  onClick={() => void openBoardFor(diagram.id)}
                >
                  Lavagna
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="message-footer">
          <span>{time(message.createdAt)}</span>
          {!isUser && <UsageLine message={message} />}
        </div>
      </div>
    </div>
  );
}

export function ChatPane() {
  const conversations = useApp((s) => s.conversations);
  const activeConversationId = useApp((s) => s.activeConversationId);
  const messages = useApp((s) => s.messages);
  const diagrams = useApp((s) => s.diagrams);
  const library = useApp((s) => s.library);
  const targetDiagramId = useApp((s) => s.targetDiagramId);
  const diagramDirty = useApp((s) => s.diagramDirty);
  const pendingAttachments = useApp((s) => s.pendingAttachments);
  const models = useApp((s) => s.models);
  const settings = useApp((s) => s.settings);
  const streaming = useApp((s) => s.streaming);
  const streamText = useApp((s) => s.streamText);
  const sendMessage = useApp((s) => s.sendMessage);
  const cancelStream = useApp((s) => s.cancelStream);
  const attachFiles = useApp((s) => s.attachFiles);
  const removePendingAttachment = useApp((s) => s.removePendingAttachment);
  const setTarget = useApp((s) => s.setTarget);

  const [input, setInput] = useState("");
  const [showModels, setShowModels] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatFocusNonce = useApp((s) => s.chatFocusNonce);
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((item) => item.id === activeConversationId);
  const currentModel = models.find((model) => model.id === settings.model_id);
  const targetDiagram = targetDiagramId
    ? diagrams.find((item) => item.id === targetDiagramId) ??
      library.find((item) => item.id === targetDiagramId) ??
      null
    : null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamText, streaming]);

  useEffect(() => {
    if (activeConversationId) {
      inputRef.current?.focus();
    }
  }, [activeConversationId]);

  const estimatedTokens = useMemo(() => {
    const textChars = input.length + messages.reduce((acc, m) => acc + m.content.length, 0);
    const imageCount = pendingAttachments.filter((a) => a.kind === "image").length;
    return Math.ceil(textChars / 4) + imageCount * 800;
  }, [input, messages, pendingAttachments]);

  const contextPercent = currentModel?.contextLength
    ? Math.min(100, Math.round((estimatedTokens / currentModel.contextLength) * 100))
    : null;

  const canSend = !streaming && (input.trim().length > 0 || pendingAttachments.length > 0);

  const submit = async () => {
    if (!canSend) return;
    if (targetDiagramId && diagramDirty) {
      toast.error("Salva le modifiche al diagramma prima di inviare la richiesta");
      return;
    }
    const text = input.trim();
    setInput("");
    await sendMessage(text);
    inputRef.current?.focus();
  };

  const handleFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length) void attachFiles(list);
  };

  const addFilesFromClipboard = (event: React.ClipboardEvent) => {
    const files: File[] = [];
    for (const item of Array.from(event.clipboardData.items)) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length) {
      event.preventDefault();
      handleFiles(files);
    }
  };

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <div className="chat-title">
          <div className="eyebrow">{conversation ? "Conversazione" : "Nuova chat"}</div>
          <h1>{conversation?.title ?? "Crea diagrammi dai tuoi testi"}</h1>
        </div>
        <button className="model-button" onClick={() => setShowModels(true)}>
          <span className="status-dot ok" />
          <span>{currentModel?.name ?? "Scegli modello"}</span>
          <ChevronDown size={15} />
        </button>
      </header>

      <div className="messages">
        {messages.length === 0 && !streaming ? (
          <div className="chat-empty">
            <div className="empty-orb">
              <Workflow size={30} />
            </div>
            <h2>Dai testo alla mappa, in una conversazione.</h2>
            <p>
              Incolla un articolo, allega un PDF o un'immagine, poi chiedi il
              diagramma che ti serve. Il workspace a destra conserva le versioni.
            </p>
            <div className="prompt-grid">
              {[
                "Trasforma questo processo in un flowchart verticale.",
                "Crea una mappa mentale da questi appunti.",
                "Fammi un diagramma di sequenza per questa API.",
                "Rappresenta questo modello di dati con un ER diagram.",
              ].map((prompt) => (
                <button
                  key={prompt}
                  className="prompt-card"
                  onClick={() => {
                    setInput(prompt);
                    inputRef.current?.focus();
                  }}
                >
                  <SparklesIcon />
                  {prompt}
                </button>
              ))}
            </div>
            <button className="catalog-entry" onClick={() => setShowCatalog(true)}>
              <LayoutGrid size={15} />
              <span>Esplora i tipi di diagramma</span>
              <small>flowchart, sequence, ER, timeline e altri</small>
            </button>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {streaming && (
          <div className="message-row assistant">
            <div className="message-bubble assistant-bubble streaming-bubble">
              {streamText ? <Markdown content={streamText} /> : <div className="typing">Sto pensando…</div>}
              <div className="streaming-line">
                <Loader2 size={13} className="spin" /> generazione in corso
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div
        className={`composer-wrap ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        {targetDiagram && (
          <div className="target-chip">
            <Target size={14} />
            <span>
              Modifica: <strong>{targetDiagram.title}</strong>
              {diagramDirty && <em className="target-dirty"> · salva prima di inviare</em>}
            </span>
            <button
              className="icon-btn"
              aria-label="Non modificare il diagramma"
              onClick={() => setTarget(null)}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {pendingAttachments.length > 0 && (
          <div className="pending-attachments">
            {pendingAttachments.map((attachment) => (
              <AttachmentChip
                key={attachment.id}
                attachment={attachment}
                onRemove={() => void removePendingAttachment(attachment.id)}
              />
            ))}
          </div>
        )}

        <div className="composer">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void submit();
              }
            }}
            onPaste={addFilesFromClipboard}
            placeholder={
              targetDiagram
                ? "Descrivi la modifica al diagramma selezionato…"
                : "Chiedi un diagramma, incolla un testo o allega un file…"
            }
            rows={1}
          />
          <div className="composer-actions">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(event) => {
                if (event.target.files) handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <button
              className="icon-btn"
              title="Tipi di diagramma"
              onClick={() => setShowCatalog(true)}
            >
              <LayoutGrid size={18} />
            </button>
            <button
              className="icon-btn"
              title="Allega file"
              onClick={() => fileInput.current?.click()}
              disabled={pendingAttachments.length >= MAX_FILES}
            >
              <Paperclip size={18} />
            </button>
            {streaming ? (
              <button className="btn btn-ghost danger" onClick={() => void cancelStream()}>
                <Square size={15} /> Annulla
              </button>
            ) : (
              <button className="send-btn" disabled={!canSend} onClick={() => void submit()}>
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="composer-meta">
          <span>
            {pendingAttachments.length}/{MAX_FILES} allegati · Enter invia, Shift+Enter va a capo
          </span>
          {contextPercent !== null && (
            <span className={contextPercent > 90 ? "danger-text" : ""}>
              contesto ≈ {contextPercent}%
            </span>
          )}
        </div>
      </div>

      {showModels && <ModelPicker onClose={() => setShowModels(false)} />}
      <DiagramCatalog
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onUsePrompt={(prompt) => {
          setInput(prompt);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }}
      />
    </section>
  );
}

function SparklesIcon() {
  return <Star size={14} />;
}
