export type AddType =
  | "service"
  | "component"
  | "guard"
  | "resolver"
  | "pipe"
  | "directive"
  | "interface"
  | "store"
  | "enum"
  | "form";

export const ADD_TYPES: AddType[] = [
  "service",
  "component",
  "guard",
  "resolver",
  "pipe",
  "directive",
  "interface",
  "store",
  "enum",
  "form",
];

/**
 * Split a raw name into words, honouring separators (`-`, `_`, `/`, spaces),
 * camelCase boundaries, and acronym boundaries.
 *
 * `"UserProfile"` → `["User", "Profile"]`, `"APIKey"` → `["API", "Key"]`.
 */
export function splitWords(raw: string): string[] {
  return String(raw)
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function kebabName(raw: string): string {
  return splitWords(raw)
    .map((w) => w.toLowerCase())
    .join("-");
}

export function pascalName(raw: string): string {
  return splitWords(raw)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export function camelName(raw: string): string {
  const p = pascalName(raw);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

const CLASS_SUFFIX: Record<AddType, string> = {
  service: "Service",
  component: "Component",
  guard: "Guard",
  resolver: "Resolver",
  pipe: "Pipe",
  directive: "Directive",
  interface: "",
  store: "Store",
  enum: "",
  form: "Form",
};

/** Class/const identifier for a generated artifact, e.g. `UserService`, `userGuard`. */
export function symbolName(raw: string, type: AddType): string {
  const base = pascalName(raw) || "Feature";
  if (type === "guard" || type === "resolver" || type === "form") {
    const camel = base.charAt(0).toLowerCase() + base.slice(1);
    return `${camel}${CLASS_SUFFIX[type]}`;
  }
  return `${base}${CLASS_SUFFIX[type]}`;
}
