import type { GenerationTarget } from "./generate-plan.js";
import { applyTemplate } from "./templates.js";

export async function renderGenerationTarget(
  target: GenerationTarget,
): Promise<string> {
  if (target.rawContent !== undefined) {
    return target.rawContent;
  }
  return applyTemplate(target.template, target.vars);
}
