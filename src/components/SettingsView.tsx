import { Database, KeyRound, Moon, RefreshCw, Save, SlidersHorizontal, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "../store";
import { KeyForm } from "./KeyForm";
import { ModelPicker } from "./ModelPicker";

export function SettingsView() {
  const settings = useApp((s) => s.settings);
  const models = useApp((s) => s.models);
  const appInfo = useApp((s) => s.appInfo);
  const setSetting = useApp((s) => s.setSetting);
  const refreshModels = useApp((s) => s.refreshModels);
  const [prompt, setPrompt] = useState(settings.system_prompt ?? "");
  const [showModels, setShowModels] = useState(false);
  const currentModel = models.find((model) => model.id === settings.model_id);

  useEffect(() => {
    setPrompt(settings.system_prompt ?? "");
  }, [settings.system_prompt]);

  const savePrompt = async () => {
    await setSetting("system_prompt", prompt);
    toast.success("System prompt salvato");
  };

  return (
    <section className="main-view settings-view">
      <header className="view-header">
        <div>
          <div className="eyebrow">Configurazione</div>
          <h1>Impostazioni</h1>
        </div>
      </header>

      <section className="settings-card">
        <div className="settings-icon">
          <KeyRound size={19} />
        </div>
        <div className="settings-body">
          <h2>OpenRouter</h2>
          <p className="muted">API key, credito e catalogo modelli.</p>
          <KeyForm />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-icon">
          <SlidersHorizontal size={19} />
        </div>
        <div className="settings-body">
          <h2>Modello predefinito</h2>
          <div className="setting-row">
            <div>
              <strong>{currentModel?.name ?? "Nessun modello selezionato"}</strong>
              <div className="muted small">
                {currentModel
                  ? `${currentModel.id} · ${currentModel.contextLength?.toLocaleString("it-IT") ?? "?"} token · $${currentModel.promptPrice.toFixed(2)}/M input`
                  : "Serve una API key valida per caricare il catalogo."}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => setShowModels(true)}>
              Cambia modello
            </button>
          </div>
          <button className="btn btn-ghost" onClick={() => void refreshModels()}>
            <RefreshCw size={15} /> Aggiorna catalogo
          </button>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-icon">
          {settings.theme === "light" ? <Sun size={19} /> : <Moon size={19} />}
        </div>
        <div className="settings-body">
          <h2>Aspetto</h2>
          <p className="muted">Tema dell'interfaccia e dei diagrammi.</p>
          <div className="row-actions">
            <button
              className={`btn ${settings.theme !== "light" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => void setSetting("theme", "dark")}
            >
              <Moon size={15} /> Scuro
            </button>
            <button
              className={`btn ${settings.theme === "light" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => void setSetting("theme", "light")}
            >
              <Sun size={15} /> Chiaro
            </button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-icon">
          <Sun size={19} />
        </div>
        <div className="settings-body">
          <h2>Area di lavoro</h2>
          <p className="muted">
            Sfondo e griglia attorno al diagramma. Il colore del canvas del singolo
            diagramma si imposta dalla tab Tema del workspace.
          </p>
          <div className="setting-row">
            <div>
              <strong>Sfondo</strong>
              <div className="muted small">
                {settings.workspace_bg && settings.workspace_bg !== "auto"
                  ? settings.workspace_bg
                  : "Segue il tema dell'app"}
              </div>
            </div>
            <div className="row-actions">
              <input
                type="color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(settings.workspace_bg ?? "")
                    ? settings.workspace_bg
                    : settings.theme === "light"
                      ? "#f4f6fb"
                      : "#0b0e14"
                }
                onChange={(event) => void setSetting("workspace_bg", event.target.value)}
                aria-label="Sfondo area di lavoro"
              />
              <button className="btn btn-ghost tiny" onClick={() => void setSetting("workspace_bg", "auto")}>
                Auto
              </button>
            </div>
          </div>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={settings.workspace_grid !== "0"}
              onChange={(event) => void setSetting("workspace_grid", event.target.checked ? "1" : "0")}
            />
            <span>Mostra griglia</span>
          </label>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-icon">
          <Save size={19} />
        </div>
        <div className="settings-body">
          <h2>System prompt</h2>
          <p className="muted">
            Definisce il contratto di output dei diagrammi. Vuoto = prompt predefinito.
          </p>
          <textarea
            className="settings-textarea"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Lascia vuoto per usare il prompt predefinito…"
            rows={8}
          />
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={() => setPrompt("")}>
              Ripristina
            </button>
            <button className="btn btn-primary" onClick={() => void savePrompt()}>
              <Save size={15} /> Salva prompt
            </button>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-icon">
          <Database size={19} />
        </div>
        <div className="settings-body">
          <h2>Dati locali</h2>
          <p className="muted">
            Database, allegati e backup tecnico restano su Kingston. La key è nel
            keyring di sistema.
          </p>
          <dl className="info-list">
            <div>
              <dt>Data dir</dt>
              <dd>{appInfo?.dataDir ?? "—"}</dd>
            </div>
            <div>
              <dt>Versione</dt>
              <dd>{appInfo?.version ?? "0.1.0"}</dd>
            </div>
            <div>
              <dt>Modelli</dt>
              <dd>{models.length}</dd>
            </div>
          </dl>
          <p className="form-help">
            Nessuna telemetria. Le richieste e gli allegati vengono inviati a
            OpenRouter e ai provider del modello scelto.
          </p>
        </div>
      </section>

      {showModels && <ModelPicker onClose={() => setShowModels(false)} />}
    </section>
  );
}
