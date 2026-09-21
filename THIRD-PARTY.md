# Third-party notices

Easel is licensed under the [MIT License](LICENSE). Easel uses the third-party
software, fonts, and icons in this file. Each item keeps its own license.

Easel has no packaged release. `bun install` downloads each dependency from the
npm registry, and each package contains its own license text in
`node_modules/<package>/`.

## Direct dependencies

The licenses below come from the `package.json` and the license file of each
installed package.

| Package | Version | License | Use |
| --- | --- | --- | --- |
| [`@excalidraw/excalidraw`](https://github.com/excalidraw/excalidraw) | 0.18.1 | MIT | The canvas. Vite bundles it into the renderer. |
| [`react`](https://github.com/facebook/react) | 19.2.0 | MIT | The renderer. Bundled. |
| [`react-dom`](https://github.com/facebook/react) | 19.2.0 | MIT | The renderer. Bundled. |
| [`reins`](https://github.com/serhiitroinin/reins) | 0.2.0 | MIT | The agent runtime. The main process loads it. |
| [`electron`](https://github.com/electron/electron) | 43.4.1 | MIT | The application shell. |

### Electron, Chromium, and Node.js

Electron is licensed under the MIT License, Copyright (c) Electron contributors
and Copyright (c) 2013-2020 GitHub Inc. The Electron binary contains Chromium,
Node.js, and their dependencies. Their notices are in the installed package:

- `node_modules/electron/dist/LICENSE`
- `node_modules/electron/dist/LICENSES.chromium.html`

## Dependencies of Reins

| Package | Version | License |
| --- | --- | --- |
| [`@anthropic-ai/claude-agent-sdk`](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) | 0.3.257 | Proprietary. © Anthropic PBC. Use is subject to the [Anthropic legal agreements](https://code.claude.com/docs/en/legal-and-compliance). |
| [`@modelcontextprotocol/sdk`](https://github.com/modelcontextprotocol/typescript-sdk) | 1.30.0 | MIT |
| [`@agentclientprotocol/sdk`](https://github.com/agentclientprotocol/typescript-sdk) | 1.4.0 | Apache-2.0 |
| [`zod`](https://github.com/colinhacks/zod) | 4.6.5 | MIT |

The Claude Agent SDK is not open-source software. Easel does not contain a copy
of it. `bun install` downloads it from the npm registry as a dependency of
Reins.

## Transitive dependencies of the renderer bundle

Excalidraw brings in more packages, and Vite bundles the parts that Excalidraw
imports. These packages use the MIT, ISC, Apache-2.0, BSD-2-Clause,
BSD-3-Clause, or 0BSD license, with these exceptions:

| Package | Version | License |
| --- | --- | --- |
| [`dompurify`](https://github.com/cure53/DOMPurify) | 3.4.15 | MPL-2.0 OR Apache-2.0. Easel uses it under Apache-2.0. |
| [`fractional-indexing`](https://github.com/rocicorp/fractional-indexing) | 3.2.0 | CC0-1.0 |
| [`pako`](https://github.com/nodeca/pako) | 2.0.3 | MIT AND Zlib |
| [`robust-predicates`](https://github.com/mourner/robust-predicates) | 3.0.3 | Unlicense |
| [`khroma`](https://github.com/fabiospampinato/khroma) | 2.1.0 | MIT. The `package.json` has no license field. The license file is MIT. |

To list the license of each installed package, run this command:

```sh
bun pm ls --all
```

Then read `node_modules/<package>/package.json`.

## Fonts

`vite.config.ts` copies the Excalidraw font files from
`node_modules/@excalidraw/excalidraw/dist/prod/fonts` into the build. The
application loads them from local files. The Excalidraw package does not
contain the font license files. The table gives the license that the source of
each font states.

| Font | Author | License | Source |
| --- | --- | --- | --- |
| Excalifont | Excalidraw | OFL-1.1 | <https://plus.excalidraw.com/excalifont> |
| Virgil | Ellinor Rapp, for Excalidraw | OFL-1.1 | <https://github.com/excalidraw/virgil> |
| Xiaolai | lxgw | OFL-1.1 | <https://github.com/lxgw/kose-font> |
| Nunito | Vernon Adams, Cyreal, Jacques Le Bailly | OFL-1.1 | <https://github.com/googlefonts/nunito> |
| Lilita One | Juan Montoreano | OFL-1.1 | <https://github.com/google/fonts/tree/main/ofl/lilitaone> |
| Assistant | Ben Nathan | OFL-1.1 | <https://github.com/hafontia-zz/Assistant> |
| Cascadia Code | Microsoft Corporation | OFL-1.1 | <https://github.com/microsoft/cascadia-code> |
| Liberation Sans | Red Hat, Inc. and Google Corporation | OFL-1.1 | <https://github.com/liberationfonts/liberation-fonts> |
| Comic Shanns | Shannon Miwa | MIT | <https://github.com/shannpersand/comic-shanns> |

The SIL Open Font License 1.1 (OFL-1.1) text is at <https://openfontlicense.org>.

The interface text uses the system font. Easel bundles no other font.

## Icons

The interface icons in `src/renderer/icons.tsx` are adapted from
[Lucide](https://lucide.dev). Lucide is licensed under the ISC License.
Portions of Lucide come from Feather, which is licensed under the MIT License,
Copyright (c) 2013-2022 Cole Bemis. The file header contains the full notice.

The toolbar icons on the canvas are part of Excalidraw.

## Brand

The Easel logo and the application icon in `docs/brand/` and `resources/` are
Copyright (c) 2026 Serhii Troinin. The wordmark uses outlines of
[Inter](https://github.com/rsms/inter) by Rasmus Andersson, which is licensed
under OFL-1.1. The files contain no font data.
