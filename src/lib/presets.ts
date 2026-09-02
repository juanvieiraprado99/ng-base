import type { AngularCapabilities } from "./angular-version.js";
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

/**
 * Stamp the version-dependent defaults onto a config before it is offered to
 * the user (or written straight out by `--yes`).
 *
 * `DEFAULT_NGX_BASE_CONFIG` deliberately holds the *legacy-safe* values so that
 * a `.ngx-base-cli.json` written by an older CLI keeps generating exactly what
 * it generated before. New projects instead get what the detected Angular
 * version supports.
 */
export function applyCapabilityDefaults(
  config: NgxBaseCliConfig,
  caps: AngularCapabilities,
): NgxBaseCliConfig {
  return {
    ...config,
    angularTarget: caps.major,
    fileNaming: caps.newFileNaming ? "v20" : "classic",
    // The CLI has used environment.development.ts since Angular 15.
    environmentStyle: "development",
    // Opt in by default only once the Resource API is stable (v22).
    useHttpResource: caps.httpResourceStable,
    generateSpecs: true,
  };
}

export const PRESET_DESCRIPTIONS: Record<PresetName, string> = {
  minimal: "cache + base service only, localStorage, no interceptors",
  standard:
    "cache + base service + auth interceptor + error interceptor + barrel",
  full: "standard + base folder structure (layout, pages, routes, shared)",
};
