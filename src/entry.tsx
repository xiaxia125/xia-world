import { createRoot } from "react-dom/client";
import { App } from "./react/App";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing React root element");
}

createRoot(rootElement).render(<App />);
