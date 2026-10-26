import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useApp } from "../store";
import { KeyForm } from "./KeyForm";
import { ModelPicker } from "./ModelPicker";

type OnboardingStep = "key" | "model";

export function OnboardingModal() {
  const keyStatus = useApp((s) => s.keyStatus);
  const settings = useApp((s) => s.settings);
  const models = useApp((s) => s.models);
  const modelsLoading = useApp((s) => s.modelsLoading);
  const refreshModels = useApp((s) => s.refreshModels);
  const preferDefaultModel = useApp((s) => s.preferDefaultModel);
  const setView = useApp((s) => s.setView);
  const dismissed = useApp((s) => s.onboardingDismissed);
  const dismiss = useApp((s) => s.dismissOnboarding);
  const [step, setStep] = useState<OnboardingStep>("key");
  const [active, setActive] = useState(() => !keyStatus?.configured);
  const [showModels, setShowModels] = useState(false);
  const currentModel = models.find((model) => model.id === settings.model_id);

  // Se la key viene rimossa durante la sessione, l'onboarding torna al primo
  // passo invece di mostrare uno stato senza credenziali.
  useEffect(() => {
    if (!keyStatus || dismissed) return;
    if (!keyStatus.configured) {
      setActive(true);
      setStep("key");
    }
  }, [keyStatus, dismissed]);

  if (!keyStatus || !active || dismissed) return null;

  const close = () => {
    setActive(false);
    dismiss();
    setView("settings");
  };

  const finish = () => {
    setActive(false);
  };

  return (
    <>
      <div className="modal-overlay onboarding-overlay">
        <div className="modal onboarding-modal">
          <button
            className="icon-btn onboarding-close"
            onClick={close}
            aria-label="Chiudi"
          >
            <X size={18} />
          </button>
          <div className="onboarding-mark">
            <Workflow size={28} />
          </div>
          <div className="eyebrow">
            {step === "key" ? "Benvenuto · passo 1 di 2" : "Passo 2 di 2"}
          </div>

          {step === "key" ? (
            <>
              <h1>Diagrammi Mermaid, con l'AI e un workspace che li ricorda.</h1>
              <p className="muted">
                Incolla la tua API key OpenRouter. Dopo la verifica potrai
                scegliere il modello con cui generare i diagrammi.
              </p>
              <KeyForm
                onDone={() => {
                  void preferDefaultModel();
                  setStep("model");
                  setShowModels(true);
                }}
              />
            </>
          ) : (
            <>
              <h1>Quasi fatto: scegli il modello predefinito.</h1>
              <p className="muted">
                Di default selezioniamo <strong>gpt-4o-mini</strong> quando è
                disponibile. Puoi cambiarlo in qualsiasi momento dalle
                impostazioni o dalla testata della chat.
              </p>

              <div className="onboarding-model-card">
                <div className="onboarding-model-icon">
                  <Sparkles size={18} />
                </div>
                <div className="onboarding-model-main">
                  <strong>
                    {currentModel?.name ??
                      (modelsLoading
                        ? "Caricamento catalogo…"
                        : "Nessun modello selezionato")}
                  </strong>
                  <span className="muted">
                    {currentModel
                      ? `${currentModel.id} · ${
                          currentModel.contextLength
                            ? `${Math.round(currentModel.contextLength / 1000)}k ctx`
                            : "ctx n/d"
                        } · ${
                          currentModel.promptPrice === 0
                            ? "gratis"
                            : `$${currentModel.promptPrice.toFixed(2)}/M`
                        }`
                      : models.length
                        ? "Scegli un modello dal catalogo."
                        : "Catalogo non disponibile: riprova o continua e configuralo dalle impostazioni."}
                  </span>
                </div>
                <button
                  className="btn btn-ghost tiny"
                  onClick={() => setShowModels(true)}
                  disabled={modelsLoading}
                >
                  {currentModel ? "Cambia" : "Scegli"}
                </button>
              </div>

              <div className="onboarding-model-actions">
                <button
                  className="btn btn-primary"
                  onClick={finish}
                  disabled={!currentModel}
                >
                  <Check size={16} /> Inizia
                </button>
                {models.length === 0 && !modelsLoading && (
                  <button
                    className="btn btn-ghost"
                    onClick={() => void refreshModels()}
                  >
                    <RefreshCw size={15} /> Riprova catalogo
                  </button>
                )}
                {models.length > 0 && (
                  <span className="muted small">
                    {models.length} modelli disponibili
                  </span>
                )}
              </div>
            </>
          )}

          <div className="onboarding-footer">
            <span>
              <ShieldCheck size={14} /> Key nel keyring · nessuna telemetria
            </span>
            <button className="btn btn-ghost" onClick={close}>
              Più tardi <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
      {step === "model" && showModels && (
        <ModelPicker onClose={() => setShowModels(false)} />
      )}
    </>
  );
}
