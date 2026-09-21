import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import type { AttachedImage, EngineChoice, EngineDiscovery } from "../../shared/app";
import { ArrowUp, ChevronDown, Cross, Diamond, Eye, Gauge, Sliders, Stop, Zap } from "../icons";
import { EngineMenu } from "../picker/EngineMenu";
import { OptionMenu, type Option } from "../picker/OptionMenu";
import { controlsOf, effortOf, ENGINE_DEFAULT_EFFORT, modelsOf, pillText } from "../picker/discovery";
import { Activity } from "./Activity";

interface Props {
  selection: string[];
  running: boolean;
  engines: EngineDiscovery[];
  choice: EngineChoice | null;
  activity: { label: string; startedAt: number } | null;
  draft: string;
  onDraft(text: string): void;
  onEngine(choice: EngineChoice): void;
  /** Called when the engine menu opens, so its limits can be read again. */
  onEngineMenu(): void;
  onSend(text: string, images: AttachedImage[]): void;
  onStop(): void;
  captureView(): Promise<AttachedImage | null>;
}

async function readImage(file: File): Promise<AttachedImage> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return { mediaType: file.type, data: btoa(binary), name: file.name };
}

const MAX_FIELD_HEIGHT = 200;

/** Each footer menu is named by what it sets: the engine menu, effort, or a control id. */
type OpenMenu = "engine" | "effort" | `control:${string}` | null;

const toOption = (option: { id: string; label: string; description?: string; unavailableReason?: string }): Option => ({
  id: option.id,
  label: option.label,
  ...(option.description ? { description: option.description } : {}),
  ...(option.id === ENGINE_DEFAULT_EFFORT ? { hint: "Engine decides" } : {}),
  ...(option.unavailableReason !== undefined ? { disabled: true } : {}),
});

export function Composer(props: Props) {
  const { selection, running, engines, choice, draft, activity } = props;
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [grabbing, setGrabbing] = useState(false);
  const [menu, setMenu] = useState<OpenMenu>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const footer = useRef<HTMLDivElement>(null);
  const menuOpen = menu !== null;
  const engineMenuOpen = menu === "engine";
  const { onEngineMenu } = props;

  useEffect(() => {
    if (engineMenuOpen) onEngineMenu();
  }, [engineMenuOpen, onEngineMenu]);
  const toggle = (name: Exclude<OpenMenu, null>) => setMenu((current) => (current === name ? null : name));
  /** The button whose menu is open, which is where the menu hangs and where focus returns. */
  const opener = () => footer.current?.querySelector<HTMLElement>('.control[aria-expanded="true"]') ?? null;

  // The field grows with its text up to a limit, then scrolls.
  useEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(MAX_FIELD_HEIGHT, node.scrollHeight)}px`;
  }, [draft]);

  useEffect(() => {
    if (!menuOpen) return;
    const away = (event: MouseEvent) => {
      if (!footer.current?.contains(event.target as Node)) setMenu(null);
    };
    const keys = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        opener()?.focus();
        setMenu(null);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", keys, true);
    };
  }, [menuOpen]);

  const send = () => {
    if (draft.trim() === "" && images.length === 0) return;
    props.onSend(draft, images);
    props.onDraft("");
    setImages([]);
    field.current?.focus();
  };

  useEffect(() => {
    const keys = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "/")) {
        event.preventDefault();
        toggle("engine");
      }
      if (event.key === "Escape" && running && !menuOpen) props.onStop();
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  const take = async (files: FileList | null) => {
    const wanted = [...(files ?? [])].filter((file) => file.type.startsWith("image/"));
    if (wanted.length > 0) setImages([...images, ...await Promise.all(wanted.map(readImage))]);
  };

  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (event.clipboardData.files.length > 0) {
      event.preventDefault();
      void take(event.clipboardData.files);
    }
  };

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    void take(event.dataTransfer.files);
  };

  const attach = async () => {
    setGrabbing(true);
    const image = await props.captureView();
    setGrabbing(false);
    if (image) setImages([...images, { ...image, name: "The board" }]);
  };

  const pills = pillText(engines, choice);
  const ready = draft.trim() !== "" || images.length > 0;
  const stopping = running && !ready;

  const engine = engines.find((candidate) => candidate.adapterId === choice?.adapterId);
  const model = modelsOf(engine).find((candidate) => candidate.id === choice?.model);
  const selects = controlsOf(engine, model).flatMap((control) => (control.kind === "select" ? [control] : []));
  const effort = effortOf(model, choice?.effort);
  const pick = (next: Partial<EngineChoice>) => {
    if (choice) props.onEngine({ ...choice, ...next });
    opener()?.focus();
    setMenu(null);
  };
  /** "Default" sends no effort at all, so the choice loses the key rather than holding an empty one. */
  const pickEffort = (id: string) => {
    if (!choice) return;
    const { effort: _dropped, ...rest } = choice;
    props.onEngine(id === ENGINE_DEFAULT_EFFORT ? rest : { ...rest, effort: id });
    opener()?.focus();
    setMenu(null);
  };

  return (
    <div className="composer-area">
      {activity && <Activity label={activity.label} startedAt={activity.startedAt} onStop={props.onStop} />}

      <div className="composer" onDrop={drop} onDragOver={(event) => event.preventDefault()}>
        {(selection.length > 0 || images.length > 0) && (
          <div className="chips">
            {selection.length > 0 && (
              <span className="chip reference">
                <Diamond />
                {selection.length} element{selection.length === 1 ? "" : "s"}
              </span>
            )}
            {images.map((image, index) => (
              <button
                key={index}
                type="button"
                className="chip"
                onClick={() => setImages(images.filter((_, position) => position !== index))}
              >
                <span className="label">{image.name ?? "Image"}</span>
                <Cross />
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={field}
          rows={2}
          value={draft}
          placeholder={running ? "Steer this turn while it draws…" : "Ask, or describe what to draw"}
          onChange={(event) => props.onDraft(event.target.value)}
          onKeyDown={keys}
          onPaste={paste}
        />

        <div className="footer" ref={footer}>
          <div className="controls">
            <button
              type="button"
              className={menu === "engine" ? "control lead open" : "control lead"}
              onClick={() => toggle("engine")}
              title={`${pills.engine}${pills.model ? ` · ${pills.model}` : ""} (⌘K)`}
              aria-label="Engine and model"
              aria-expanded={menu === "engine"}
            >
              <span className="label">
                <span className="engine">{pills.engine}{pills.model && <span className="sep"> · </span>}</span>
                {pills.model}
              </span>
              <ChevronDown className="chevron" />
            </button>

            {effort && (
              <button
                type="button"
                className={menu === "effort" ? "control open" : "control"}
                onClick={() => toggle("effort")}
                title={`Effort: ${effort.label}`}
                aria-label={`Effort: ${effort.label}`}
                aria-haspopup="menu"
                aria-expanded={menu === "effort"}
                data-control="effort"
              >
                <Gauge className="glyph" />
                <span className="label">{effort.label}</span>
                <ChevronDown className="chevron" />
              </button>
            )}

            {selects.map((control) => {
              const name = `control:${control.id}` as const;
              const shown = pills.controls.find((entry) => entry.id === control.id)?.label ?? control.label;
              return (
                <button
                  key={control.id}
                  type="button"
                  className={menu === name ? "control open" : "control"}
                  onClick={() => toggle(name)}
                  title={`${control.label}: ${shown}`}
                  aria-label={`${control.label}: ${shown}`}
                  aria-haspopup="menu"
                  aria-expanded={menu === name}
                  data-control={control.id}
                >
                  {/speed|fast|tier/i.test(control.id) ? <Zap className="glyph" /> : <Sliders className="glyph" />}
                  <span className="label">{shown}</span>
                  <ChevronDown className="chevron" />
                </button>
              );
            })}
          </div>

          <div className="actions">
            <button
              type="button"
              className={`icon${grabbing ? " busy" : ""}`}
              onClick={() => void attach()}
              disabled={grabbing}
              title="Attach a picture of the board"
              aria-label="Attach a picture of the board"
            >
              <Eye />
            </button>
            {stopping ? (
              <button type="button" className="go stop" onClick={props.onStop} title="Stop (Esc)" aria-label="Stop">
                <Stop />
              </button>
            ) : (
              <button
                type="button"
                className="go"
                onClick={send}
                disabled={!ready}
                title={running ? "Steer this turn (↵)" : "Send (↵)"}
                aria-label={running ? "Steer this turn" : "Send"}
              >
                <ArrowUp />
              </button>
            )}
          </div>

          {menu === "engine" && (
            <EngineMenu engines={engines} choice={choice} onChange={props.onEngine} />
          )}
          {menu === "effort" && effort && (
            <OptionMenu
              label="Effort"
              options={effort.options.map(toOption)}
              value={effort.value}
              anchor={opener}
              onPick={pickEffort}
            />
          )}
          {selects.map((control) => menu === `control:${control.id}` && (
            <OptionMenu
              key={control.id}
              label={control.label}
              options={control.options.map(toOption)}
              value={String(choice?.controls?.[control.id] ?? control.defaultValue ?? "")}
              anchor={opener}
              onPick={(id) => pick({ controls: { ...choice?.controls, [control.id]: id } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
