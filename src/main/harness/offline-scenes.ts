import type { ElementSpec, ElementUpdate } from "../../shared/canvas";

/** One drawing step of a scripted turn: some words, then one tool call. */
export type SceneStep =
  | { say?: string; tool: "add_elements"; title: string; elements: ElementSpec[] }
  | { say?: string; tool: "update_elements"; title: string; updates: ElementUpdate[] }
  | { say?: string; tool: "view_canvas"; title: string }
  | { say?: string; tool: "focus"; title: string; ids: string[] };

export interface OfflineScene {
  opening: string;
  steps: SceneStep[];
  closing: string;
  /** The elements a follow-up message recolours. */
  steerable: string[];
}

const BLUE = "#a5d8ff";
const GREEN = "#b2f2bb";
const YELLOW = "#ffec99";
const PURPLE = "#d0bfff";
const RED = "#ffc9c9";

const BOX = { width: 190, height: 80 } as const;

function box(id: string, text: string, x: number, y: number, backgroundColor: string): ElementSpec {
  return { id, type: "rectangle", text, x, y, ...BOX, backgroundColor, fillStyle: "solid" };
}

function arrow(id: string, from: string, to: string, text?: string, dashed = false): ElementSpec {
  return { id, type: "arrow", from, to, ...(text ? { text } : {}), ...(dashed ? { strokeStyle: "dashed" } : {}) };
}

/** Ids are unique on a board, so every turn adds its own suffix. */
function scoped(turn: string): (name: string) => string {
  const suffix = turn.replace(/[^a-z0-9]/gi, "").slice(-4);
  return (name) => `${name}-${suffix}`;
}

function threeTier(turn: string): OfflineScene {
  const id = scoped(turn);
  const elements: ElementSpec[] = [
    { id: id("client"), type: "rectangle", text: "Client / Browser", backgroundColor: BLUE },
    { id: id("api"), type: "rectangle", text: "Application Server Business Logic Tier", backgroundColor: GREEN },
    { id: id("store"), type: "rectangle", text: "Database Server (Data Tier)", backgroundColor: YELLOW },
    { id: id("cache"), type: "rectangle", text: "Cache", near: id("store") },
    { id: id("a1"), type: "arrow", from: id("client"), to: id("api"), text: "HTTP Request / Response" },
    { id: id("a2"), type: "arrow", from: id("api"), to: id("store"), text: "SQL Query / Result" },
  ];
  return {
    opening: "Let me look at the board first. ",
    steps: [
      { tool: "view_canvas", title: "Look at the board" },
      { say: "I drew a three tier flow with labelled arrows.", tool: "add_elements", title: "Draw 6 elements", elements },
      { tool: "focus", title: "Point at 3 elements", ids: [id("client"), id("api"), id("store")] },
    ],
    closing: "Client, application server and database, connected by bound labelled arrows.",
    steerable: [id("client"), id("api"), id("store")],
  };
}

function architecture(turn: string): OfflineScene {
  const id = scoped(turn);
  const column = [0, 420, 840] as const;
  // A labelled arrow needs clear space, so the rows sit 190 px apart.
  const row = [0, 270, 540, 810] as const;
  const clients = [
    box(id("web"), "Web app", 210, row[0], BLUE),
    box(id("mobile"), "Mobile app", 630, row[0], BLUE),
  ];
  const edge = [box(id("gateway"), "API gateway", column[1], row[1], PURPLE)];
  const services = [
    box(id("feed"), "Feed service", column[0], row[2], GREEN),
    box(id("upload"), "Upload service", column[1], row[2], GREEN),
    box(id("worker"), "Image worker", column[2], row[2], GREEN),
  ];
  const data = [
    box(id("db"), "Postgres", column[0], row[3], YELLOW),
    box(id("bucket"), "Object storage", column[1], row[3], YELLOW),
    box(id("cdn"), "CDN", column[2], row[3], YELLOW),
  ];
  return {
    opening: "The board is empty, so I will start from the clients and work down to the data. ",
    steps: [
      {
        tool: "add_elements",
        title: "Draw 3 elements",
        elements: [
          ...clients, ...edge,
          arrow(id("web-gateway"), id("web"), id("gateway"), "HTTPS"),
          arrow(id("mobile-gateway"), id("mobile"), id("gateway"), "HTTPS"),
        ],
      },
      {
        say: "Both clients go through one gateway. Three services sit behind it. ",
        tool: "add_elements",
        title: "Draw 3 elements",
        elements: [
          ...services,
          arrow(id("gateway-feed"), id("gateway"), id("feed"), "read feed"),
          arrow(id("gateway-upload"), id("gateway"), id("upload"), "new photo"),
          arrow(id("upload-worker"), id("upload"), id("worker"), "resize job", true),
        ],
      },
      {
        tool: "add_elements",
        title: "Draw 3 elements",
        elements: [
          ...data,
          arrow(id("feed-db"), id("feed"), id("db"), "posts"),
          arrow(id("upload-bucket"), id("upload"), id("bucket"), "original"),
        ],
      },
      {
        say: "The worker writes thumbnails back, and the CDN serves them. ",
        tool: "add_elements",
        title: "Draw 2 elements",
        elements: [
          arrow(id("worker-bucket"), id("worker"), id("bucket"), "thumbnails"),
          arrow(id("bucket-cdn"), id("bucket"), id("cdn"), "serves", true),
        ],
      },
      { say: "Let me check that no label is crowded. ", tool: "view_canvas", title: "Look at the board" },
      {
        tool: "update_elements",
        title: "Change 1 element",
        updates: [{ id: id("worker"), backgroundColor: RED }],
      },
      {
        tool: "focus",
        title: "Point at 9 elements",
        ids: [...clients, ...edge, ...services, ...data].map((element) => element.id!),
      },
    ],
    closing: "Blue is a client, purple is the edge, green is a service and yellow is data. The image worker is"
      + " red because it is the only part that runs off the request path: the upload service queues a resize job"
      + " (dashed arrow) and answers at once.",
    steerable: services.map((element) => element.id!),
  };
}

function attention(turn: string): OfflineScene {
  const id = scoped(turn);
  const column = [0, 420, 840] as const;
  const row = [70, 270, 470, 670] as const;
  return {
    opening: "I will draw scaled dot-product attention as a flow from the token embeddings to the output. ",
    steps: [
      {
        tool: "add_elements",
        title: "Draw 5 elements",
        elements: [
          { id: id("title"), type: "text", text: "Self-attention, one head", x: 0, y: 0, fontSize: 28 },
          box(id("tokens"), "Token embeddings X", column[1], row[0], BLUE),
          box(id("q"), "Query\nQ = X · Wq", column[0], row[1], YELLOW),
          box(id("k"), "Key\nK = X · Wk", column[1], row[1], YELLOW),
          box(id("v"), "Value\nV = X · Wv", column[2], row[1], YELLOW),
          arrow(id("tokens-q"), id("tokens"), id("q")),
          arrow(id("tokens-k"), id("tokens"), id("k")),
          arrow(id("tokens-v"), id("tokens"), id("v")),
        ],
      },
      {
        say: "Each token becomes three vectors: what it looks for, what it offers, and what it carries. ",
        tool: "add_elements",
        title: "Draw 2 elements",
        elements: [
          box(id("scores"), "Scores\nQ · Kᵀ / √d", 210, row[2], GREEN),
          box(id("softmax"), "Softmax\nrows sum to 1", 210, row[3], GREEN),
          arrow(id("q-scores"), id("q"), id("scores")),
          arrow(id("k-scores"), id("k"), id("scores")),
          arrow(id("scores-softmax"), id("scores"), id("softmax")),
        ],
      },
      {
        tool: "add_elements",
        title: "Draw 2 elements",
        elements: [
          box(id("mix"), "Weighted sum\nof values", column[2], row[2], PURPLE),
          box(id("out"), "Context vectors", column[2], row[3], BLUE),
          arrow(id("softmax-mix"), id("softmax"), id("mix"), "attention weights"),
          arrow(id("v-mix"), id("v"), id("mix")),
          arrow(id("mix-out"), id("mix"), id("out")),
        ],
      },
      { say: "Let me look at the result. ", tool: "view_canvas", title: "Look at the board" },
      {
        tool: "add_elements",
        title: "Draw 1 element",
        elements: [{
          id: id("note"),
          type: "text",
          text: "Every token scores every other token,\nthen borrows from them in that proportion.",
          x: 0,
          y: row[3] + 120,
          fontSize: 18,
          strokeColor: "#846358",
        }],
      },
      {
        tool: "focus",
        title: "Point at 9 elements",
        ids: ["title", "tokens", "q", "k", "v", "scores", "softmax", "mix", "out", "note"].map(id),
      },
    ],
    closing: "Yellow boxes are the three learned projections. Green is where attention is computed: the scores"
      + " say how well each query matches each key, and softmax turns a row of scores into weights. The purple"
      + " box mixes the values with those weights, so each output vector carries context from the whole sequence.",
    steerable: [id("q"), id("k"), id("v")],
  };
}

/** The prompt picks the scene, so a demonstration is repeatable. */
export function sceneFor(prompt: string, turn: string): OfflineScene {
  const asked = prompt.toLowerCase();
  if (/attention|transformer/.test(asked)) return attention(turn);
  if (/architecture|system/.test(asked)) return architecture(turn);
  return threeTier(turn);
}
