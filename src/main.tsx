import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./styles-board.css";

// Excalidraw carica i font da questo percorso a runtime. Impostarlo prima
// dell'import lazy del componente evita ogni richiesta al CDN.
window.EXCALIDRAW_ASSET_PATH ??= "/excalidraw-assets/";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
