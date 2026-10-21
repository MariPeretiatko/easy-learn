import React from "react";
import ReactDOM from "react-dom/client";
import { importPreparedGermanLibrary } from "./services/libraryImport";
import { reportError } from "./store/useUI";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "@fontsource-variable/comfortaa";
import "./styles/main.css";
// Import once before mounting so the library appears complete on first render.
void importPreparedGermanLibrary()
  .catch(reportError)
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  });
