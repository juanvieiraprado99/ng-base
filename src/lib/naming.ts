export type AddType = "service" | "component" | "guard" | "resolver";

export const ADD_TYPES: AddType[] = [
  "service",
  "component",
  "guard",
  "resolver",
];

export function kebabName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pascalName(raw: string): string {
  const s = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const parts = s.split(/[-_/]/).filter(Boolean);
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
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
};

/** Class/const identifier for a generated artifact, e.g. `UserService`, `userGuard`. */
export function symbolName(raw: string, type: AddType): string {
  const base = pascalName(raw) || "Feature";
  if (type === "guard" || type === "resolver") {
    const camel = base.charAt(0).toLowerCase() + base.slice(1);
    return `${camel}${CLASS_SUFFIX[type]}`;
  }
  return `${base}${CLASS_SUFFIX[type]}`;
}
