/* ==========================================================================
   Cozy Stitches — content validation
   --------------------------------------------------------------------------
   Walks the schema, not the data, so a field can never be added to the editor
   without also gaining a rule here. Every path in an error is written the way
   you would address it in the JSON, for example: products[3].code
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./content.mjs";
import { schema } from "../schema.mjs";

/* --------------------------------------------------------------------------
   Tidying up before checking. Being strict about what the owner types is not
   useful; a pasted Instagram link or a number written with spaces should just
   work.
   -------------------------------------------------------------------------- */

export function normalize(data) {
  const out = JSON.parse(JSON.stringify(data));

  const channels = out.channels || {};
  if (typeof channels.instagram === "string") {
    channels.instagram = channels.instagram
      .trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@+/, "")
      .replace(/\/+$/, "");
  }
  if (typeof channels.messenger === "string") {
    channels.messenger = channels.messenger
      .trim()
      .replace(/^https?:\/\/(www\.)?(m\.me|facebook\.com|fb\.com)\//i, "")
      .replace(/^@+/, "")
      .replace(/[/?].*$/, "");
  }
  if (typeof channels.whatsapp === "string") {
    channels.whatsapp = channels.whatsapp.replace(/[^\d]/g, "");
  }
  (out.products || []).forEach((product) => {
    if (typeof product.price === "string") {
      const digits = product.price.replace(/[^\d.]/g, "");
      product.price = digits === "" ? null : Number(digits);
    }
    if (typeof product.slug === "string") product.slug = slugify(product.slug);
  });
  (out.categories || []).forEach((category) => {
    if (typeof category.id === "string") category.id = slugify(category.id);
  });

  return out;
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* --------------------------------------------------------------------------
   Checking
   -------------------------------------------------------------------------- */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const OK_FILE_RE = /\.(webp|jpe?g|png)$/i;

export function validate(data, options = {}) {
  const checkImages = options.checkImages !== false;
  const errors = [];
  const seen = { slug: new Map(), code: new Map() };

  const root = data && typeof data === "object" && !Array.isArray(data) ? data : {};

  Object.keys(schema).forEach((key) => {
    const section = schema[key];
    /* Paths must read exactly as the field is addressed in the JSON, because
       the editor looks up an error by the same string it puts on the control. */
    if (section.type === "objectList") {
      validateObjectList(key, section, root[key], root, errors, seen, checkImages);
    } else {
      walkFields(key, section.fields, root[key], root, errors, seen, checkImages);
    }
  });

  return errors;
}

function walkFields(prefix, fields, value, root, errors, seen, checkImages) {
  const container = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  Object.keys(fields).forEach((key) => {
    const field = fields[key];
    const at = prefix + "." + key;
    const raw = container[key];

    switch (field.type) {
      case "group":
        walkFields(at, field.fields, raw, root, errors, seen, checkImages);
        break;

      case "objectList":
        validateObjectList(at, field, raw, root, errors, seen, checkImages);
        break;

      case "image":
        if (raw) checkImage(at, raw, errors, checkImages);
        break;

      case "imageList":
        if (!Array.isArray(raw)) {
          errors.push(err(at, "expected a list of photographs"));
        } else {
          raw.forEach((image, index) => checkImage(at + "[" + index + "]", image, errors, checkImages));
        }
        break;

      case "paragraphs":
        if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
          errors.push(err(at, "expected a list of paragraphs"));
        }
        break;

      case "stringList":
        checkStringList(at, field, raw, errors);
        break;

      case "boolean":
        if (typeof raw !== "boolean") errors.push(err(at, "expected true or false"));
        break;

      case "number":
      case "price":
        if (raw !== null && raw !== undefined) {
          if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
            errors.push(err(at, "expected a number of 0 or more, or leave it empty"));
          }
        }
        break;

      case "select":
        checkSelect(at, field, raw, root, errors);
        break;

      case "slug":
        checkSlug(at, field, raw, errors, seen);
        break;

      case "code":
        checkUniqueText(at, field, raw, errors, seen.code, "reference code");
        break;

      case "channel":
        checkChannel(at, raw, errors);
        break;

      default:
        checkText(at, field, raw, errors);
    }
  });
}

function validateObjectList(prefix, section, value, root, errors, seen, checkImages) {
  if (value === undefined) {
    if (section.required) errors.push(err(prefix, "is required"));
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(err(prefix, "expected a list"));
    return;
  }
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(err(prefix + "[" + index + "]", "expected an entry"));
      return;
    }
    walkFields(prefix + "[" + index + "]", section.fields, entry, root, errors, seen, checkImages);
  });
}

function checkText(at, field, raw, errors) {
  if (raw === undefined || raw === null) raw = "";
  if (typeof raw !== "string") {
    errors.push(err(at, "expected text"));
    return;
  }
  const value = raw.trim();
  if (field.required && value === "") {
    errors.push(err(at, "is required"));
    return;
  }
  if (field.maxLength && value.length > field.maxLength) {
    errors.push(err(at, "is " + value.length + " characters; keep it under " + field.maxLength));
  }
}

function checkUniqueText(at, field, raw, errors, bucket, what) {
  checkText(at, field, raw, errors);
  if (typeof raw !== "string") return;
  const key = raw.trim().toLowerCase();
  if (!key) return;
  if (bucket.has(key)) {
    errors.push(err(at, "the same " + what + " is already used at " + bucket.get(key)));
  } else {
    bucket.set(key, at);
  }
}

function checkSlug(at, field, raw, errors, seen) {
  checkText(at, field, raw, errors);
  if (typeof raw !== "string") return;
  const value = raw.trim();
  if (!value) return;
  if (!SLUG_RE.test(value)) {
    errors.push(err(at, "use lower-case letters, numbers and single dashes only"));
    return;
  }
  if (seen.slug.has(value)) {
    errors.push(err(at, "the same link name is already used at " + seen.slug.get(value)));
  } else {
    seen.slug.set(value, at);
  }
}

function checkSelect(at, field, raw, root, errors) {
  const options = resolveOptions(field, root);
  if (raw === undefined || raw === null || raw === "") {
    if (field.required) errors.push(err(at, "choose one of: " + options.join(", ")));
    return;
  }
  if (!options.includes(raw)) {
    errors.push(err(at, "“" + raw + "” is not one of: " + options.join(", ")));
  }
}

function checkStringList(at, field, raw, errors) {
  if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== "string")) {
    errors.push(err(at, "expected a list of lines"));
    return;
  }
  if (field.options) {
    raw.forEach((entry, index) => {
      if (!field.options.includes(entry)) {
        errors.push(err(at + "[" + index + "]", "“" + entry + "” is not one of: " + field.options.join(", ")));
      }
    });
  }
}

function checkChannel(at, raw, errors) {
  if (raw === undefined || raw === null || raw === "") return;
  if (typeof raw !== "string") {
    errors.push(err(at, "expected text"));
    return;
  }
  const key = at.split(".").pop();

  if (key === "whatsapp") {
    if (!/^\d{8,15}$/.test(raw)) {
      errors.push(err(at, "expected 8 to 15 digits in full international form, like 8801712345678"));
    }
    return;
  }
  if (key === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
      errors.push(err(at, "that does not look like an email address"));
    }
    return;
  }
  if (key === "instagram") {
    if (!/^[A-Za-z0-9._]{1,30}$/.test(raw)) {
      errors.push(err(at, "use letters, numbers, dots and underscores only, without the @"));
    }
    return;
  }
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(raw)) {
    errors.push(err(at, "use letters, numbers, dots, dashes and underscores only"));
  }
}

function checkImage(at, image, errors, checkImages) {
  if (!image || typeof image !== "object" || Array.isArray(image)) {
    errors.push(err(at, "expected a photograph"));
    return;
  }
  if (typeof image.src !== "string" || !image.src) {
    errors.push(err(at + ".src", "is missing"));
    return;
  }
  if (image.src.includes("..")) {
    errors.push(err(at + ".src", "must stay inside the project folder"));
    return;
  }
  if (!OK_FILE_RE.test(image.src)) {
    errors.push(err(at + ".src", "expected a .webp, .jpg or .png file"));
  }
  if (typeof image.width !== "number" || image.width <= 0 ||
      typeof image.height !== "number" || image.height <= 0) {
    errors.push(err(at, "needs its width and height, which the uploader sets for you"));
  }
  if (image.srcset !== undefined && typeof image.srcset !== "string") {
    errors.push(err(at + ".srcset", "expected text"));
  }

  if (!checkImages) return;

  const absolute = path.resolve(ROOT, image.src);
  if (!absolute.startsWith(path.resolve(ROOT))) {
    errors.push(err(at + ".src", "must stay inside the project folder"));
    return;
  }
  if (!fs.existsSync(absolute)) {
    errors.push(err(at + ".src", "no such file: " + image.src));
    return;
  }
  (image.srcset || "")
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean)
    .forEach((candidate) => {
      if (candidate.includes("..") || !fs.existsSync(path.resolve(ROOT, candidate))) {
        errors.push(err(at + ".srcset", "no such file: " + candidate));
      }
    });
}

export function resolveOptions(field, root) {
  if (field.options) return field.options.slice();
  const source = root[field.from];
  if (!Array.isArray(source)) return [];
  return source
    .map((entry) => entry && entry[field.valueField])
    .filter(Boolean);
}

function err(path_, message) {
  return { path: path_, message };
}
