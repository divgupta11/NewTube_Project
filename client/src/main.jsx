import { BrowserRouter } from "react-router-dom";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/main.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/videos.css";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
