import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { BoardSpike } from "./components/board/BoardSpike";
import "./styles.css";

// Excalidraw carica i font da questo percorso a runtime. Impostarlo prima
// dell'import lazy del componente evita ogni richiesta al CDN.
window.EXCALIDRAW_ASSET_PATH ??= "/excalidraw-assets/";

const spike = import.meta.env.VITE_BOARD_SPIKE === "1";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {spike ? <BoardSpike /> : <App />}
  </React.StrictMode>,
);
