#!/usr/bin/env node
/* ==========================================================================
   Cozy Stitches — regenerate the file the browser loads
   --------------------------------------------------------------------------
   Reads js/content.json, checks it against the schema, and writes
   js/content.js. The host runs this on every deploy, so the published content
   can never drift from the data file.

     node tools/build-content.mjs            build
     node tools/build-content.mjs --check    fail if content.js is out of date
     node tools/build-content.mjs --quiet    only report problems

   The first time it runs on a project that still has the old hand-written
   content.js, it imports that file, converts it, and writes content.json —
   after which content.json is the source of truth and this never rewrites it
   again.
   ========================================================================== */

import fs from "node:fs";
import { CONTENT_JSON, CONTENT_JS, readContent, writeContent, snapshot,
         serializeContentJs, writeAtomic } from "./admin/lib/content.mjs";
import { validate, normalize } from "./admin/lib/validate.mjs";

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const quiet = argv.includes("--quiet");

function fail(heading, errors) {
  console.error(heading);
  errors.slice(0, 25).forEach((error) => {
    console.error("  " + error.path + " - " + error.message);
  });
  if (errors.length > 25) console.error("  ... and " + (errors.length - 25) + " more");
  process.exit(1);
}

let loaded;
try {
  loaded = readContent();
} catch (error) {
  console.error(String(error.message || error));
  process.exit(1);
}

const data = normalize(loaded.data);

const errors = validate(data);
if (errors.length) fail("Content did not pass its checks, so nothing was written:", errors);

const expected = serializeContentJs(data);

if (checkOnly) {
  const actual = fs.existsSync(CONTENT_JS) ? fs.readFileSync(CONTENT_JS, "utf8") : "";
  if (actual !== expected) {
    console.error("js/content.js is out of date. Run: node tools/build-content.mjs");
    process.exit(1);
  }
  if (!quiet) console.log("js/content.js matches js/content.json");
  process.exit(0);
}

if (loaded.importedFrom) {
  /* First run on a legacy project: content.json does not exist yet, so create
     it, keep a copy of what we converted, and say so. */
  writeContent(data);
  snapshot(data);
  console.log("Imported the hand-written content into js/content.json");
  console.log("js/content.json is now the source of truth; edit it through the admin panel.");
} else {
  writeAtomic(CONTENT_JS, expected);
}

if (!quiet) {
  const products = (data.products || []).length;
  const categories = (data.categories || []).length;
  const images = (data.products || [])
    .reduce((total, product) => total + (product.images || []).length, 0);

  console.log("Built js/content.js");
  console.log("  " + products + " products, " + categories + " categories, " + images + " photographs");
  console.log("  source: " + CONTENT_JSON);
}
