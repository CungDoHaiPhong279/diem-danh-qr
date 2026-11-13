// Self-host the zxing .wasm so the scanner never loads it from cdn.jsdelivr.net. Idempotent.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const src = createRequire(import.meta.url).resolve("zxing-wasm/reader/zxing_reader.wasm");
mkdirSync("public/zxing", { recursive: true });
copyFileSync(src, "public/zxing/zxing_reader.wasm");
