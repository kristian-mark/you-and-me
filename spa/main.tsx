import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CoupleApp } from "@/components/couple-app";
import "@/styles.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <CoupleApp />
  </StrictMode>,
);
