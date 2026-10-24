import {
  BookMarked,
  KeyRound,
  MessageSquarePlus,
  Settings,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import { useApp } from "../store";

function shortModel(name: string | undefined): string {
  if (!name) return "Nessun modello";
  return name.length > 24 ? `${name.slice(0, 24)}…` : name;
}

export function Sidebar() {
  const conversations = useApp((s) => s.conversations);
  const activeConversationId = useApp((s) => s.activeConversationId);
  const keyStatus = useApp((s) => s.keyStatus);
  const models = useApp((s) => s.models);
  const settings = useApp((s) => s.settings);
  const appInfo = useApp((s) => s.appInfo);
  const view = useApp((s) => s.view);
  const newChat = useApp((s) => s.newChat);
  const selectConversation = useApp((s) => s.selectConversation);
  const deleteConversation = useApp((s) => s.deleteConversation);
  const loadLibrary = useApp((s) => s.loadLibrary);
  const setView = useApp((s) => s.setView);

  const currentModel = models.find((model) => model.id === settings.model_id);

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => void newChat()} title="Nuova conversazione">
        <span className="brand-mark">
          <Workflow size={18} />
        </span>
        <span>
          <strong>Mermaid Creator</strong>
          <small>AI diagram workspace</small>
        </span>
      </button>

      <button className="btn btn-primary new-chat" onClick={() => void newChat()}>
        <MessageSquarePlus size={17} />
        Nuova chat
      </button>

      <div className="sidebar-quick">
        <button
          className={`sidebar-quick-btn ${view === "library" ? "active" : ""}`}
          onClick={() => void loadLibrary()}
        >
          <BookMarked size={15} />
          Libreria
        </button>
        <button
          className={`sidebar-quick-btn ${view === "settings" ? "active" : ""}`}
          onClick={() => setView("settings")}
        >
          <Settings size={15} />
          Impostazioni
        </button>
      </div>

      <div className="sidebar-section-label">
        <span>Conversazioni</span>
        <span className="count">{conversations.length}</span>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="sidebar-empty">
            <Sparkles size={18} />
            <span>La prima conversazione nasce con un messaggio.</span>
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`conversation-row ${
                activeConversationId === conversation.id && view === "chat" ? "active" : ""
              }`}
              onClick={() => void selectConversation(conversation.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter") void selectConversation(conversation.id);
              }}
            >
              <div className="conversation-copy">
                <span>{conversation.title}</span>
                <small>{conversation.modelId.split("/").pop()}</small>
              </div>
              <button
                className="icon-btn row-delete"
                title="Elimina conversazione"
                onClick={(event) => {
                  event.stopPropagation();
                  if (window.confirm(`Eliminare “${conversation.title}”?`)) {
                    void deleteConversation(conversation.id);
                  }
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-spacer" />

      <div className="sidebar-status">
        <span className={`status-dot ${keyStatus?.configured ? "ok" : "off"}`} />
        <div>
          <div className="status-model">{shortModel(currentModel?.name)}</div>
          <div className="status-key">
            <KeyRound size={11} />
            {keyStatus?.configured ? keyStatus.masked : "API key assente"}
          </div>
        </div>
      </div>
      {appInfo && <div className="sidebar-version">v{appInfo.version}</div>}
    </aside>
  );
}
