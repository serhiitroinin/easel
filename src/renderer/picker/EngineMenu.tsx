import type { HarnessControl, HarnessControlValue, HarnessModel } from "reins";
import { useEffect, useRef, useState } from "react";
import type { EngineChoice, EngineDiscovery } from "../../shared/app";
import { Check } from "../icons";
import { LimitLine } from "./LimitLine";
import { controlsOf, engineLabel, modelsOf, unavailableReason } from "./discovery";

interface Props {
  engines: EngineDiscovery[];
  choice: EngineChoice | null;
  onChange(choice: EngineChoice): void;
}

/**
 * A setting with no footer button of its own. Selects and effort are footer
 * menus, so only a switch or a number is ever left for this menu.
 */
function ControlRow({ control, value, onPick }: {
  control: Exclude<HarnessControl, { kind: "select" }>;
  value: HarnessControlValue | undefined;
  onPick(value: HarnessControlValue): void;
}) {
  if (control.kind === "toggle") {
    return (
      <label className="setting">
        <span className="key">{control.label}</span>
        <input
          type="checkbox"
          checked={Boolean(value ?? control.defaultValue)}
          onChange={(event) => onPick(event.target.checked)}
        />
      </label>
    );
  }
  return (
    <label className="setting">
      <span className="key">{control.label}</span>
      <input
        type="number"
        value={Number(value ?? control.defaultValue ?? 0)}
        min={control.min}
        max={control.max}
        step={control.step}
        onChange={(event) => onPick(Number(event.target.value))}
      />
    </label>
  );
}

/** The composer that opens this menu also closes it, on Escape or a click elsewhere. */
export function EngineMenu({ engines, choice, onChange }: Props) {
  const [filter, setFilter] = useState("");
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => field.current?.focus(), []);
  const engine = engines.find((candidate) => candidate.adapterId === choice?.adapterId);
  const all = modelsOf(engine);
  const needle = filter.trim().toLowerCase();
  const models: HarnessModel[] = needle === ""
    ? all
    : all.filter((model) => `${model.label} ${model.id}`.toLowerCase().includes(needle));
  const model = all.find((candidate) => candidate.id === choice?.model);
  const problem = engine ? unavailableReason(engine.models) : "No engine is available.";

  const select = (next: Partial<EngineChoice>) => {
    if (choice) onChange({ ...choice, ...next });
  };

  /** An effort the next model does not offer is dropped with the switch. */
  const pickModel = (next: HarnessModel) => {
    if (!choice) return;
    const { effort, ...rest } = choice;
    const offered = effort !== undefined && next.effort?.options.some((option) => option.id === effort);
    onChange({ ...rest, ...(offered ? { effort } : {}), model: next.id });
  };

  return (
    <div className="menu engines" role="dialog" aria-label="Engine and model">
      <div className="marks">
        {engines.map((candidate) => (
          <button
            key={candidate.adapterId}
            type="button"
            className={candidate.adapterId === choice?.adapterId ? "mark on" : "mark"}
            onClick={() => {
              const catalog = candidate.models.status === "available" ? candidate.models.value : null;
              const first = catalog?.defaultModelId ?? catalog?.models[0]?.id;
              onChange({ adapterId: candidate.adapterId, ...(first ? { model: first } : {}) });
              setFilter("");
            }}
          >
            {engineLabel(candidate)}
          </button>
        ))}
      </div>

      <input
        ref={field}
        className="filter"
        value={filter}
        placeholder="Search models"
        aria-label="Search models"
        onChange={(event) => setFilter(event.target.value)}
      />

      <div className="rows">
        {problem !== null && <p className="plain">{problem}</p>}
        {problem === null && models.length === 0 && <p className="plain">No model matches “{filter}”.</p>}
        {models.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === choice?.model ? "row on" : "row"}
            disabled={candidate.availability === "unavailable"}
            onClick={() => pickModel(candidate)}
          >
            <span className="tick">{candidate.id === choice?.model && <Check />}</span>
            <span className="name">{candidate.label}</span>
            {candidate.description && <span className="say">{candidate.description}</span>}
          </button>
        ))}
      </div>

      {controlsOf(engine, model).flatMap((control) => (control.kind === "select" ? [] : [control])).map((control) => (
        <ControlRow
          key={control.id}
          control={control}
          value={choice?.controls?.[control.id]}
          onPick={(value) => select({ controls: { ...choice?.controls, [control.id]: value } })}
        />
      ))}

      {engine && <LimitLine discovery={engine.limits} />}
    </div>
  );
}
