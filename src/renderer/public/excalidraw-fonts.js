// This classic script runs before the bundled modules.
//
// 1. Excalidraw loads its fonts from this path. Without it, Excalidraw loads
//    them from a public CDN.
window.EXCALIDRAW_ASSET_PATH = new URL("./", document.baseURI).href;

// 2. Excalidraw also adds a CDN address to each font face as a second source.
//    Chromium checks each source against the Content Security Policy when the
//    face is made, and logs an error for the CDN address. The local source is
//    sufficient, so the remote sources are removed.
(() => {
  const NativeFontFace = window.FontFace;
  function LocalFontFace(family, source, descriptors) {
    const local = typeof source === "string"
      ? source.split(/,\s*(?=url\()/).filter((entry) => !/^url\(["']?https?:/.test(entry)).join(", ")
      : source;
    return new NativeFontFace(family, local || source, descriptors);
  }
  LocalFontFace.prototype = NativeFontFace.prototype;
  window.FontFace = LocalFontFace;
})();
