import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";
import { applyInitialTheme } from "./theme/init";
import { registerServiceWorker } from "./sw-register";

// Apply persisted theme synchronously before first paint to avoid a flash.
applyInitialTheme();
registerServiceWorker();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
