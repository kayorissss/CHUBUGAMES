import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import BugGuard from "./ui/BugGuard";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Последняя граница: если упадёт сам оболочка (не игра и не страница),
        человек увидит внятный экран, а не белый лист без объяснений. */}
    <BugGuard kind="app" name="CHUBUGAMES">
      <App />
    </BugGuard>
  </StrictMode>,
);
