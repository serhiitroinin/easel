import { Excalidraw, sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme } from "../useTheme";
import { AgentPen, type Frame } from "./AgentPen";
import { EmptyBoard } from "./EmptyBoard";
import { liveElements } from "./snapshot";

export interface SavedScene {
  elements: ExcalidrawElement[];
  appState: { scrollX: number; scrollY: number; zoom: { value: number } };
}

interface Props {
  theme: Theme;
  sheetColor: string;
  initial: SavedScene | null;
  highlight: string[];
  penActive: boolean;
  empty: boolean;
  suggestions: string[];
  onSuggest(text: string): void;
  onReady(api: ExcalidrawImperativeAPI): void;
  onSelection(ids: string[]): void;
  onView(signature: string): void;
  onScene(scene: SavedScene): void;
}

function outlines(api: ExcalidrawImperativeAPI | null, ids: readonly string[]): Frame[] {
  if (!api || ids.length === 0) return [];
  const appState = api.getAppState();
  const zoom = appState.zoom.value;
  return liveElements(api.getSceneElements())
    // A long arrow's bounding box would outline half the board; its shapes carry the trace.
    .filter((element) => ids.includes(element.id)
      && element.type !== "arrow"
      && element.type !== "line"
      && !("containerId" in element && element.containerId))
    .map((element) => {
      const corner = sceneCoordsToViewportCoords({ sceneX: element.x, sceneY: element.y }, appState);
      return {
        id: element.id,
        x: corner.x - appState.offsetLeft - 7,
        y: corner.y - appState.offsetTop - 7,
        width: element.width * zoom + 14,
        height: element.height * zoom + 14,
      };
    });
}

export function BoardCanvas(props: Props) {
  const { theme, sheetColor, initial, highlight, penActive, empty, onReady, onSelection, onView, onScene } = props;
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const selection = useRef<string>("");
  const save = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wanted = useRef<string[]>([]);
  const drawn = useRef("");
  const [frames, setFrames] = useState<Frame[]>([]);

  const trace = useCallback(() => {
    const next = outlines(api.current, wanted.current);
    const key = JSON.stringify(next);
    if (key === drawn.current) return;
    drawn.current = key;
    setFrames(next);
  }, []);

  useEffect(() => {
    wanted.current = highlight;
    trace();
  }, [highlight, trace]);

  useEffect(() => {
    api.current?.updateScene({ appState: { viewBackgroundColor: sheetColor } });
  }, [sheetColor, theme]);

  const change = useCallback((elements: readonly ExcalidrawElement[], appState: AppState) => {
    const ids = Object.keys(appState.selectedElementIds).sort().join(",");
    if (ids !== selection.current) {
      selection.current = ids;
      onSelection(ids === "" ? [] : ids.split(","));
    }
    trace();
    onView(`${Math.round(appState.scrollX)}|${Math.round(appState.scrollY)}|${appState.zoom.value.toFixed(3)}`);
    if (save.current) clearTimeout(save.current);
    save.current = setTimeout(() => {
      onScene({
        elements: [...elements],
        appState: { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: { value: appState.zoom.value } },
      });
    }, 700);
  }, [onScene, onSelection, onView, trace]);

  return (
    <div className="desk">
      <div className="sheet">
        <Excalidraw
          theme={theme}
          excalidrawAPI={(instance) => {
            api.current = instance;
            instance.updateScene({ appState: { viewBackgroundColor: sheetColor } });
            onReady(instance);
          }}
          onChange={change}
          initialData={initial
            ? { elements: initial.elements, appState: initial.appState as unknown as AppState }
            : { appState: { viewBackgroundColor: sheetColor } as unknown as AppState }}
          UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false } }}
        />
        {empty && <EmptyBoard suggestions={props.suggestions} onSuggest={props.onSuggest} />}
        <AgentPen frames={frames} active={penActive} />
      </div>
    </div>
  );
}
