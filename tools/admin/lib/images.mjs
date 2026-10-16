/* ==========================================================================
   Cozy Stitches — image files
   --------------------------------------------------------------------------
   The browser does the resizing and format conversion (using its own encoders,
   which is why this project needs no image library). The server only has to
   put the bytes somewhere safe and be strict about where "somewhere" is.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { ROOT, IMAGE_DIRS } from "./content.mjs";

const NAME_RE = /^[a-z0-9][a-z0-9-]*\.(webp|jpg|jpeg|png)$/;
const VARIANT_RE = /^(.*)-(\d{2,5})\.(webp|jpg|jpeg|png)$/i;

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class ImageError extends Error {}

export function imageDir(which) {
  const dir = IMAGE_DIRS[which];
  if (!dir) throw new ImageError("Unknown image folder: " + which);
  return dir;
}

export function sanitizeName(name) {
  const raw = String(name || "");
  /* Refused outright rather than quietly reduced to a basename: this name
     comes from the client and is the only thing between a request and the
     filesystem, so anything folder-shaped should fail loudly. */
  if (raw.includes("/") || raw.includes("\\") || raw.includes("..")) {
    throw new ImageError("Image names cannot contain folders.");
  }
  const base = raw.toLowerCase();
  if (!NAME_RE.test(base)) {
    throw new ImageError(
      "Image names may only use lower-case letters, numbers and dashes, " +
      "and must end in .webp, .jpg or .png"
    );
  }
  return base;
}

/* Resolves a client-supplied path and refuses anything that is not a real file
   inside one of the allowed image folders. */
export function resolveImageFile(relative) {
  if (typeof relative !== "string" || !relative) {
    throw new ImageError("No image given");
  }
  if (relative.includes("..") || path.isAbsolute(relative)) {
    throw new ImageError("That path is not allowed");
  }

  const absolute = path.resolve(ROOT, relative);
  const allowed = Object.values(IMAGE_DIRS).map((dir) => path.resolve(dir));
  if (!allowed.some((dir) => absolute === dir || absolute.startsWith(dir + path.sep))) {
    throw new ImageError("That file is not in an image folder");
  }
  return absolute;
}

export function saveImage(which, name, buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ImageError("The upload was empty");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ImageError("That image is larger than 8 MB — resize it and try again");
  }

  const dir = imageDir(which);
  const file = path.join(dir, sanitizeName(name));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, buffer);

  return {
    src: path.relative(ROOT, file).split(path.sep).join("/"),
    bytes: buffer.length
  };
}

/* Removes an image and every size variant of it, so deleting a photograph from
   the panel does not leave orphans on disk that the next deploy still uploads. */
export function deleteImage(relative) {
  const file = resolveImageFile(relative);
  const dir = path.dirname(file);
  const stem = path.basename(file);

  const removed = [];
  const match = VARIANT_RE.exec(stem);

  const candidates = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => {
        if (name === stem) return true;
        if (!match) return false;
        const other = VARIANT_RE.exec(name);
        if (!other) return false;
        return other[1] === match[1] && other[3].toLowerCase() === match[3].toLowerCase();
      })
    : [];

  candidates.forEach((name) => {
    const target = resolveImageFile(path.relative(ROOT, path.join(dir, name)).split(path.sep).join("/"));
    fs.rmSync(target, { force: true });
    removed.push(name);
  });

  return { removed };
}

/* NOTE ON RENAMING
   Uploaded files are named after the product's link name at the moment of
   upload, and deliberately are NOT renamed if that link name changes later.
   The content file stores full paths, so a mismatch is harmless, and renaming
   would mean moving files before validation had a chance to reject a save --
   a save that failed after the move would leave the disk and the data file
   disagreeing about where a photograph lives. Tidiness is not worth that. */
