// news-image-20261125: THE WORLD front page for Wednesday 25 November 2026.
//
// Copies the broadsheet image stored beside this file (entry.png) to
// /output/entry.png. Node 22, standard library only. No network access,
// no randomness, no clock reads: identical input bytes always yield
// identical output bytes, so repeated runs agree byte for byte.
//
// Local check (outside the grader container), where MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const PNG_IEND = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);
const EXPECTED_WIDTH = 1024;
const EXPECTED_HEIGHT = 1024;
const MAX_BYTES = 1024 * 1024;

function abort(reason) {
  process.stderr.write("main.ts: " + reason + "\n");
  process.exit(1);
}

// Returns null when the buffer is a complete PNG of the expected size,
// otherwise a short description of what is wrong with it.
function pngProblem(bytes, label) {
  if (bytes.length < PNG_SIGNATURE.length + PNG_IEND.length + 25) {
    return label + " is too short to be a PNG (" + bytes.length + " bytes)";
  }
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return label + " does not start with the PNG signature";
  }
  if (!bytes.subarray(bytes.length - 12).equals(PNG_IEND)) {
    return label + " does not end with the IEND trailer";
  }
  // IHDR chunk: 8-byte signature, 4-byte length (always 13), 4-byte
  // "IHDR", then width and height as big-endian uint32.
  if (bytes.readUInt32BE(8) !== 13) {
    return label + " has an IHDR chunk of unexpected length";
  }
  if (bytes.subarray(12, 16).toString("latin1") !== "IHDR") {
    return label + " has no IHDR chunk where one is expected";
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== EXPECTED_WIDTH || height !== EXPECTED_HEIGHT) {
    return (
      label + " is " + width + "x" + height + ", expected " +
      EXPECTED_WIDTH + "x" + EXPECTED_HEIGHT
    );
  }
  if (bytes.length > MAX_BYTES) {
    return label + " is " + bytes.length + " bytes, over the 1 MiB limit";
  }
  return null;
}

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, "entry.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const destPath = join(outDir, "entry.png");

if (!existsSync(sourcePath)) {
  abort("entry.png is missing next to main.ts (" + sourcePath + ")");
}

let source;
try {
  source = readFileSync(sourcePath);
} catch (err) {
  abort("cannot read " + sourcePath + ": " + err.message);
}

const sourceProblem = pngProblem(source, "entry.png");
if (sourceProblem !== null) {
  abort(sourceProblem);
}

try {
  mkdirSync(outDir, { recursive: true });
} catch (err) {
  abort("cannot create " + outDir + ": " + err.message);
}

try {
  writeFileSync(destPath, source);
} catch (err) {
  abort("cannot write " + destPath + ": " + err.message);
}

let copied;
try {
  copied = readFileSync(destPath);
} catch (err) {
  abort("cannot read back " + destPath + ": " + err.message);
}

const copyProblem = pngProblem(copied, "copied entry.png");
if (copyProblem !== null) {
  abort(copyProblem);
}
if (copied.length !== source.length) {
  abort(
    "copy size changed: source " + source.length + " bytes, copy " +
    copied.length + " bytes",
  );
}

const sourceHash = createHash("sha256").update(source).digest("hex");
const copiedHash = createHash("sha256").update(copied).digest("hex");
if (sourceHash !== copiedHash) {
  abort(
    "copy bytes differ: source sha256 " + sourceHash + ", copy sha256 " +
    copiedHash,
  );
}

process.stdout.write(
  "wrote " + destPath + " (" + copied.length + " bytes, " +
  EXPECTED_WIDTH + "x" + EXPECTED_HEIGHT + " PNG, sha256 " + copiedHash + ")\n",
);
