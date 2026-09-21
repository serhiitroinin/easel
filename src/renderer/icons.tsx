import type { SVGProps } from "react";

/*
 * The icon shapes in this file are adapted from Lucide (https://lucide.dev),
 * redrawn on a 16 px grid with a 1.5 px stroke.
 *
 * Lucide is licensed under the ISC License.
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part
 * of Feather (MIT). All other copyright (c) for Lucide are held by Lucide
 * Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
 * REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
 * AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
 * INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
 * LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
 * OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
 * PERFORMANCE OF THIS SOFTWARE.
 */

/** One family, 1.5 px stroke, 16 px. */
function Glyph({ children, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ChevronDown = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M4 6.5 8 10.5 12 6.5" /></Glyph>
);

export const PanelRight = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><rect x="2" y="2.75" width="12" height="10.5" rx="2" /><path d="M10 2.75v10.5" /></Glyph>
);

export const Eye = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="1.75" /></Glyph>
);

export const ArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M8 13V3.5" /><path d="M3.75 7.75 8 3.5l4.25 4.25" /></Glyph>
);

export const Stop = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><rect x="4.25" y="4.25" width="7.5" height="7.5" rx="1.5" /></Glyph>
);

export const Check = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M3.5 8.5 6.5 11.5 12.5 4.5" /></Glyph>
);

export const Cross = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" /></Glyph>
);

export const Diamond = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M8 2.5 13.5 8 8 13.5 2.5 8Z" /></Glyph>
);

export const Return = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M13 3.5v4a2 2 0 0 1-2 2H3.5" /><path d="M6 7 3.5 9.5 6 12" /></Glyph>
);

export const Plus = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M8 3.5v9M3.5 8h9" /></Glyph>
);

export const Trash = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M2.75 4.25h10.5" /><path d="M6.25 4.25V3a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 .75.75v1.25" /><path d="M4.25 4.25 4.9 13a.75.75 0 0 0 .75.75h4.7a.75.75 0 0 0 .75-.75l.65-8.75" /></Glyph>
);

export const ChevronRight = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M6.5 4 10.5 8 6.5 12" /></Glyph>
);

export const PanelLeft = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><rect x="2" y="2.75" width="12" height="10.5" rx="2" /><path d="M6 2.75v10.5" /></Glyph>
);

export const Pencil = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M10.75 2.75 13.25 5.25 5.5 13 2.5 13.5 3 10.5Z" /><path d="M9 4.5 11.5 7" /></Glyph>
);

/** Read the board: the scene as rows of data. */
export const Rows = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M5.75 4h7.75M5.75 8h7.75M5.75 12h7.75" /><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01" /></Glyph>
);

/** Draw: a new shape arriving on the sheet. */
export const ShapePlus = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M13.25 8.5v3a1.75 1.75 0 0 1-1.75 1.75h-7A1.75 1.75 0 0 1 2.75 11.5v-7A1.75 1.75 0 0 1 4.5 2.75h3" /><path d="M11.5 2v5M9 4.5h5" /></Glyph>
);

/** Arrange: shapes set against a common edge. */
export const Align = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M2.75 2.5v11" /><rect x="5.25" y="3.75" width="8" height="3" rx="1" /><rect x="5.25" y="9.25" width="5" height="3" rx="1" /></Glyph>
);

/** Focus: the view pointed at something. */
export const Target = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><circle cx="8" cy="8" r="4.25" /><path d="M8 1.75v2.5M8 11.75v2.5M1.75 8h2.5M11.75 8h2.5" /></Glyph>
);

export const Wrench = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M10.2 2.6a3.4 3.4 0 0 0-3.9 4.6l-4 4a1.4 1.4 0 0 0 2 2l4-4a3.4 3.4 0 0 0 4.6-3.9l-2.1 2.1-1.9-.5-.5-1.9Z" /></Glyph>
);

export const Ban = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><circle cx="8" cy="8" r="5.5" /><path d="M4.1 4.1 11.9 11.9" /></Glyph>
);

export const Gauge = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M2.9 12a5.75 5.75 0 1 1 10.2 0" /><path d="M8 9.25 10.75 6" /><circle cx="8" cy="9.5" r=".6" /></Glyph>
);

export const Zap = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M8.75 1.75 3.25 9.25H8L7.25 14.25 12.75 6.75H8Z" /></Glyph>
);

export const Sliders = (props: SVGProps<SVGSVGElement>) => (
  <Glyph {...props}><path d="M2.5 5h5.25M11.25 5h2.25M2.5 11h2.25M8.25 11h5.25" /><circle cx="9.5" cy="5" r="1.75" /><circle cx="6.5" cy="11" r="1.75" /></Glyph>
);
