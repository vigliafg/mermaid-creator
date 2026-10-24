import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "../store";

export function KeyForm({ onDone }: { onDone?: () => void }) {
  const keyStatus = useApp((s) => s.keyStatus);
  const saveKey = useApp((s) => s.saveKey);
  const deleteKey = useApp((s) => s.deleteKey);
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      toast.error("Incolla una API key OpenRouter");
      return;
    }
    setSaving(true);
    try {
      await saveKey(value.trim());
      setValue("");
      onDone?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="key-form" onSubmit={submit}>
      {keyStatus?.configured ? (
        <div className="key-configured">
          <div>
            <div className="eyebrow">Key configurata</div>
            <div className="key-mask">{keyStatus.masked ?? "••••"}</div>
            {keyStatus.warning && <div className="form-warning">{keyStatus.warning}</div>}
          </div>
          <button
            type="button"
            className="btn btn-ghost danger"
            onClick={() => {
              void deleteKey();
            }}
          >
            <Trash2 size={15} /> Rimuovi
          </button>
        </div>
      ) : null}

      <label className="field-label" htmlFor="openrouter-key">
        {keyStatus?.configured ? "Sostituisci API key" : "API key OpenRouter"}
      </label>
      <div className="input-with-action">
        <KeyRound size={17} className="input-icon" />
        <input
          id="openrouter-key"
          className="input"
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="sk-or-v1-..."
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="icon-btn"
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Nascondi key" : "Mostra key"}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="form-help">
        La key viene validata con OpenRouter e salvata nel keyring di sistema. Non
        viene mai scritta nei log né mostrata al renderer.
      </p>
      <button className="btn btn-primary" type="submit" disabled={saving}>
        {saving ? <Loader2 className="spin" size={16} /> : <KeyRound size={16} />}
        {saving ? "Verifica…" : "Salva e verifica"}
      </button>
    </form>
  );
}
