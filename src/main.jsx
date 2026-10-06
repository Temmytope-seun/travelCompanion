import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import { StoreProvider } from "./store.jsx";
import App from "./App.jsx";
import { registerServiceWorker } from "./lib/push.js";

registerServiceWorker();

createRoot(document.getElementById("root")).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
