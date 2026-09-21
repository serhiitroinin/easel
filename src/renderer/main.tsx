import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@excalidraw/excalidraw/index.css";
import "./tokens.css";
import "./styles.css";
import { App } from "./App";

const host = document.getElementById("root");
if (!host) throw new Error("The application root is missing.");

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
