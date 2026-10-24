import { BookMarked, Search, Star, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../store";

export function LibraryView() {
  const library = useApp((s) => s.library);
  const query = useApp((s) => s.libraryQuery);
  const loadLibrary = useApp((s) => s.loadLibrary);
  const selectConversation = useApp((s) => s.selectConversation);
  const selectDiagram = useApp((s) => s.selectDiagram);
  const newChat = useApp((s) => s.newChat);
  const setView = useApp((s) => s.setView);
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    if (library.length === 0) void loadLibrary(query);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const open = async (id: string, conversationId: string | null) => {
    if (conversationId) {
      await selectConversation(conversationId);
    } else {
      await newChat();
    }
    await selectDiagram(id);
    setView("chat");
  };

  return (
    <section className="main-view">
      <header className="view-header">
        <div>
          <div className="eyebrow">Archivio</div>
          <h1>Libreria diagrammi</h1>
        </div>
        <span className="count">{library.length}</span>
      </header>

      <form
        className="library-search"
        onSubmit={(event) => {
          event.preventDefault();
          void loadLibrary(draft);
        }}
      >
        <Search size={17} />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Cerca per titolo o contenuto Mermaid…"
        />
        <button className="btn btn-ghost" type="submit">
          Cerca
        </button>
      </form>

      {library.length === 0 ? (
        <div className="empty-inline tall">
          <BookMarked size={28} />
          <p>
            Nessun diagramma salvato. Apri un diagramma dal workspace e usa il
            segnalibro per aggiungerlo alla libreria.
          </p>
        </div>
      ) : (
        <div className="library-grid">
          {library.map((diagram) => (
            <button
              key={diagram.id}
              className="library-card"
              onClick={() => void open(diagram.id, diagram.conversationId)}
            >
              <div className="library-card-top">
                <span className="badge">{diagram.diagramType}</span>
                <span className="library-card-flags">
                  {diagram.favorite && <Star size={14} className="star-on" />}
                  <Workflow size={15} />
                </span>
              </div>
              <strong>{diagram.title}</strong>
              <p>{diagram.source.split("\n").filter(Boolean).slice(0, 4).join(" ")}</p>
              <div className="library-card-footer">
                <span>{new Date(diagram.updatedAt).toLocaleDateString("it-IT")}</span>
                <span>Apri →</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
