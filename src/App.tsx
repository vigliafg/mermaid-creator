import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "sonner";
import { ChatPane } from "./components/ChatPane";
import { LibraryView } from "./components/LibraryView";
import { OnboardingModal } from "./components/OnboardingModal";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import { WorkspacePane } from "./components/WorkspacePane";
import { useApp } from "./store";

export function App() {
  const init = useApp((s) => s.init);
  const loading = useApp((s) => s.loading);
  const view = useApp((s) => s.view);
  const theme = useApp((s) => s.settings.theme) ?? "dark";
  const viewerExpanded = useApp((s) => s.viewerExpanded);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (loading) {
    return (
      <div className="boot-screen">
        <div className="boot-mark">
          <Loader2 className="spin" size={26} />
        </div>
        <div>
          <strong>Mermaid Creator</strong>
          <span>Apertura workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${viewerExpanded ? "viewer-expanded" : ""}`}>
      <Sidebar />
      <div className="app-main">
        {view === "chat" && <ChatPane />}
        {view === "library" && <LibraryView />}
        {view === "settings" && <SettingsView />}
      </div>
      <WorkspacePane />
      {view !== "settings" && <OnboardingModal />}
      <Toaster
        theme={theme as "dark" | "light"}
        position="bottom-right"
        toastOptions={{ className: "app-toast" }}
      />
    </div>
  );
}
