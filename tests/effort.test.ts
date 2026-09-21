import { describe, expect, test } from "bun:test";
import type { HarnessModel } from "reins";
import { effortOf, ENGINE_DEFAULT_EFFORT } from "../src/renderer/picker/discovery";

const levels = [{ id: "low", label: "Low" }, { id: "xhigh", label: "Extra high" }];
const model = (effort?: HarnessModel["effort"]): HarnessModel => ({ id: "m", label: "M", ...(effort ? { effort } : {}) });

describe("effortOf", () => {
  test("a model without effort has no effort button", () => {
    expect(effortOf(model(), undefined)).toBeNull();
    expect(effortOf(undefined, "low")).toBeNull();
  });

  test("a model that names no default starts on a Default row that sends nothing", () => {
    const effort = effortOf(model({ options: levels }), undefined);
    expect(effort?.options.map((option) => option.label)).toEqual(["Default", "Low", "Extra high"]);
    expect(effort?.value).toBe(ENGINE_DEFAULT_EFFORT);
    expect(effort?.label).toBe("Default");
  });

  test("a chosen level is the one shown, in the order discovered", () => {
    const effort = effortOf(model({ options: levels }), "xhigh");
    expect(effort?.value).toBe("xhigh");
    expect(effort?.label).toBe("Extra high");
  });

  test("a model's own default is shown and no Default row is added", () => {
    const effort = effortOf(model({ options: levels, defaultOptionId: "low" }), undefined);
    expect(effort?.options.map((option) => option.id)).toEqual(["low", "xhigh"]);
    expect(effort?.label).toBe("Low");
  });
});
