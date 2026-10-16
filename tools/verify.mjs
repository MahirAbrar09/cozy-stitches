/* ==========================================================================
   Cozy Stitches — browser verification
   --------------------------------------------------------------------------
   Loads every page in a real Chromium, exercises the ordering paths, the
   filter, the detail dialog and the mobile navigation, and fails loudly on
   console errors, broken images or horizontal overflow.

   Playwright is not a dependency of this static site. Run it with either:

     npm install --no-save playwright && node tools/verify.mjs
     PW="C:/path/to/node_modules/playwright" node tools/verify.mjs

   Environment:
     BASE  site root           (default http://127.0.0.1:8099)
     SHOTS screenshot folder   (default the system temp folder)
   ========================================================================== */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

/* The suite serves the site itself on a spare port, so `node tools/verify.mjs`
   is the whole command and there is no server to remember to start. Set BASE to
   test a server that is already running instead. */
function startSiteServer() {
  const server = http.createServer((req, res) => {
    let relative = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (relative === "/") relative = "/index.html";
    const clean = relative.replace(/^\/+/, "");
    const file = path.resolve(PROJECT, clean);

    if (!file.startsWith(PROJECT + path.sep) || clean.startsWith("tools/") ||
        !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

let siteServer = null;
let BASE = (process.env.BASE || "").replace(/\/$/, "");
if (!BASE) {
  siteServer = await startSiteServer();
  BASE = "http://127.0.0.1:" + siteServer.address().port;
}

const require = createRequire(import.meta.url);

let chromium;
try {
  ({ chromium } = require(process.env.PW || "playwright"));
} catch (error) {
  console.error("Playwright not found. Set PW=<path> or run: npm install --no-save playwright");
  console.error(String(error.message || error));
  process.exit(2);
}

const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), "cozy-stitches-shots");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
}

/* Collects console errors, page errors and failed requests for a page. */
function watch(page) {
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push("console: " + message.text());
  });
  page.on("pageerror", (error) => {
    /* The first few stack lines, so a failure names the file and the line
       rather than only the message. */
    const where = String(error.stack || error.message).split("\n").slice(0, 4)
      .map((line) => line.trim()).join(" <- ");
    problems.push("pageerror: " + where);
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    /* Offline font loading is an acceptable degradation, not a bug. */
    if (url.includes("fonts.gstatic.com") || url.includes("fonts.googleapis.com")) return;
    problems.push("requestfailed: " + url);
  });
  return problems;
}

async function load(page, url, readySelector) {
  await page.goto(url, { waitUntil: "load" });
  if (readySelector) await page.waitForSelector(readySelector, { timeout: 10000 });
}

/* Walks every text-bearing element, resolves its effective background by
   compositing ancestors, and reports anything below the WCAG AA threshold.
   Large text (24px, or 18.66px bold) is held to 3:1, everything else to 4.5:1. */
function contrastProbe() {
  const parse = (color) => {
    const match = color && color.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((value) => parseFloat(value.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  };
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const luminance = (c) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  const ratio = (a, b) => {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const backgroundOf = (element) => {
    const stack = [];
    let node = element;
    while (node && node.nodeType === 1) {
      const colour = parse(getComputedStyle(node).backgroundColor);
      if (colour && colour.a > 0) {
        stack.push(colour);
        if (colour.a === 1) break;
      }
      node = node.parentElement;
    }
    let result = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = stack.length - 1; i >= 0; i -= 1) result = over(stack[i], result);
    return result;
  };

  const issues = [];
  document.querySelectorAll("body *").forEach((element) => {
    const ownText = Array.from(element.childNodes)
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent.trim())
      .join(" ")
      .trim();
    if (!ownText) return;

    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return;
    if (parseFloat(style.opacity) === 0) return;
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return;

    const background = backgroundOf(element);
    const raw = parse(style.color);
    if (!raw) return;
    const foreground = raw.a < 1 ? over(raw, background) : raw;

    const size = parseFloat(style.fontSize);
    const weight = parseInt(style.fontWeight, 10) || 400;
    const needs = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const measured = ratio(foreground, background);
    if (measured < needs) {
      issues.push({
        text: ownText.slice(0, 44),
        ratio: Math.round(measured * 100) / 100,
        needs,
        detail: `${size}px/${weight} ${style.color}`,
      });
    }
  });
  return issues;
}

/* Reports which elements stick out past the viewport, so a width failure is
   actionable rather than just a pair of numbers. */
function overflowProbe() {
  const limit = window.innerWidth;
  const culprits = [];
  document.querySelectorAll("body *").forEach((element) => {
    const box = element.getBoundingClientRect();
    if (!box.width || box.right <= limit + 1) return;
    const name = element.tagName.toLowerCase() +
      (typeof element.className === "string" && element.className.trim()
        ? "." + element.className.trim().split(/\s+/).join(".")
        : "");
    culprits.push(name + " right=" + Math.round(box.right) + " w=" + Math.round(box.width));
  });
  return culprits.slice(0, 6).join(" | ") || "none found";
}

/* Runs one of the project's own node scripts and reports whether it exited
   cleanly, with its first line of complaint for the failure message. */
function spawnSyncNode(args) {
  const result = spawnSync(process.execPath, args, { cwd: PROJECT, encoding: "utf8" });
  const output = (result.stderr || result.stdout || "").trim().split("\n")[0] || "";
  return { ok: result.status === 0, output };
}

const browser = await chromium.launch();

/* ===================== desktop: home ===================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = watch(page);

  await load(page, BASE + "/index.html", "[data-render='categories'] > li");

  check("home: 5 category cards", (await page.locator("[data-render='categories'] > li").count()) === 5);
  check("home: 6 featured tiles", (await page.locator("[data-render='featured'] > li").count()) === 6);
  check("home: hero heading filled",
    (await page.locator("[data-render='hero-heading']").innerText()).length > 20);
  /* Until a photograph exists the hero carries the full logo, presented as a
     plate. The media-frame img rules are scoped to direct children precisely so
     they cannot stretch a nested image to fill the frame. */
  check("home: hero shows the full logo while a photograph is missing",
    (await page.locator(".hero__media .brand-plate").count()) === 1);

  const heroPlate = await page.locator(".hero__media .brand-plate").boundingBox();
  check("home: hero logo keeps its own square size, not the frame size",
    !!heroPlate && heroPlate.width <= 340 && Math.abs(heroPlate.width - heroPlate.height) < 2,
    heroPlate ? Math.round(heroPlate.width) + "x" + Math.round(heroPlate.height) : "missing");

  const heroLogo = await page.locator(".hero__media .brand-plate").getAttribute("src");
  check("home: hero logo is the vector artwork", (heroLogo || "").endsWith("logo.svg"), heroLogo);

  /* A min-height sitting on top of aspect-ratio 3/2 silently widened this frame
     from 280px to 408px at a 320px viewport. Assert the ratio itself, not just
     the absence of overflow, so that trap cannot return unnoticed. */
  const heroFrame = await page.locator(".hero__media").boundingBox();
  check("home: hero frame keeps its 3:2 ratio",
    !!heroFrame && Math.abs(heroFrame.width / heroFrame.height - 1.5) < 0.02,
    heroFrame ? (heroFrame.width / heroFrame.height).toFixed(2) + ":1" : "missing");

  const heroCaptionBox = await page.locator(".hero__figure .hero__caption").boundingBox();
  const heroCaptionText = await page.locator(".hero__figure .hero__caption").innerText();
  check("home: hero caption sits below the frame and is filled in",
    !!heroFrame && !!heroCaptionBox &&
      heroCaptionBox.y >= heroFrame.y + heroFrame.height - 1 &&
      heroCaptionText.trim().length > 10,
    (heroCaptionBox ? "caption y=" + Math.round(heroCaptionBox.y) : "caption missing") +
      ", frame ends " + (heroFrame ? Math.round(heroFrame.y + heroFrame.height) : "?"));

  const cta = await page.locator("[data-render='order-cta']").first().getAttribute("href");
  check("home: header CTA points at a real channel",
    /^https:\/\/(m\.me|wa\.me|instagram\.com)\//.test(cta || ""), cta);

  check("home: ordered CTA opens in a new tab",
    (await page.locator("[data-render='order-cta']").first().getAttribute("rel")) === "noopener");

  check("home: footer lists at least one channel",
    (await page.locator(".site-footer [data-render='channels-plain'] a").count()) >= 1);
  check("home: footer page links rendered",
    (await page.locator(".site-footer [data-render='footer-links'] a").count()) === 3);
  check("home: footer year filled",
    /^\d{4}$/.test(await page.locator("[data-render='year']").first().innerText()));

  const featuredHref = await page.locator("[data-render='featured'] a").first().getAttribute("href");
  check("home: featured tiles cross-link into the shop",
    (featuredHref || "").startsWith("./shop.html#"), featuredHref);

  check("home: no broken images",
    await page.evaluate(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)));

  check("home: document has one h1", (await page.locator("h1").count()) === 1);
  check("home: stitch line is present",
    (await page.locator(".hero__media .stitch-line").count()) === 1);

  await page.screenshot({ path: path.join(SHOTS, "home-1440.png"), fullPage: true });
  check("home: no console or network errors", problems.length === 0, problems.join(" | "));
  await context.close();
}

/* ===================== desktop: shop ===================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = watch(page);

  await load(page, BASE + "/shop.html", "[data-render='products'] > li");

  check("shop: 12 product tiles", (await page.locator("[data-render='products'] > li.tile").count()) === 12);
  check("shop: filter bar has All plus every category",
    (await page.locator("[data-filter]").count()) === 6);
  check("shop: count reads 12 pieces",
    (await page.locator("[data-render='count']").innerText()).includes("12 pieces"));
  check("shop: no broken images",
    await page.evaluate(() => Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0)));

  const tileMark = await page.locator(".tile__media .placeholder__mark").first().boundingBox();
  check("shop: placeholder emblem stays small inside a tile",
    !!tileMark && tileMark.width <= 48 && tileMark.height <= 48,
    tileMark ? Math.round(tileMark.width) + "x" + Math.round(tileMark.height) : "missing");

  /* Motion, part one: the grid someone lands on must be there at once. Anything
     that animates in on first paint delays the one thing they came to read. */
  check("motion: the opening grid appears immediately, with nothing animating in",
    await page.evaluate(() => {
      const tiles = Array.from(document.querySelectorAll("[data-render='products'] > .tile"));
      return tiles.length > 0 &&
        tiles.every((tile) => !tile.classList.contains("is-entering")) &&
        tiles.every((tile) => getComputedStyle(tile).opacity === "1");
    }));

  /* Filtering */
  await page.locator("[data-filter='pouches']").click();
  const shown = await page.locator("[data-render='products'] > li.tile:not([hidden])").count();
  check("shop: pouches filter shows 4 tiles", shown === 4, shown);
  check("shop: filter is reflected in the URL", page.url().includes("c=pouches"), page.url());
  check("shop: active chip is announced",
    (await page.getAttribute("[data-filter='pouches']", "aria-pressed")) === "true");
  check("shop: filtered count updates",
    (await page.locator("[data-render='count']").innerText()).includes("4 pieces"));
  check("shop: other chips are not pressed",
    (await page.getAttribute("[data-filter='bags']", "aria-pressed")) === "false");

  /* Motion, part two. The entrance animation is over long before a check could
     look at it, so what is watched is the class it hangs off. */
  await page.evaluate(() => {
    window.__arrived = 0;
    const grid = document.querySelector("[data-render='products']");
    new MutationObserver((records) => {
      records.forEach((record) => {
        if (record.target.classList && record.target.classList.contains("is-entering")) {
          window.__arrived += 1;
        }
      });
    }).observe(grid, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });

  await page.locator("[data-filter='bags']").click();
  const arrived = await page.evaluate(() => window.__arrived);
  check("motion: changing category brings the new tiles in rather than teleporting them",
    arrived > 0, String(arrived));

  check("motion: a tile that arrives has a short entrance of its own",
    await page.evaluate(() => {
      const tile = document.querySelector("[data-render='products'] > .tile");
      tile.classList.add("is-entering");
      const style = getComputedStyle(tile);
      const ok = style.animationName === "tile-in" && parseFloat(style.animationDuration) < 0.3;
      tile.classList.remove("is-entering");
      return ok;
    }));

  /* The contract the reveal-on-load JavaScript depends on. If this ever
     stopped holding, every product photograph would be invisible. */
  check("motion: a photograph waiting to arrive starts transparent and ends visible",
    await page.evaluate(() => {
      const probe = document.createElement("img");
      probe.setAttribute("data-reveal", "");
      document.body.append(probe);
      const hidden = getComputedStyle(probe).opacity;
      /* Transitions off, so this reads the state it settles into rather than
         catching it part way through the fade. */
      probe.style.transition = "none";
      probe.classList.add("is-revealed");
      const shown = getComputedStyle(probe).opacity;
      probe.remove();
      return hidden === "0" && shown === "1";
    }));

  /* A filter arriving in the URL, as a shared link would */
  await page.goto(BASE + "/shop.html?c=bags", { waitUntil: "load" });
  await page.waitForSelector("[data-render='products'] > li");
  check("shop: deep-linked filter ?c=bags applies",
    (await page.locator("[data-render='products'] > li.tile:not([hidden])").count()) === 3);
  check("shop: deep-linked filter marks its chip",
    (await page.getAttribute("[data-filter='bags']", "aria-pressed")) === "true");

  await page.goto(BASE + "/shop.html", { waitUntil: "load" });
  await page.waitForSelector("[data-render='products'] > li");

  /* Detail dialog */
  await page.locator("[data-detail='lavender-sprig-pouch']").click();
  await page.waitForFunction(() => document.getElementById("detail").open);
  check("shop: dialog opens", await page.evaluate(() => document.getElementById("detail").open));
  check("shop: dialog is deep-linkable", page.url().endsWith("#lavender-sprig-pouch"), page.url());
  check("shop: dialog shows the product name",
    (await page.locator("#detail-title").innerText()).includes("Lavender Sprig"));

  const hrefs = await page.locator("#detail [data-channel]").evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute("href")));
  check("shop: dialog builds order links", hrefs.length >= 2, hrefs.join(" | "));
  check("shop: Messenger link carries the product reference",
    hrefs.some((h) => h.includes("m.me/") && h.includes("ref=lavender-sprig-pouch")));
  check("shop: WhatsApp link pre-fills the message",
    hrefs.some((h) => h.includes("wa.me/") && h.includes("text=")) ||
    !hrefs.some((h) => h.includes("wa.me/")),
    "WhatsApp is unconfigured by default, so this is vacuously true");
  check("shop: order buttons open in a new tab with noopener",
    await page.locator("#detail [data-channel]").evaluateAll((nodes) =>
      nodes.every((n) => n.target === "_blank" && n.rel.includes("noopener"))));

  check("shop: reference chip is present",
    (await page.locator("#detail [data-copy='CS-PCH-01']").count()) === 1);

  await page.screenshot({ path: path.join(SHOTS, "shop-detail-1440.png") });

  /* Escape closes and returns focus to what opened it */
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.getElementById("detail").open);
  check("shop: Escape closes the dialog",
    await page.evaluate(() => !document.getElementById("detail").open));
  check("shop: focus returns to the tile that opened it",
    await page.evaluate(() => document.activeElement &&
      document.activeElement.getAttribute("data-detail") === "lavender-sprig-pouch"));

  await page.screenshot({ path: path.join(SHOTS, "shop-1440.png"), fullPage: true });
  check("shop: no console or network errors", problems.length === 0, problems.join(" | "));
  await context.close();
}

/* ===================== desktop: about, contact, 404 ===================== */
for (const [file, assertions] of [
  ["about.html", async (page) => {
    check("about: 3 body paragraphs",
      (await page.locator("[data-render='about-body'] p").count()) === 3);
    check("about: 2 reviews", (await page.locator("[data-render='reviews'] li").count()) === 2,
      await page.locator("[data-render='reviews'] li").count());
    check("about: 4 material rows",
      (await page.locator("[data-render='materials-list'] li").count()) === 4);
    check("about: 5 care notes",
      (await page.locator("[data-render='care-list'] li").count()) === 5);
    check("about: the mark section frames the full logo",
      ((await page.locator(".mark-plate img").getAttribute("src")) || "").endsWith("logo.svg"));
    check("about: the mark section has its copy",
      (await page.locator("[data-render='mark-body']").innerText()).length > 80);
  }],
  ["contact.html", async (page) => {
    check("contact: 6 FAQ disclosures",
      (await page.locator("[data-render='faq'] details").count()) === 6);
    check("contact: delivery notes rendered",
      (await page.locator("[data-render='shipping-list'] li").count()) === 4);
    check("contact: payment notes rendered",
      (await page.locator("[data-render='payments-list'] li").count()) === 4);
    check("contact: channel rows rendered",
      (await page.locator("[data-render='channels'] a").count()) >= 1);
    check("contact: FAQ answers start hidden",
      await page.locator("[data-render='faq'] details").first().evaluate((n) => !n.open));
  }],
  ["404.html", async (page) => {
    check("404: offers a way back", (await page.locator("main a").count()) >= 2);
    check("404: shows the brand plate",
      (await page.locator(".page-head .brand-plate").count()) === 1);
  }]
]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const problems = watch(page);
  await load(page, BASE + "/" + file, "main");
  await assertions(page);
  check(`${file}: no console or network errors`, problems.length === 0, problems.join(" | "));
  await page.screenshot({ path: path.join(SHOTS, file.replace(".html", "") + "-1440.png"), fullPage: true });
  await context.close();
}

/* ===================== mobile ===================== */
{
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const problems = watch(page);
  await load(page, BASE + "/index.html", "[data-render='categories'] > li");

  check("mobile 360: no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await page.evaluate(() => document.documentElement.scrollWidth + " vs " + window.innerWidth));

  check("mobile: navigation starts collapsed", await page.locator("#site-nav").isHidden());
  await page.locator(".nav-toggle").click();
  check("mobile: navigation opens", await page.locator("#site-nav").isVisible());
  check("mobile: toggle reports expanded",
    (await page.getAttribute(".nav-toggle", "aria-expanded")) === "true");
  await page.screenshot({ path: path.join(SHOTS, "home-360-nav-open.png") });
  await page.keyboard.press("Escape");
  check("mobile: Escape closes the navigation", await page.locator("#site-nav").isHidden());
  check("mobile: toggle reports collapsed",
    (await page.getAttribute(".nav-toggle", "aria-expanded")) === "false");
  await page.screenshot({ path: path.join(SHOTS, "home-360.png"), fullPage: true });

  await page.goto(BASE + "/shop.html", { waitUntil: "load" });
  await page.waitForSelector("[data-render='products'] > li");
  check("mobile 360: shop has no horizontal overflow",
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));

  await page.locator("[data-detail='bow-garden-tote']").click();
  await page.waitForFunction(() => document.getElementById("detail").open);
  check("mobile: dialog fits inside the viewport",
    await page.evaluate(() => {
      const box = document.getElementById("detail").getBoundingClientRect();
      return box.width <= window.innerWidth + 1 && box.right <= window.innerWidth + 1;
    }));
  await page.screenshot({ path: path.join(SHOTS, "shop-detail-360.png") });

  await page.keyboard.press("Escape");
  check("mobile: no console or network errors", problems.length === 0, problems.join(" | "));
  await context.close();
}

/* ===================== smallest supported width ===================== */
{
  const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
  const page = await context.newPage();
  for (const file of ["index.html", "shop.html", "about.html", "contact.html"]) {
    await load(page, BASE + "/" + file, "main");
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(`320px ${file}: no horizontal overflow`, fits,
      fits ? "" : await page.evaluate(overflowProbe));
  }
  await context.close();
}

/* ===================== reduced motion ===================== */
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await load(page, BASE + "/index.html", ".stitch-line");
  const duration = await page.evaluate(() =>
    getComputedStyle(document.querySelector(".stitch-line")).animationDuration);
  check("reduced motion: the stitch does not animate",
    parseFloat(duration) < 0.05, duration);

  /* Reduced motion means less movement, not a page that stops responding. */
  const stillTransitioned = await page.evaluate(() => {
    const button = document.createElement("button");
    button.className = "btn";
    document.body.append(button);
    const properties = getComputedStyle(button).transitionProperty;
    button.remove();
    return properties;
  });
  check("reduced motion: press movement is not transitioned",
    !stillTransitioned.includes("transform"), stillTransitioned);
  check("reduced motion: colour and opacity still respond",
    stillTransitioned.includes("opacity"), stillTransitioned);

  await context.close();
}

/* ===================== keyboard-only pass ===================== */
{
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();
  await load(page, BASE + "/shop.html", "[data-render='products'] > li");

  await page.keyboard.press("Tab");
  check("keyboard: the first stop is the skip link",
    await page.evaluate(() => document.activeElement.classList.contains("skip-link")));

  let reachedTile = false;
  for (let i = 0; i < 60 && !reachedTile; i += 1) {
    await page.keyboard.press("Tab");
    reachedTile = await page.evaluate(() =>
      document.activeElement.hasAttribute("data-detail"));
  }
  check("keyboard: a product tile is reachable by Tab", reachedTile);

  if (reachedTile) {
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.getElementById("detail").open);
    check("keyboard: Enter opens the detail dialog",
      await page.evaluate(() => document.getElementById("detail").open));
    check("keyboard: focus lands inside the dialog",
      await page.evaluate(() => document.getElementById("detail").contains(document.activeElement)));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("detail").open);
    check("keyboard: Escape closes it again",
      await page.evaluate(() => !document.getElementById("detail").open));
  }
  await context.close();
}

/* ===================== WCAG AA contrast audit ===================== */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  for (const file of ["index.html", "shop.html", "about.html", "contact.html", "404.html"]) {
    await load(page, BASE + "/" + file, "main");
    const issues = await page.evaluate(contrastProbe);
    check(`contrast ${file}: all text meets WCAG AA`, issues.length === 0,
      issues.map((i) => `"${i.text}" ${i.ratio}:1 needs ${i.needs} (${i.detail})`).join(" | "));
  }

  await load(page, BASE + "/shop.html", "[data-render='products'] > li");
  await page.locator("[data-detail='bow-garden-tote']").click();
  await page.waitForFunction(() => document.getElementById("detail").open);
  const dialogIssues = await page.evaluate(contrastProbe);
  check("contrast: product dialog meets WCAG AA", dialogIssues.length === 0,
    dialogIssues.map((i) => `"${i.text}" ${i.ratio}:1 needs ${i.needs} (${i.detail})`).join(" | "));

  await context.close();
}

/* ===================== the content pipeline ===================== */
{
  const source = path.join(PROJECT, "js", "content.json");
  check("content: js/content.json exists", fs.existsSync(source));

  const data = JSON.parse(fs.readFileSync(source, "utf8"));

  check("content: at least one product", (data.products || []).length > 0);
  check("content: the order message is a plain template, not a function",
    typeof data.order.messageTemplate === "string" &&
    data.order.messageTemplate.includes("{name}") &&
    data.order.message === undefined);

  const slugs = (data.products || []).map((product) => product.slug);
  check("content: every product link name is unique",
    new Set(slugs).size === slugs.length);

  const codes = (data.products || []).map((product) => product.code);
  check("content: every reference code is unique", new Set(codes).size === codes.length);

  const categoryIds = (data.categories || []).map((category) => category.id);
  check("content: every product sits in a real category",
    (data.products || []).every((product) => categoryIds.includes(product.category)));

  const referenced = [];
  (data.products || []).forEach((product) => {
    (product.images || []).forEach((image) => {
      referenced.push(image.src);
      (image.srcset || "").split(",").forEach((part) => {
        const url = part.trim().split(/\s+/)[0];
        if (url) referenced.push(url);
      });
    });
  });
  const heroPhoto = data.home && data.home.heroPhoto;
  if (heroPhoto && heroPhoto.src) referenced.push(heroPhoto.src);

  const missing = referenced.filter((file) => !fs.existsSync(path.join(PROJECT, file)));
  check("content: every referenced photograph exists on disk",
    missing.length === 0, missing.join(", "));

  /* The generated file is what the browser loads. If it drifts from the data
     file, the site quietly serves stale content — the likeliest failure of
     this design, so it is asserted rather than trusted. */
  const built = spawnSyncNode(["tools/build-content.mjs", "--check"]);
  check("content: js/content.js is in step with js/content.json", built.ok, built.output);
}

/* ===================== the repository must contain the site ============== */
{
  /* An earlier version of the panel published the content and nothing else, so
     the repository held no pages, no stylesheets and no build tool. The host
     then had nothing it could build, and the only symptom was a broken live
     address. This is the check that would have caught it, run against a real
     throwaway repository rather than a mock. */
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "cozy-repo-"));

  try {
    ["index.html", "css/tokens.css", "tools/build-content.mjs", "netlify.toml"]
      .forEach((relative) => {
        const file = path.join(repo, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "placeholder\n");
      });

    const repoGit = (args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });
    repoGit(["init", "-q"]);
    repoGit(["config", "user.name", "Verifier"]);
    repoGit(["config", "user.email", "verifier@example.com"]);
    repoGit(["add", "index.html"]);
    repoGit(["commit", "-q", "-m", "only the index page"]);

    const probe = spawnSync(process.execPath, [
      "--input-type=module", "-e",
      "import { missingProjectFiles } from './tools/admin/lib/git.mjs';" +
      "process.stdout.write(JSON.stringify(missingProjectFiles()));"
    ], {
      cwd: PROJECT,
      encoding: "utf8",
      env: Object.assign({}, process.env, { ADMIN_ROOT: repo })
    });

    let missing = [];
    try {
      missing = JSON.parse(probe.stdout || "[]");
    } catch (error) {
      missing = [];
    }

    check("repository: a site file that was never committed is reported",
      missing.includes("css/tokens.css") && missing.includes("tools/build-content.mjs"),
      JSON.stringify(missing));
    check("repository: a site file that is committed is not reported",
      !missing.includes("index.html"), JSON.stringify(missing));
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

/* ===================== the admin API ===================== */
{
  /* A throwaway copy of the whole project, so these checks can save, upload and
     publish against real files without touching the real ones. Pointing only the
     content file at a temp path was not enough: the server also serves the site,
     and the site loads the generated js/content.js from disk. */
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cozy-admin-"));
  const project = path.join(tempDir, "project");
  fs.cpSync(PROJECT, project, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(PROJECT, source);
      return relative !== ".git" &&
             !relative.startsWith(".git" + path.sep) &&
             relative !== path.join("tools", "admin", "backups");
    }
  });
  const tempContent = path.join(project, "js", "content.json");

  const port = 4399;
  const token = "verify-token";
  const admin = spawn(process.execPath, [path.join(project, "tools", "admin", "server.mjs")], {
    cwd: project,
    stdio: "ignore",
    env: Object.assign({}, process.env, {
      ADMIN_PORT: String(port),
      ADMIN_TOKEN: token,
      /* Otherwise the checks would keep opening browser windows. */
      ADMIN_NO_OPEN: "1"
    })
  });

  const base = "http://127.0.0.1:" + port;
  const auth = { "X-Admin-Token": token };
  const json = (headers) => Object.assign({ "Content-Type": "application/json" }, headers || {});

  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i += 1) {
      try {
        const probe = await fetch(base + "/api/schema", { headers: auth });
        up = probe.ok;
      } catch (error) {
        await new Promise((done) => setTimeout(done, 150));
      }
    }
    check("admin: the server starts and answers", up);
    if (!up) throw new Error("admin server never came up");

    const noToken = await fetch(base + "/api/content");
    check("admin: a request without the token is refused", noToken.status === 401,
      "status " + noToken.status);

    const wrongToken = await fetch(base + "/api/content", { headers: { "X-Admin-Token": "nope" } });
    check("admin: a request with the wrong token is refused", wrongToken.status === 401);

    const schemaResponse = await fetch(base + "/api/schema", { headers: auth });
    const schemaPayload = await schemaResponse.json();
    check("admin: the schema describes the products and their fields",
      schemaPayload.schema && schemaPayload.schema.products &&
      !!schemaPayload.schema.products.fields.slug);
    check("admin: the schema lists the editor tabs",
      Array.isArray(schemaPayload.tabs) && schemaPayload.tabs.length >= 4);

    const contentResponse = await fetch(base + "/api/content", { headers: auth });
    const content = await contentResponse.json();
    check("admin: the content loads", (content.data.products || []).length === 12 &&
      typeof content.mtime === "number");

    /* An invalid save must be refused, and it must say which field is wrong. */
    const broken = JSON.parse(JSON.stringify(content.data));
    broken.products[0].code = "";
    /* Normalisation tidies a category id into a slug, so the reachable failure
       is one that normalises away to nothing at all. */
    broken.categories[0].id = "!!!";
    broken.products[1].slug = broken.products[0].slug;
    const invalid = await fetch(base + "/api/content", {
      method: "POST", headers: json(auth),
      body: JSON.stringify({ data: broken, mtime: content.mtime })
    });
    const invalidPayload = await invalid.json();
    check("admin: an invalid save is refused", invalid.status === 400);
    check("admin: a blank reference code is named",
      (invalidPayload.errors || []).some((error) => error.path === "products[0].code"),
      JSON.stringify((invalidPayload.errors || []).slice(0, 4)));
    check("admin: an empty category id is named",
      (invalidPayload.errors || []).some((error) => error.path === "categories[0].id"));
    check("admin: a duplicate link name is named",
      (invalidPayload.errors || []).some((error) => error.path === "products[1].slug"));

    const untouched = JSON.parse(fs.readFileSync(tempContent, "utf8"));
    check("admin: a refused save writes nothing",
      untouched.products[0].code === content.data.products[0].code);

    /* A stale save must be refused rather than clobbering a newer file. */
    const stale = await fetch(base + "/api/content", {
      method: "POST", headers: json(auth),
      body: JSON.stringify({ data: content.data, mtime: content.mtime - 60_000 })
    });
    check("admin: a save based on an out-of-date file is refused", stale.status === 409);

    /* A good save must land on disk. */
    const edited = JSON.parse(JSON.stringify(content.data));
    edited.products[0].price = 1234;
    const saved = await fetch(base + "/api/content", {
      method: "POST", headers: json(auth),
      body: JSON.stringify({ data: edited, mtime: content.mtime })
    });
    const savedPayload = await saved.json();
    check("admin: a valid save is accepted", saved.status === 200 && savedPayload.ok === true);

    const onDisk = JSON.parse(fs.readFileSync(tempContent, "utf8"));
    check("admin: the save reached content.json", onDisk.products[0].price === 1234);
    check("admin: the generated file was rewritten too",
      fs.readFileSync(tempContent.replace(/\.json$/, ".js"), "utf8").includes('"price": 1234'));
    check("admin: a snapshot was kept so the save can be undone",
      fs.readdirSync(path.join(PROJECT, "tools", "admin", "backups")).length > 0);

    /* Uploads: the name is the only thing standing between a request and the
       filesystem, so a traversal attempt must be refused. */
    const traversal = await fetch(base + "/api/upload?dir=products&name=../../evil.webp", {
      method: "POST", headers: Object.assign({ "Content-Type": "image/webp" }, auth),
      body: Buffer.from("not really an image")
    });
    check("admin: an upload cannot escape the image folder", traversal.status === 400,
      "status " + traversal.status);

    const roundTrip = await fetch(base + "/api/upload?dir=products&name=zz-verify-1-800.png", {
      method: "POST", headers: Object.assign({ "Content-Type": "image/png" }, auth),
      body: Buffer.from("89504e470d0a1a0a", "hex")
    });
    check("admin: a well-named upload is accepted", roundTrip.status === 200);
    const uploaded = path.join(project, "assets", "img", "products", "zz-verify-1-800.png");
    check("admin: the upload landed in the products folder", fs.existsSync(uploaded));

    const removed = await fetch(base + "/api/delete-image", {
      method: "POST", headers: json(auth),
      body: JSON.stringify({ src: "assets/img/products/zz-verify-1-800.png" })
    });
    check("admin: the upload can be removed again", removed.status === 200 && !fs.existsSync(uploaded));

    const escapeDelete = await fetch(base + "/api/delete-image", {
      method: "POST", headers: json(auth),
      body: JSON.stringify({ src: "js/content.json" })
    });
    check("admin: a delete outside the image folders is refused", escapeDelete.status === 400);

    /* The tools folder must not be part of what the preview server hands out. */
    const tools = await fetch(base + "/tools/verify.mjs");
    check("admin: the tools folder is not served", tools.status === 404, "status " + tools.status);

    const editor = await fetch(base + "/admin/");
    check("admin: the editor page is served", editor.status === 200);

    const site = await fetch(base + "/index.html");
    check("admin: the site itself is served from the same address", site.status === 200);

    /* ---- the editor, in a browser ---- */
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const problems = watch(page);

    await page.goto(base + "/admin/?token=" + token, { waitUntil: "load" });
    await page.waitForSelector(".list__item", { timeout: 10000 });

    check("editor: every product is listed",
      (await page.locator(".list__item").count()) === 12,
      String(await page.locator(".list__item").count()));
    check("editor: the token is taken out of the address bar",
      !page.url().includes("token"), page.url());
    check("editor: a field is labelled from the schema",
      (await page.locator("[data-field='products[0].price']").count()) === 1);

    /* Element.append() renders a null as the text "null", which is a quiet way
       to litter the whole panel, so it is asserted rather than eyeballed. */
    const nameField = await page.locator("[data-field='products[0].name']").innerText();
    check("editor: no stray placeholder text is rendered",
      !nameField.includes("null") && !nameField.includes("undefined"), nameField);

    const priceBox = page.locator("[data-field='products[0].price'] input");
    await priceBox.fill("2499");
    check("editor: typing marks the page unsaved",
      (await page.locator("#save-state").innerText()).toLowerCase().includes("unsaved"));

    await page.locator("#save").click();
    /* Wait for a save that actually succeeded. Waiting for "unsaved" to
       disappear would have matched "Saving…" and raced the request. */
    await page.waitForFunction(
      () => /^Saved/.test(document.getElementById("save-state").textContent.trim()),
      { timeout: 15000 }
    );

    const afterUi = JSON.parse(fs.readFileSync(tempContent, "utf8"));
    check("editor: saving from the browser reaches the file", afterUi.products[0].price === 2499,
      String(afterUi.products[0].price));

    await page.screenshot({ path: path.join(SHOTS, "admin-products.png") });

    /* Checked before the deliberately bad save below, because a 400 response
       is logged by the browser as a console error and that one is expected. */
    check("editor: no console errors while editing", problems.length === 0, problems.join(" | "));
    const beforeInvalidSave = problems.length;

    /* A bad value must come back marked, not silently accepted. */
    await page.locator("#tabs .tab", { hasText: "Site" }).click();
    await page.locator("[data-field='home.heroHeading'] input").fill("");
    await page.locator("#save").click();
    await page.waitForSelector(".field--bad", { timeout: 10000 });
    check("editor: an empty required field is marked in place",
      (await page.locator("[data-field='home.heroHeading'].field--bad").count()) === 1);
    await page.screenshot({ path: path.join(SHOTS, "admin-validation.png") });

    const duringRefusal = problems.slice(beforeInvalidSave);
    check("editor: a refused save breaks nothing in the page",
      duringRefusal.every((entry) => !entry.startsWith("pageerror")),
      duringRefusal.join(" | "));

    /* Repeatable lists are the most intricate part of the panel and the most
       easily broken, so every one of them is drawn at least once. */
    await page.locator("#tabs .tab", { hasText: "Words" }).click();
    await page.waitForSelector("[data-field='about.reviews'] .row", { timeout: 10000 });
    check("editor: the reviews list draws its records",
      (await page.locator("[data-field='about.reviews'] .row").count()) === 2);
    check("editor: the materials list draws its rows",
      (await page.locator("[data-field='about.materials.items'] .row").count()) === 4);
    check("editor: the FAQ list draws its questions",
      (await page.locator("[data-field='contact.faq'] .row").count()) === 6);
    check("editor: the three ordering steps draw",
      (await page.locator("[data-field='process'] .row").count()) === 3);

    await page.locator("#tabs .tab", { hasText: "Categories" }).click();
    await page.waitForSelector("[data-field='categories'] .row", { timeout: 10000 });
    check("editor: the categories list draws its records",
      (await page.locator("[data-field='categories'] .row").count()) === 5);

    await page.locator("#tabs .tab", { hasText: "Site" }).click();
    await page.waitForSelector("[data-field='home.heroPhoto']", { timeout: 10000 });
    check("editor: the Site tab offers a hero photograph uploader",
      (await page.locator("[data-field='home.heroPhoto'] .drop").count()) === 1);

    /* The first-run setup form. Someone who has never published meets this
       before anything else in the panel, so it is worth knowing it appears and
       suggests a branch that matches what the guide tells them to expect. */
    await page.locator("#publish").click();
    await page.waitForSelector("#panel-body input[type='text']", { timeout: 10000 });
    const setupBoxes = await page.locator("#panel-body input[type='text']").count();
    check("editor: the setup form appears when nothing is connected yet",
      setupBoxes === 4, String(setupBoxes));
    const branchBox = await page.locator("#panel-body input[type='text']").last().inputValue();
    check("editor: it suggests main as the branch", branchBox === "main", branchBox);
    await page.locator("#panel-close").click();

    const afterLists = problems.slice(beforeInvalidSave);
    check("editor: drawing every list raises no page error",
      afterLists.every((entry) => !entry.startsWith("pageerror")),
      afterLists.join(" | "));

    /* ---- a photograph, all the way through ----
       Photographs start transparent and are revealed on load, so a failure in
       that path would leave every product picture invisible on the live site.
       That deserves a real file rather than an assumption, so one is drawn in
       the browser through the same canvas path the editor uses. */
    const prepared = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 48;
      const painter = canvas.getContext("2d");
      painter.fillStyle = "#8cb3c9";
      painter.fillRect(0, 0, 64, 48);
      painter.fillStyle = "#2b2353";
      painter.fillRect(16, 12, 32, 24);
      const blob = await new Promise((done) => canvas.toBlob(done, "image/webp", 0.8));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
      return { base64: btoa(binary), type: blob.type };
    });
    check("admin: the browser prepares a WebP, as the editor does",
      prepared.type === "image/webp", prepared.type);

    const photoUpload = await fetch(base + "/api/upload?dir=products&name=zz-verify-1-800.webp", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "image/webp" }, auth),
      body: Buffer.from(prepared.base64, "base64")
    });
    check("admin: a real photograph uploads", photoUpload.status === 200,
      "status " + photoUpload.status);

    const latest = await (await fetch(base + "/api/content", { headers: auth })).json();
    const withPhoto = JSON.parse(JSON.stringify(latest.data));
    withPhoto.products[0].images = [{
      src: "assets/img/products/zz-verify-1-800.webp",
      srcset: "",
      width: 64,
      height: 48
    }];
    const photoSave = await fetch(base + "/api/content", {
      method: "POST",
      headers: json(auth),
      body: JSON.stringify({ data: withPhoto, mtime: latest.mtime })
    });
    check("admin: a product can be given a photograph", photoSave.status === 200,
      "status " + photoSave.status);

    await page.goto(base + "/shop.html", { waitUntil: "load" });
    await page.waitForSelector("[data-render='products'] .tile__media > img", { timeout: 10000 });
    await page.waitForFunction(() => {
      const image = document.querySelector("[data-render='products'] .tile__media > img");
      return !!image && image.complete && image.naturalWidth > 0;
    }, { timeout: 10000 });

    /* It arrives transparent and fades in, so wait for the fade to finish
       rather than reading it part way through. */
    let settled = true;
    try {
      await page.waitForFunction(() => {
        const image = document.querySelector("[data-render='products'] .tile__media > img");
        return !!image && parseFloat(getComputedStyle(image).opacity) > 0.99;
      }, { timeout: 8000 });
    } catch (error) {
      settled = false;
    }

    const opacity = await page.locator("[data-render='products'] .tile__media > img")
      .first().evaluate((node) => getComputedStyle(node).opacity);
    check("site: a product photograph settles fully visible, never left transparent",
      settled && parseFloat(opacity) > 0.99, "opacity " + opacity);

    check("motion: no photograph is left waiting to arrive",
      await page.evaluate(() => Array.from(document.querySelectorAll("img[data-reveal]"))
        .every((node) => node.classList.contains("is-revealed") ||
                         getComputedStyle(node).opacity === "1")));

    await page.screenshot({ path: path.join(SHOTS, "shop-with-photo.png") });

    await context.close();
  } catch (error) {
    check("admin: the checks ran to completion", false, String(error.message || error));
  } finally {
    admin.kill();
    /* The whole copy goes, so nothing these checks wrote — uploads included —
       can ever reach the real project. */
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

await browser.close();
if (siteServer) siteServer.close();

/* ===================== report ===================== */
const failed = results.filter((r) => !r.ok);
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.detail ? "   [" + result.detail + "]" : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
