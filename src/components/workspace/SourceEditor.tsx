import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onCursor: (offset: number) => void;
  onSave: () => void;
  dirty: boolean;
  error?: string;
}

export function SourceEditor({
  value,
  onChange,
  textareaRef,
  onCursor,
  onSave,
  dirty,
  error,
}: Props) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const lineCount = useMemo(() => value.split(/\r?\n/).length, [value]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1).join("\n"),
    [lineCount],
  );

  const updateCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const offset = textarea.selectionStart;
    const before = value.slice(0, offset);
    setCursorInfo({
      line: before.split("\n").length,
      column: offset - before.lastIndexOf("\n"),
    });
    onCursor(offset);
  };

  return (
    <div className="source-panel">
      <div className="source-toolbar">
        <span className="eyebrow">Sorgente Mermaid</span>
        <span className={`source-dirty ${dirty ? "is-dirty" : ""}`}>
          {dirty ? "modifiche non salvate" : "salvato"}
        </span>
        <span className="source-cursor">
          riga {cursorInfo.line}, col {cursorInfo.column}
        </span>
        <button className="btn btn-ghost tiny" onClick={onSave}>
          Salva versione (Ctrl+S)
        </button>
      </div>
      <div className="source-editor-wrap">
        <div className="source-gutter" ref={gutterRef} aria-hidden="true">
          {lineNumbers}
        </div>
        <textarea
          ref={textareaRef}
          className="source-editor"
          value={value}
          spellCheck={false}
          wrap="off"
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          onSelect={updateCursor}
          onKeyUp={updateCursor}
          onClick={updateCursor}
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              const textarea = event.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const next = `${value.slice(0, start)}  ${value.slice(end)}`;
              onChange(next);
              window.requestAnimationFrame(() => {
                textarea.setSelectionRange(start + 2, start + 2);
              });
            }
          }}
        />
      </div>
      {error && <div className="source-error">{error}</div>}
    </div>
  );
}
