/* ==========================================================================
   Cozy Stitches — content file plumbing
   --------------------------------------------------------------------------
   js/content.json is the source of truth. js/content.js is generated from it,
   and exists only because the site loads it as a plain <script> so that the
   pages still work when opened by double-clicking a file.

   Everything here works off paths that can be redirected by environment
   variables, so the test suite can run the whole admin against a temp copy
   instead of the real project:

     ADMIN_ROOT      project root          (default: three levels up)
     ADMIN_CONTENT   the content.json path (default: <root>/js/content.json)
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const ROOT = process.env.ADMIN_ROOT
  ? path.resolve(process.env.ADMIN_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export const CONTENT_JSON = process.env.ADMIN_CONTENT
  ? path.resolve(process.env.ADMIN_CONTENT)
  : path.join(ROOT, "js", "content.json");

export const CONTENT_JS = process.env.ADMIN_CONTENT
  ? path.resolve(process.env.ADMIN_CONTENT).replace(/\.json$/, ".js")
  : path.join(ROOT, "js", "content.js");

export const IMAGE_DIRS = {
  products: path.join(ROOT, "assets", "img", "products"),
  hero: path.join(ROOT, "assets", "img", "hero")
};

export const BACKUP_DIR = path.join(ROOT, "tools", "admin", "backups");
export const BACKUP_KEEP = 20;

const GENERATED_MARK = "GENERATED FILE — DO NOT EDIT";

export const BANNER = `/* ==========================================================================
   Cozy Stitches — site content (${GENERATED_MARK})
   --------------------------------------------------------------------------
   This file is written by tools/build-content.mjs out of js/content.json.
   Any edit made here is overwritten the next time you save in the admin panel
   or run \`npm run build\`.

   To change anything, run the admin panel:

       npm run admin

   and edit js/content.json directly if you prefer — but the admin is easier
   and it checks your work before saving.
   ========================================================================== */

`;

/* --------------------------------------------------------------------------
   Reading
   -------------------------------------------------------------------------- */

/* Loads a hand-written or generated content.js in a sandbox and returns the
   window.COZY object. Uses node:vm rather than a regex or an eval shim, so a
   syntax error is reported with a file and a line number. */
export function loadFromJsSource(source, filename = "content.js") {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename, timeout: 5000 });
  if (!sandbox.window.COZY) {
    throw new Error(filename + " did not set window.COZY");
  }
  return sandbox.window.COZY;
}

export function isGenerated(source) {
  return source.includes(GENERATED_MARK);
}

const DEFAULT_TEMPLATE =
  'Hi Cozy Stitches! I\'d like to order "{name}" (ref {code}). Is it available?';

/* The old hand-written content.js held the order message as a function. Calling
   it with the tokens as sample values recovers the template exactly, rather
   than guessing at what the wording used to be. */
function templateFromFunction(fn) {
  try {
    const sample = fn({ name: "{name}", code: "{code}" });
    if (typeof sample === "string" && sample.includes("{name}")) return sample;
  } catch (error) {
    /* fall through to the default */
  }
  return DEFAULT_TEMPLATE;
}

/* Brings the one legacy file shape forward to the current one. Idempotent, so
   it is safe to run over already-migrated data. */
export function migrateLegacy(data) {
  const order = data.order || {};
  const template = typeof order.message === "function"
    ? templateFromFunction(order.message)
    : order.messageTemplate;

  /* JSON.stringify drops function values, which is exactly what we want for
     everything except the message, which has been captured above. */
  const out = JSON.parse(JSON.stringify(data));

  out.order = out.order || {};
  out.order.messageTemplate = template || DEFAULT_TEMPLATE;
  delete out.order.message;
  if (!out.order.genericMessage) {
    out.order.genericMessage = "Hi Cozy Stitches! I'd like to ask about ordering.";
  }

  out.home = out.home || {};
  if (out.home.heroPhoto === "") out.home.heroPhoto = null;

  if (!Array.isArray(out.products)) out.products = [];
  out.products.forEach((product) => {
    if (!Array.isArray(product.images)) product.images = [];
    /* Older entries could be bare path strings. */
    product.images = product.images.map((image) => (
      typeof image === "string" ? legacyImage(image) : image
    ));
  });

  return out;
}

function legacyImage(src) {
  const match = /-(\d+)\.(webp|jpe?g|png)$/i.exec(src);
  return {
    src,
    srcset: "",
    width: match ? Number(match[1]) : 1200,
    height: 800
  };
}

/* Returns { data, mtime } from content.json, falling back to importing a
   hand-written content.js the first time this runs. */
export function readContent() {
  if (fs.existsSync(CONTENT_JSON)) {
    const raw = fs.readFileSync(CONTENT_JSON, "utf8");
    const stat = fs.statSync(CONTENT_JSON);
    return { data: JSON.parse(raw), mtime: stat.mtimeMs };
  }

  if (fs.existsSync(CONTENT_JS)) {
    const source = fs.readFileSync(CONTENT_JS, "utf8");
    if (!isGenerated(source)) {
      const data = migrateLegacy(loadFromJsSource(source, CONTENT_JS));
      return { data, mtime: 0, importedFrom: CONTENT_JS };
    }
  }

  throw new Error(
    "No content found. Expected " + CONTENT_JSON +
    (fs.existsSync(CONTENT_JS) ? " (or a readable " + CONTENT_JS + ")" : "")
  );
}

/* --------------------------------------------------------------------------
   Writing
   -------------------------------------------------------------------------- */

/* Writes to a sibling temp file and renames it over the target, so an
   interrupted save can never leave a half-written content file behind. */
export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + ".tmp-" + process.pid;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

export function serializeContentJs(data) {
  return BANNER + "window.COZY = " + JSON.stringify(data, null, 2) + ";\n";
}

/* Saves the data, then regenerates the file the browser actually loads.
   Returns the new mtime so the caller can hand it back to the editor. */
export function writeContent(data) {
  writeAtomic(CONTENT_JSON, JSON.stringify(data, null, 2) + "\n");
  writeAtomic(CONTENT_JS, serializeContentJs(data));
  return fs.statSync(CONTENT_JSON).mtimeMs;
}

/* --------------------------------------------------------------------------
   Snapshots
   -------------------------------------------------------------------------- */

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/* Git holds committed states; this holds edits that were saved but never
   published, which is when an undo matters most. */
export function snapshot(data) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  writeAtomic(path.join(BACKUP_DIR, "content-" + stamp() + ".json"),
    JSON.stringify(data, null, 2) + "\n");

  const files = listSnapshots();
  files.slice(BACKUP_KEEP).forEach((entry) => {
    fs.rmSync(path.join(BACKUP_DIR, entry.name), { force: true });
  });
}

export function listSnapshots() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((name) => /^content-.*\.json$/.test(name))
    .map((name) => ({
      name,
      savedAt: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
      size: fs.statSync(path.join(BACKUP_DIR, name)).size
    }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export function readSnapshot(name) {
  if (!/^content-[A-Za-z0-9._-]+\.json$/.test(name)) {
    throw new Error("Bad snapshot name");
  }
  const file = path.join(BACKUP_DIR, name);
  if (!fs.existsSync(file)) throw new Error("No such snapshot");
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
