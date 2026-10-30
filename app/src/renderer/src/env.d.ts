/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { JideApi } from "../../shared-types/api";

declare global {
  interface Window {
    jide: JideApi;
  }
}
