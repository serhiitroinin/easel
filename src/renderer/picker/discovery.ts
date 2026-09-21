import type { HarnessControl, HarnessDiscovery, HarnessModel } from "reins";
import type { EngineChoice, EngineDiscovery } from "../../shared/app";

export function unavailableReason(discovery: HarnessDiscovery<unknown>): string | null {
  if (discovery.status === "available") return null;
  return discovery.status === "unsupported"
    ? discovery.message ?? "This engine does not offer that."
    : discovery.message;
}

export function modelsOf(engine: EngineDiscovery | undefined): HarnessModel[] {
  return engine?.models.status === "available" ? [...engine.models.value.models] : [];
}

export function engineLabel(engine: EngineDiscovery): string {
  return engine.profile.status === "available" ? engine.profile.value.label : engine.adapterId;
}

export function controlsOf(engine: EngineDiscovery | undefined, model: HarnessModel | undefined): HarnessControl[] {
  const merged = new Map<string, HarnessControl>();
  const profile = engine?.profile.status === "available" ? engine.profile.value.controls ?? [] : [];
  for (const control of profile) merged.set(control.id, control);
  for (const control of model?.controls ?? []) merged.set(control.id, control);
  return [...merged.values()];
}

/** The id of the row that sends no effort, so the engine decides. No harness level is empty. */
export const ENGINE_DEFAULT_EFFORT = "";

export interface EffortChoice {
  options: { id: string; label: string; description?: string }[];
  /** The row that is checked: the chosen level, the model's default, or "Default". */
  value: string;
  label: string;
}

/**
 * What the effort button offers for a model, lowest to highest as discovered. A
 * model that names no default gets a first "Default" row rather than a level
 * picked on the user's behalf.
 */
export function effortOf(model: HarnessModel | undefined, chosen: string | undefined): EffortChoice | null {
  const effort = model?.effort;
  if (!effort || effort.options.length === 0) return null;
  const levels = effort.options.map((option) => ({
    id: option.id,
    // An engine that only title-cases its ids says "Xhigh"; the level reads the same for every engine.
    label: option.id === "xhigh" && option.label === "Xhigh" ? "Extra high" : option.label,
    ...(option.description ? { description: option.description } : {}),
  }));
  const hasDefault = effort.defaultOptionId !== undefined && levels.some((level) => level.id === effort.defaultOptionId);
  const options = hasDefault
    ? levels
    : [{ id: ENGINE_DEFAULT_EFFORT, label: "Default", description: "The engine decides" }, ...levels];
  const wanted = chosen ?? effort.defaultOptionId;
  const current = options.find((option) => option.id === wanted) ?? options[0]!;
  return { options, value: current.id, label: current.label };
}

export interface PillText {
  engine: string;
  model: string | null;
  effort: string | null;
  controls: { id: string; label: string }[];
}

export function pillText(engines: EngineDiscovery[], choice: EngineChoice | null): PillText {
  const engine = engines.find((candidate) => candidate.adapterId === choice?.adapterId);
  if (!engine || !choice) return { engine: "No engine", model: null, effort: null, controls: [] };
  const model = modelsOf(engine).find((candidate) => candidate.id === choice.model);
  return {
    engine: engineLabel(engine),
    model: model?.label ?? null,
    effort: effortOf(model, choice.effort)?.label ?? null,
    controls: controlsOf(engine, model).flatMap((control) => {
      if (control.kind !== "select") return [];
      const value = choice.controls?.[control.id] ?? control.defaultValue;
      const option = control.options.find((candidate) => candidate.id === value);
      return option ? [{ id: control.id, label: option.label }] : [];
    }),
  };
}
