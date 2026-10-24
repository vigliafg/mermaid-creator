import { ArrowRight, ShieldCheck, Workflow, X } from "lucide-react";
import { useApp } from "../store";
import { KeyForm } from "./KeyForm";

export function OnboardingModal() {
  const keyStatus = useApp((s) => s.keyStatus);
  const setView = useApp((s) => s.setView);
  const dismissed = useApp((s) => s.onboardingDismissed);
  const dismiss = useApp((s) => s.dismissOnboarding);

  if (!keyStatus || keyStatus.configured || dismissed) return null;

  return (
    <div className="modal-overlay onboarding-overlay">
      <div className="modal onboarding-modal">
        <button
          className="icon-btn onboarding-close"
          onClick={() => {
            dismiss();
            setView("settings");
          }}
          aria-label="Chiudi"
        >
          <X size={18} />
        </button>
        <div className="onboarding-mark">
          <Workflow size={28} />
        </div>
        <div className="eyebrow">Benvenuto</div>
        <h1>Diagrammi Mermaid, con l'AI e un workspace che li ricorda.</h1>
        <p className="muted">
          Incolla la tua API key OpenRouter. Caricheremo il catalogo modelli; da lì
          potrai trasformare testi, PDF e immagini in diagrammi pronti da esportare.
        </p>
        <KeyForm />
        <div className="onboarding-footer">
          <span>
            <ShieldCheck size={14} /> Key nel keyring · nessuna telemetria
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              dismiss();
              setView("settings");
            }}
          >
            Più tardi <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
