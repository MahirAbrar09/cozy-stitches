/* ==========================================================================
   Cozy Stitches — brand asset generator
   --------------------------------------------------------------------------
   Builds every raster brand image from the SVG artwork in assets/img/brand/,
   using the same engine a browser uses. That means the favicons and the social
   card are pixel-exact copies of the real logo rather than a redrawing of it.

   Colours and type families are read from css/tokens.css, so the tokens file
   stays the single source of truth. Change a colour there, re-run this.

   Produces: favicon.ico, favicon-32.png, icon-192.png, icon-512.png,
             apple-touch-icon.png, og-image.png

   Run:
     npm install --no-save playwright && node tools/make-brand-assets.mjs

   Environment:
     PW    path to the playwright module, if it is not resolvable
     OUT   output directory (default assets/img/brand)
   ========================================================================== */

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require(process.env.PW || "playwright"));
} catch (error) {
  console.error("Playwright not found. Set PW=<path> or run: npm install --no-save playwright");
  console.error(String(error.message || error));
  process.exit(2);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BRAND = path.join(ROOT, "assets", "img", "brand");
const OUT = process.env.OUT || BRAND;

/* The artwork is inlined rather than linked. A page built with setContent has
   an opaque origin and is not allowed to fetch file:// images. */
const MARK_SVG = fs.readFileSync(path.join(BRAND, "mark.svg"), "utf8");
const FAVICON_SVG = fs.readFileSync(path.join(BRAND, "favicon.svg"), "utf8");
const LOGO_SVG = fs.readFileSync(path.join(BRAND, "logo.svg"), "utf8");

const FONTS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700" +
  "&family=Montserrat:wght@400;500;600&display=swap";

/* --------------------------------------------------------------------------
   Read the palette and families out of css/tokens.css.
   -------------------------------------------------------------------------- */
function readTokens() {
  const css = fs.readFileSync(path.join(ROOT, "css", "tokens.css"), "utf8");
  const get = (name) => {
    const match = css.match(new RegExp("--" + name + ":\\s*([^;]+);"));
    if (!match) throw new Error("tokens.css is missing --" + name);
    return match[1].trim();
  };
  return {
    ink: get("ink"),
    inkSoft: get("ink-soft"),
    inkMuted: get("ink-muted"),
    linen: get("linen"),
    sky: get("sky"),
    skyDeep: get("sky-deep"),
    display: get("font-display"),
    body: get("font-body"),
  };
}

/* --------------------------------------------------------------------------
   Rasterise one SVG at one exact pixel size, with the SVG inlined.
   -------------------------------------------------------------------------- */
async function rasterise(page, { svg, size, background }) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><meta charset="utf-8"><style>
       html, body { margin: 0; padding: 0;
         background: ${background || "transparent"}; }
       svg { display: block; width: ${size}px; height: ${size}px; }
     </style>${svg}`,
    { waitUntil: "load" }
  );
  return page.screenshot({ omitBackground: !background });
}

/* --------------------------------------------------------------------------
   ICO container. Modern .ico files may embed PNG data directly, which keeps
   this free of any image library.
   -------------------------------------------------------------------------- */
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = entries.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...entries.map((e) => e.data)]);
}

/* --------------------------------------------------------------------------
   The 1200x630 social card, composed as a page and photographed.
   -------------------------------------------------------------------------- */
function socialCardHtml(t) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    display: grid;
    grid-template-columns: 430px 1fr;
    background: ${t.linen};
    color: ${t.ink};
    font-family: ${t.body};
    position: relative;
    overflow: hidden;
  }
  /* The logo's own canvas colour, extended across the whole panel, with the
     logo's dot texture over it, so the artwork bleeds edge to edge. */
  .panel {
    display: grid;
    place-items: center;
    background-color: ${t.skyDeep};
    background-image: radial-gradient(circle at center, rgba(92,120,142,.5) 0 1.2px, transparent 1.9px);
    background-size: 16px 16px;
  }
  .panel svg { display: block; width: 372px; height: 372px; }
  .content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 74px 0 62px;
  }
  h1 {
    font-family: ${t.display};
    font-size: 53px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.012em;
  }
  .tagline { margin-top: 26px; font-size: 21px; line-height: 1.5; color: ${t.inkSoft}; }
  .stitch {
    margin-top: 32px;
    height: 3px;
    border-radius: 2px;
    background-image: repeating-linear-gradient(to right, ${t.sky} 0 10px, transparent 10px 20px);
  }
  .what { margin-top: 32px; font-size: 19px; line-height: 1.5; color: ${t.inkMuted}; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 12px; background: ${t.ink}; }
</style></head>
<body>
  <div class="panel">${LOGO_SVG}</div>
  <div class="content">
    <h1>Hand-embroidered, made to order.</h1>
    <p class="tagline">Love is the thread with which we connect to the world.</p>
    <div class="stitch"></div>
    <p class="what">Bags, pouches, bangles, earrings and small things, stitched one at a time in Bangladesh.</p>
  </div>
  <div class="bar"></div>
</body></html>`;
}

async function renderSocialCard(page, t) {
  /* Written to disk and loaded over file:// so the remote font stylesheet is
     fetched under normal page rules rather than an opaque about:blank origin. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cozy-card-"));
  const file = path.join(dir, "card.html");
  fs.writeFileSync(file, socialCardHtml(t));

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const displayLoaded = await page.evaluate(
    (family) => document.fonts.check("600 53px " + family),
    '"Playfair Display"'
  );
  if (!displayLoaded) {
    console.warn("  ! Playfair Display did not load - the card fell back to a system serif.");
    console.warn("    Connect to the internet and re-run for an exact match with the logo.");
  }

  const out = path.join(OUT, "og-image.png");
  await page.screenshot({ path: out });
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

/* -------------------------------------------------------------------------- */

async function main() {
  if (!fs.existsSync(OUT)) throw new Error("Missing output directory: " + OUT);

  const t = readTokens();
  const written = [];

  const record = (name) => {
    const file = path.join(OUT, name);
    written.push([name, fs.statSync(file).size]);
  };

  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  /* Icons of the emblem. Transparent, because the app icon and the browser tab
     both place it on their own ground. */
  const jobs = [
    ["icon-512.png", { svg: MARK_SVG, size: 512, background: null }],
    ["icon-192.png", { svg: MARK_SVG, size: 192, background: null }],
    /* iOS composites transparency onto black, so this one keeps the page colour. */
    ["apple-touch-icon.png", { svg: MARK_SVG, size: 180, background: t.linen }],
  ];

  for (const [name, job] of jobs) {
    const png = await rasterise(page, job);
    fs.writeFileSync(path.join(OUT, name), png);
    record(name);
  }

  /* The favicon variant carries its own rounded tile, so it needs no ground. */
  const faviconPng = await rasterise(page, { svg: FAVICON_SVG, size: 32, background: null });
  fs.writeFileSync(path.join(OUT, "favicon-32.png"), faviconPng);
  record("favicon-32.png");

  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const size of icoSizes) {
    icoEntries.push({ size, data: await rasterise(page, { svg: FAVICON_SVG, size, background: null }) });
  }
  fs.writeFileSync(path.join(OUT, "favicon.ico"), buildIco(icoEntries));
  record("favicon.ico");

  await renderSocialCard(page, t);
  record("og-image.png");

  await browser.close();

  console.log("Wrote into " + path.relative(ROOT, OUT) + "/:");
  for (const [name, size] of written) {
    console.log("  " + name.padEnd(24) + (size / 1024).toFixed(1).padStart(8) + " KB");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
