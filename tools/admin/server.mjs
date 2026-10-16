#!/usr/bin/env node
/* ==========================================================================
   Cozy Stitches — the admin panel server
   --------------------------------------------------------------------------
       npm run admin

   Serves two things from one address: the site itself, so you can see your
   edits, and the editor at /admin/.

   This is a local tool. It binds to 127.0.0.1 only, so nothing outside this
   computer can reach it, and every /api/ call must carry a session token that
   is generated fresh each time it starts. That second part matters: a server
   on localhost is reachable by any website you happen to have open, and
   without a token a page could quietly rewrite your catalog.

   Environment overrides, used by the test suite:
     ADMIN_ROOT      project root
     ADMIN_CONTENT   content.json path
     ADMIN_PORT      port (default 4321)
     ADMIN_TOKEN     fixed token instead of a random one
   ========================================================================== */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { ROOT, readContent, writeContent, snapshot, listSnapshots, readSnapshot }
  from "./lib/content.mjs";
import { validate, normalize } from "./lib/validate.mjs";
import { saveImage, deleteImage, ImageError } from "./lib/images.mjs";
import { doctor, setup, publish } from "./lib/git.mjs";
import { schema, tabs } from "./schema.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || process.env.PORT || 4321);
const TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(16).toString("hex");
const PUBLIC_DIR = path.join(ROOT, "tools", "admin", "public");
const MAX_BODY = 12 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".webmanifest": "application/manifest+json"
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, status, text) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function readBody(req, limit = MAX_BODY) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "That upload is larger than 12 MB."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch (error) {
    throw new HttpError(400, "That request was not valid JSON.");
  }
}

/* --------------------------------------------------------------------------
   Static files
   -------------------------------------------------------------------------- */

function resolveStatic(urlPath) {
  let root = ROOT;
  let relative = decodeURIComponent(urlPath);

  if (relative === "/admin" || relative === "/admin/") relative = "/admin/index.html";
  if (relative.startsWith("/admin/")) {
    root = PUBLIC_DIR;
    relative = relative.slice("/admin".length);
  } else if (relative === "/") {
    relative = "/index.html";
  }

  const clean = relative.replace(/^\/+/, "");
  if (!clean) throw new HttpError(404, "Not found");

  const absolute = path.resolve(root, clean);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) {
    throw new HttpError(403, "Not allowed");
  }
  /* The editor and the build tools are not part of the published site. Compared
     with forward slashes, because this comes from a URL and path.sep is a
     backslash on Windows. */
  if (root === ROOT && (clean === "tools" || clean.startsWith("tools/"))) {
    throw new HttpError(404, "Not found");
  }
  return absolute;
}

function serveStatic(req, res, urlPath) {
  let file;
  try {
    file = resolveStatic(urlPath);
  } catch (error) {
    return sendText(res, error.status || 404, error.message || "Not found");
  }

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return sendText(res, 404, "Not found");
  }

  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  fs.createReadStream(file).pipe(res);
}

/* --------------------------------------------------------------------------
   API
   -------------------------------------------------------------------------- */

function requireToken(req) {
  const origin = req.headers.origin;
  if (origin) {
    const allowed = ["http://" + HOST + ":" + PORT, "http://localhost:" + PORT];
    if (!allowed.includes(origin)) {
      throw new HttpError(403, "That request came from somewhere else.");
    }
  }
  if (req.headers["x-admin-token"] !== TOKEN) {
    throw new HttpError(401, "This editor session has expired. Reload the page.");
  }
}

function currentContent() {
  const { data, mtime } = readContent();
  return { data, mtime };
}

async function handleApi(req, res, url) {
  requireToken(req);
  const route = url.pathname.replace(/^\/api/, "");
  const method = req.method.toUpperCase();

  /* ---- the schema ----
     Served from here rather than as a static file so there is exactly one copy
     of the field definitions, shared by the validator and the editor, and so
     it is never part of the published site. */
  if (route === "/schema" && method === "GET") {
    return sendJson(res, 200, { tabs, schema });
  }

  /* ---- read ---- */
  if (route === "/content" && method === "GET") {
    const { data, mtime } = currentContent();
    return sendJson(res, 200, { data, mtime });
  }

  /* ---- save ---- */
  if (route === "/content" && method === "POST") {
    const body = await readJson(req);
    if (!body || typeof body.data !== "object" || body.data === null) {
      throw new HttpError(400, "No content was sent.");
    }

    const { data: stored, mtime } = currentContent();
    if (typeof body.mtime === "number" && Math.abs(body.mtime - mtime) > 0.5) {
      return sendJson(res, 409, {
        error: "stale",
        message: "content.json changed on disk since this page was opened. " +
                 "Reload before saving, or your change would overwrite it.",
        mtime
      });
    }

    const next = normalize(body.data);
    const errors = validate(next);
    if (errors.length) {
      return sendJson(res, 400, { error: "invalid", errors });
    }

    snapshot(stored);
    const newMtime = writeContent(next);
    return sendJson(res, 200, { ok: true, mtime: newMtime });
  }

  /* ---- upload one already-optimised image ---- */
  if (route === "/upload" && method === "POST") {
    const dir = url.searchParams.get("dir") || "products";
    const name = url.searchParams.get("name") || "";
    const bytes = await readBody(req);
    const saved = saveImage(dir, name, bytes);
    return sendJson(res, 200, saved);
  }

  /* ---- remove an image ---- */
  if (route === "/delete-image" && method === "POST") {
    const body = await readJson(req);
    if (!body.src) throw new HttpError(400, "No image was named.");
    return sendJson(res, 200, deleteImage(body.src));
  }

  /* ---- backups ---- */
  if (route === "/backups" && method === "GET") {
    return sendJson(res, 200, { backups: listSnapshots() });
  }

  if (route === "/restore" && method === "POST") {
    const body = await readJson(req);
    const restored = normalize(readSnapshot(String(body.name || "")));
    const errors = validate(restored);
    if (errors.length) {
      return sendJson(res, 400, { error: "invalid", errors });
    }
    const { data: stored } = currentContent();
    snapshot(stored);
    const mtime = writeContent(restored);
    return sendJson(res, 200, { ok: true, data: restored, mtime });
  }

  /* ---- publishing ---- */
  if (route === "/doctor" && method === "GET") {
    return sendJson(res, 200, doctor());
  }

  if (route === "/git-setup" && method === "POST") {
    const body = await readJson(req);
    return sendJson(res, 200, setup(body));
  }

  if (route === "/publish" && method === "POST") {
    const { data } = currentContent();
    const errors = validate(data);
    if (errors.length) {
      return sendJson(res, 400, {
        error: "invalid",
        errors,
        message: "The content on disk does not pass its checks, so it was not published."
      });
    }
    return sendJson(res, 200, publish(data));
  }

  throw new HttpError(404, "No such endpoint");
}

/* --------------------------------------------------------------------------
   Server
   -------------------------------------------------------------------------- */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://" + HOST + ":" + PORT);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url).catch((error) => {
      const status = error instanceof HttpError ? error.status
        : error instanceof ImageError ? 400
        : 500;
      if (status === 500) console.error(error);
      sendJson(res, status, { error: error.message || "Something went wrong." });
    });
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendText(res, 405, "Method not allowed");
  }
  serveStatic(req, res, url.pathname);
});

/* Opens the editor in whatever browser is the default, so nobody has to copy a
   long token out of a terminal window by hand. Best effort: if it does not
   work, the link is printed and that is the real instructions. Suppressed by
   ADMIN_NO_OPEN, which is what the test suite sets. */
function openBrowser(url) {
  const command = process.platform === "win32" ? "cmd"
    : process.platform === "darwin" ? "open"
    : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
  } catch (error) {
    /* Not worth reporting: the printed link works regardless. */
  }
}

server.listen(PORT, HOST, () => {
  const base = "http://" + HOST + ":" + PORT;
  const editor = base + "/admin/?token=" + TOKEN;
  /* Plain ASCII on purpose. Box-drawing characters look like corruption in a
     Windows console whose codepage is not UTF-8, and the first thing anyone
     sees of this tool should not look broken. */
  const line = "=".repeat(64);

  console.log("\n" + line);
  console.log("  Cozy Stitches admin");
  console.log(line);
  console.log("");
  console.log("  Your browser should be opening the editor now.");
  console.log("  If it does not, copy this whole line into your browser:");
  console.log("");
  console.log("  " + editor);
  console.log("");
  console.log("  To see the site itself:  " + base + "/");
  console.log("");
  console.log("  Leave this window OPEN while you work. Closing it only stops");
  console.log("  the editor - your live website keeps running on its own.");
  console.log("  Never share the editor link: the long token on the end is the");
  console.log("  only thing stopping other pages from changing your site.");
  console.log("\n" + line + "\n");

  if (!process.env.ADMIN_NO_OPEN) openBrowser(editor);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error("\nPort " + PORT + " is already in use.");
    console.error("Something else may already be running the admin panel.");
    console.error("Close it, or start this one on another port:\n");
    console.error("  ADMIN_PORT=4322 npm run admin\n");
    process.exit(1);
  }
  throw error;
});
