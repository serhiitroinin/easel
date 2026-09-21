export interface RouteBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Route {
  x: number;
  y: number;
  points: [number, number][];
  width: number;
  height: number;
  midX: number;
  midY: number;
}

/** The gap Excalidraw leaves between a bound arrow and the shape it touches. */
export const BINDING_GAP = 6;

const centre = (box: RouteBox) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

/** Where the centre-to-centre line leaves a box, plus the binding gap. */
function exit(box: RouteBox, towards: { x: number; y: number }, gap: number): { x: number; y: number } {
  const from = centre(box);
  const dx = towards.x - from.x;
  const dy = towards.y - from.y;
  if (dx === 0 && dy === 0) return from;
  const scale = Math.min(
    dx === 0 ? Infinity : (box.width / 2 + gap) / Math.abs(dx),
    dy === 0 ? Infinity : (box.height / 2 + gap) / Math.abs(dy),
  );
  return { x: from.x + dx * Math.min(scale, 1), y: from.y + dy * Math.min(scale, 1) };
}

/**
 * A bound arrow is never trusted to the model or to a stale scene: its whole
 * geometry is computed from the two shapes it connects. Excalidraw breaks the
 * shaft around a label by itself, so the shaft must span the whole gap.
 */
export function routeArrow(from: RouteBox, to: RouteBox, gap = BINDING_GAP): Route {
  const start = exit(from, centre(to), gap);
  const end = exit(to, centre(from), gap);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    x: start.x,
    y: start.y,
    points: [[0, 0], [dx, dy]],
    width: Math.abs(dx),
    height: Math.abs(dy),
    midX: start.x + dx / 2,
    midY: start.y + dy / 2,
  };
}

export function routeLength(route: Route): number {
  return Math.hypot(route.width, route.height);
}
