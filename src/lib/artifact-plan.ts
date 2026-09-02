import path from "node:path";
import fse from "fs-extra";
import type { FileNaming } from "./config.js";
import { importBetweenFiles } from "./import-paths.js";
import {
  type AddType,
  camelName,
  kebabName,
  pascalName,
  symbolName,
} from "./naming.js";

export type ComponentStyle = "scss" | "css" | "none";

export const COMPONENT_STYLES: ComponentStyle[] = ["scss", "css", "none"];

/** Which test runner the generated `.spec.ts` targets. */
export type SpecStyle = "vitest" | "jasmine";

export interface PlannedFile {
  outPath: string;
  template: string;
  vars: Record<string, string>;
}

export interface AddOptions {
  inlineTemplate?: boolean;
  style?: ComponentStyle;
  /** Emit a companion `.spec.ts` next to the artifact. */
  generateSpecs?: boolean;
  /** Vitest needs explicit imports; Jasmine globals do not. */
  specStyle?: SpecStyle;
  /** File naming convention; defaults to the pre-v20 `classic` scheme. */
  fileNaming?: FileNaming;
  /** Angular 22 makes OnPush the default, so the field becomes redundant. */
  onPushIsDefault?: boolean;
  /** Angular 22 `@Service()` instead of `@Injectable({ providedIn: 'root' })`. */
  serviceDecorator?: boolean;
  /** Signal Forms are only stable from Angular 22. */
  signalFormsStable?: boolean;
  /** CLI `--skip-tests`; overrides `generateSpecs` when set. */
  skipTests?: boolean;
}

export type PlanResult =
  | { ok: true; files: PlannedFile[] }
  | { ok: false; error: string };

/** Folder each artifact type lives in, relative to `outputDir`. */
const ARTIFACT_DIR: Record<AddType, string> = {
  service: "services",
  component: "components",
  guard: "guards",
  resolver: "resolvers",
  pipe: "pipes",
  directive: "directives",
  interface: "interfaces",
  store: "stores",
  enum: "enum",
  form: "forms",
};

/** `user.service.ts`, `user.guard.ts`, ... */
const CLASSIC_SUFFIX: Record<AddType, string> = {
  service: ".service",
  component: ".component",
  guard: ".guard",
  resolver: ".resolver",
  pipe: ".pipe",
  directive: ".directive",
  interface: ".interface",
  store: ".store",
  enum: ".enum",
  form: ".form",
};

/** Angular v20 style guide: `user.ts`, `user-guard.ts`, `user-store.ts`, ... */
const V20_SUFFIX: Record<AddType, string> = {
  service: "",
  component: "",
  guard: "-guard",
  resolver: "-resolver",
  pipe: "-pipe",
  directive: "",
  interface: "",
  store: "-store",
  enum: "-enum",
  form: "-form",
};

const SPEC_TEMPLATE: Partial<Record<AddType, string>> = {
  service: "feature.service.spec.ts.tpl",
  component: "feature.component.spec.ts.tpl",
  guard: "feature.guard.spec.ts.tpl",
  resolver: "feature.resolver.spec.ts.tpl",
  pipe: "feature.pipe.spec.ts.tpl",
  directive: "feature.directive.spec.ts.tpl",
  store: "feature.store.spec.ts.tpl",
  form: "feature.form.spec.ts.tpl",
};

const VITEST_IMPORT =
  "import { beforeEach, describe, expect, it } from 'vitest';\n";

/** Filename stem (no extension) for an artifact under the given convention. */
export function artifactStem(
  type: AddType,
  kebab: string,
  naming: FileNaming = "classic",
): string {
  return kebab + (naming === "v20" ? V20_SUFFIX[type] : CLASSIC_SUFFIX[type]);
}

/**
 * Pre-rendered decorator line. Angular 22 introduced `@Service()` as the
 * ergonomic form of `@Injectable({ providedIn: 'root' })`.
 */
export function serviceDecoratorVars(opts: AddOptions): Record<string, string> {
  return opts.serviceDecorator
    ? { SERVICE_DECORATOR: "@Service()", SERVICE_DECORATOR_IMPORT: "Service" }
    : {
        SERVICE_DECORATOR: "@Injectable({ providedIn: 'root' })",
        SERVICE_DECORATOR_IMPORT: "Injectable",
      };
}

/**
 * Angular 22 made `OnPush` the default strategy, so writing it out is noise.
 * Older versions still need the explicit field.
 */
export function changeDetectionVars(opts: AddOptions): Record<string, string> {
  return opts.onPushIsDefault
    ? { CHANGE_DETECTION_FIELD: "", CHANGE_DETECTION_IMPORT: "" }
    : {
        CHANGE_DETECTION_FIELD:
          "  changeDetection: ChangeDetectionStrategy.OnPush,\n",
        CHANGE_DETECTION_IMPORT: "ChangeDetectionStrategy, ",
      };
}

/**
 * Maps an `add`/`remove` artifact request to the files it produces under
 * `<cwd>/<outputDir>`. The `service` type also asserts that `base.service.ts`
 * exists (it is the superclass), returning an error otherwise.
 */
export async function planArtifactFiles(
  type: AddType,
  rawName: string,
  cwd: string,
  outputDir: string,
  opts: AddOptions = {},
): Promise<PlanResult> {
  const kebab = kebabName(rawName);
  const className = symbolName(rawName, type);
  const modelName = pascalName(rawName) || "Feature";
  const naming = opts.fileNaming ?? "classic";
  const stem = artifactStem(type, kebab, naming);
  const base = path.join(cwd, outputDir);
  const dir =
    type === "component"
      ? path.join(base, ARTIFACT_DIR.component, kebab)
      : path.join(base, ARTIFACT_DIR[type]);

  if (type === "form" && opts.signalFormsStable === false) {
    return {
      ok: false,
      error:
        "Signal Forms require Angular 22 or newer. Upgrade the project, or scaffold the form manually.",
    };
  }

  const files: PlannedFile[] = [];

  const pushSpec = (): void => {
    const template = SPEC_TEMPLATE[type];
    if (!opts.generateSpecs || !template) return;
    files.push({
      outPath: path.join(dir, `${stem}.spec.ts`),
      template,
      vars: {
        FILE_STEM: stem,
        CLASS_NAME: className,
        FN_NAME: className,
        MODEL_NAME: modelName,
        TEST_IMPORT: opts.specStyle === "jasmine" ? "" : VITEST_IMPORT,
      },
    });
  };

  switch (type) {
    case "service": {
      const outPath = path.join(dir, `${stem}.ts`);
      const baseServiceFile = path.join(base, "services/base.service.ts");
      if (!(await fse.pathExists(baseServiceFile))) {
        return {
          ok: false,
          error: `base.service.ts not found at ${path.relative(cwd, baseServiceFile)}. Run init or update outputDir in .ngx-base-cli.json.`,
        };
      }
      files.push({
        outPath,
        template: "feature.service.ts.tpl",
        vars: {
          SERVICE_CLASS_NAME: className,
          BASE_SERVICE_IMPORT: importBetweenFiles(outPath, baseServiceFile),
          ...serviceDecoratorVars(opts),
        },
      });
      pushSpec();
      return { ok: true, files };
    }
    case "component": {
      const selector = `app-${kebab}`;
      const inline = opts.inlineTemplate ?? false;
      const style = opts.style ?? "scss";
      const templateField = inline
        ? `  template: '<section class="${selector}"><!-- ${className} --></section>',\n`
        : `  templateUrl: './${stem}.html',\n`;
      const styleField =
        style === "none" ? "" : `  styleUrl: './${stem}.${style}',\n`;
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.component.ts.tpl",
        vars: {
          SELECTOR: selector,
          CLASS_NAME: className,
          TEMPLATE_FIELD: templateField,
          STYLE_FIELD: styleField,
          ...changeDetectionVars(opts),
        },
      });
      if (!inline) {
        files.push({
          outPath: path.join(dir, `${stem}.html`),
          template: "feature.component.html.tpl",
          vars: { SELECTOR: selector, CLASS_NAME: className },
        });
      }
      if (style !== "none") {
        files.push({
          outPath: path.join(dir, `${stem}.${style}`),
          template: "feature.component.style.tpl",
          vars: {},
        });
      }
      pushSpec();
      return { ok: true, files };
    }
    case "guard":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.guard.ts.tpl",
        vars: { FN_NAME: className },
      });
      pushSpec();
      return { ok: true, files };
    case "resolver":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.resolver.ts.tpl",
        vars: { FN_NAME: className },
      });
      pushSpec();
      return { ok: true, files };
    case "pipe":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.pipe.ts.tpl",
        vars: { CLASS_NAME: className, PIPE_NAME: camelName(rawName) },
      });
      pushSpec();
      return { ok: true, files };
    case "directive":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.directive.ts.tpl",
        vars: { CLASS_NAME: className, SELECTOR: `app${modelName}` },
      });
      pushSpec();
      return { ok: true, files };
    case "interface":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.interface.ts.tpl",
        vars: { CLASS_NAME: className },
      });
      return { ok: true, files };
    case "store":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.store.ts.tpl",
        vars: { CLASS_NAME: className, ...serviceDecoratorVars(opts) },
      });
      pushSpec();
      return { ok: true, files };
    case "enum":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.enum.ts.tpl",
        vars: { CLASS_NAME: className },
      });
      return { ok: true, files };
    case "form":
      files.push({
        outPath: path.join(dir, `${stem}.ts`),
        template: "feature.form.ts.tpl",
        vars: { FN_NAME: className, MODEL_NAME: modelName },
      });
      pushSpec();
      return { ok: true, files };
  }
}
