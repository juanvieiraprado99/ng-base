import { describe, expect, it } from "vitest";
import {
  capabilitiesForMajor,
  detectCapabilities,
} from "../src/lib/angular-version";
import { artifactStem } from "../src/lib/artifact-plan";
import type { AddType } from "../src/lib/naming";

describe("detectCapabilities", () => {
  it("gates httpResource on 19.1", () => {
    expect(detectCapabilities("19.0.5").httpResourceAvailable).toBe(false);
    expect(detectCapabilities("19.1.0").httpResourceAvailable).toBe(true);
    expect(detectCapabilities("19.1.0").httpResourceStable).toBe(false);
  });

  it("turns on the v20 naming convention from 20", () => {
    expect(detectCapabilities("19.2.0").newFileNaming).toBe(false);
    expect(detectCapabilities("20.0.0").newFileNaming).toBe(true);
  });

  it("turns on zoneless and Vitest defaults from 21", () => {
    expect(detectCapabilities("20.3.0").zonelessDefault).toBe(false);
    expect(detectCapabilities("21.0.0")).toMatchObject({
      zonelessDefault: true,
      vitestDefault: true,
      onPushIsDefault: false,
    });
  });

  it("turns on the v22 APIs from 22", () => {
    expect(capabilitiesForMajor(22)).toMatchObject({
      httpResourceStable: true,
      onPushIsDefault: true,
      serviceDecorator: true,
      signalFormsStable: true,
    });
  });

  it("is conservative when the version is unknown", () => {
    const caps = detectCapabilities(null);
    expect(caps.major).toBe(0);
    expect(
      Object.values(caps).filter((v) => typeof v === "boolean"),
    ).not.toContain(true);
  });
});

describe("artifactStem", () => {
  const cases: [AddType, string, string][] = [
    ["service", "user.service", "user"],
    ["component", "user.component", "user"],
    ["guard", "user.guard", "user-guard"],
    ["resolver", "user.resolver", "user-resolver"],
    ["pipe", "user.pipe", "user-pipe"],
    ["directive", "user.directive", "user"],
    ["interface", "user.interface", "user"],
    ["store", "user.store", "user-store"],
    ["enum", "user.enum", "user-enum"],
    ["form", "user.form", "user-form"],
  ];

  it.each(cases)("%s", (type, classic, v20) => {
    expect(artifactStem(type, "user", "classic")).toBe(classic);
    expect(artifactStem(type, "user", "v20")).toBe(v20);
  });
});
