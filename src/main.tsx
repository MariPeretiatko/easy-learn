import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CloudRoot } from "./cloud/CloudRoot";
import "@fontsource-variable/comfortaa";
import "./styles/main.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CloudRoot>
        <App />
      </CloudRoot>
    </ErrorBoundary>
  </React.StrictMode>,
);
