# Architecture

This page describes the processes of Easel, the data flow between Easel, Reins,
and the engine, and the location of each piece of state.

## Processes

| Process | Code | Function |
| --- | --- | --- |
| Main process | `src/main/` | Owns the Reins runtime, the board files, and the engine processes. |
| Preload script | `src/preload/` | Gives the window a small typed bridge (`window.easel`) over Electron IPC. |
| Window (renderer) | `src/renderer/` | Shows the Excalidraw board and the chat. It owns the live scene. |
| Engine process | Started by Reins | The Claude Code or Codex command-line tool. One process for each session. |

The window runs in the Chromium sandbox with context isolation. It has no
Node.js access. The main process does not hold the scene. It asks the window
for each canvas operation.

## Data flow of one turn

```
Window                 Main process                    Reins                Engine
  |  run.start  ------->  RunManager.start
  |                        runtime.start(request) ---->  prepares context
  |  <-- canvas request --  easel:scene source   <-----  (get_scene)
  |  --- canvas result --->                      ----->  starts the turn ---->  model
  |                                                                      <----  tool call
  |  <-- canvas request --  canvas tool execute  <-----  tool host
  |  --- canvas result --->                      ----->  tool result   ---->
  |  <-- event ------------  run.events          <-----  events        <----  text, tools
  |  <-- run ended --------  run.done
```

1. The composer sends the text, the selected ids, and the images to the main
   process.
2. `RunManager` in `src/main/runs.ts` makes the Reins input and calls
   `runtime.start`. The session key contains the board id, so each board has
   its own engine session.
3. Reins prepares the two context sources. `easel:guide` returns the drawing
   rules as trusted instructions. `easel:scene` asks the window for the scene
   and returns it as untrusted content, with the selection and the changes
   after the last turn.
4. The engine calls a canvas tool. Reins sends the call to the tool host. The
   tool validates the input and sends a canvas command through `CanvasBridge`
   to the window.
5. `src/renderer/canvas/apply.ts` reads the current scene, applies the command,
   and returns the result. The result goes back to the engine as the tool
   result.
6. The main process sends each Reins event to the window. One reducer in
   `src/renderer/chat/turns.ts` makes the chat from the events.
7. A message during a turn calls `run.followUp` with the id of the active turn.

`CanvasBridge` gives each canvas command a time limit. If the window does not
answer, the tool call fails with a message for the agent.

## Engines

`src/main/harness/engines.ts` makes one Reins adapter for Claude Code and one
for Codex. `src/main/harness/offline.ts` makes the offline engine, which exists
only when `EASEL_OFFLINE=1` is set. Each live adapter has a discovery source
from Reins. The window reads `profile()`, `models()`, and `limits()` through
the main process and builds the engine menu from the results.

## State

| State | Location | Owner |
| --- | --- | --- |
| The live scene | Excalidraw in the window | Window |
| Board files: title, scene, the messages of the person, the engine selection | `<userData>/boards/<id>.json` | `BoardStore` in the main process |
| Reins events and session checkpoints | `<userData>/harness/` | `createFilePersistence` |
| The private Codex home (`config.toml`, a link to `auth.json`) | `<userData>/codex-home/` | `engines.ts` |
| The empty working directory of the engines | `<userData>/workspace/` | `engines.ts` |
| The board as the agent last saw it | Memory of the main process | `SceneMemory` |
| Panel widths and the theme | `localStorage` of the window | Window |

`<userData>` is the Electron `userData` directory, or `EASEL_DATA_DIR` when it
is set.

The messages of the person are not Reins events, so Easel stores them in the
board file. When a board opens, Easel reads the events of each engine for that
board, merges them with the messages by timestamp, and sends them through the
same reducer as live events.

`BoardStore` writes each file to a temporary name and then renames it. It
applies the changes to one board in sequence, so two changes at the same time
do not lose data.
