import type { NgxBaseCliConfig } from "./config.js";
import { DEFAULT_NGX_BASE_CONFIG } from "./config.js";

export type PresetName = "minimal" | "standard" | "full";

export const PRESETS: Record<PresetName, NgxBaseCliConfig> = {
  minimal: {
    ...DEFAULT_NGX_BASE_CONFIG,
  },
  standard: {
    ...DEFAULT_NGX_BASE_CONFIG,
    generateAuthInterceptor: true,
    generateErrorInterceptor: true,
    generateBarrel: true,
  },
  full: {
    ...DEFAULT_NGX_BASE_CONFIG,
    generateAuthInterceptor: true,
    generateErrorInterceptor: true,
    generateBarrel: true,
    generateProjectStructure: true,
  },
};

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  minimal: "cache + base service only, localStorage, no interceptors",
  standard:
    "cache + base service + auth interceptor + error interceptor + barrel",
  full: "standard + base folder structure (layout, pages, routes, shared)",
};
