// The pdfjs-dist type declarations reference a DOM type that's newer than
// the TypeScript DOM library we build with. Remove this once TypeScript's
// lib.dom.d.ts declares it.
type ImageDataArray = Uint8ClampedArray
