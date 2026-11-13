// Self-host the zxing .wasm so the scanner never loads it from cdn.jsdelivr.net. Idempotent.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";

const src = "node_modules/zxing-wasm/dist/reader/zxing_reader.wasm";
if (!existsSync(src)) throw new Error(`Missing ${src}; run npm install first`);
mkdirSync("public/zxing", { recursive: true });
copyFileSync(src, "public/zxing/zxing_reader.wasm");
