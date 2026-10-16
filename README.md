# Cozy Stitches — website

> **Setting this up for the first time, or not a programmer?**
> Read [START-HERE.md](START-HERE.md) instead. It walks through the whole thing
> one click at a time, from nothing to a live site. This file is the reference
> for whoever looks after the project afterwards.

A hand-written static site for the Cozy Stitches Facebook page: a catalog of
hand-embroidered bags, pouches, bangles and earrings that sends every order to
Messenger or WhatsApp with the item and its reference code already written out.

There is no framework and nothing to install: the files in this folder are the
files that get served. The content, though, lives in a data file rather than in
the markup, and there is a small editor for it that runs on your own computer:

```
npm run admin
```

That prints a link. Open it, change anything, press Save, and press Publish to
send it live.

```
cozy-stitches/
  index.html            hero, categories, featured work, how ordering works
  shop.html             the catalog: filters, grid, product detail dialog
  about.html            the studio, the mark, materials, care, reviews
  contact.html          how to order, delivery, payment, FAQ, channels
  404.html              not-found page
  css/
    tokens.css          colours, type scale, spacing, the stitch motif
    base.css            reset, typography, focus, skip link
    layout.css          shell, header, footer, sections, grids
    components.css      buttons, product tiles, chips, dialog, gallery
  js/
    content.json        ← ALL THE CONTENT LIVES HERE
    content.js          generated from content.json — do not edit
    render.js           turns the content into markup
    site.js             navigation, filtering, the dialog, copy-to-clipboard
  assets/img/brand/     logo, favicons, social card
  assets/img/products/  product photographs
  assets/img/hero/      the home page's large photograph
  tools/
    build-content.mjs   content.json → content.js
    admin/              the editor: server, schema, validation, interface
    make-brand-assets.mjs
    verify.mjs          the browser test suite
```

Nothing in `js/` other than `content.json` needs touching, and in practice you
will not touch that either — the panel writes it.

## Preview it

Double-click `index.html`. It works straight from disk — no server needed.

For a closer-to-live preview, run either of these from this folder and open
http://127.0.0.1:8099 :

```
python -m http.server 8099
npx serve -l 8099
```

## Editing the site

```
npm run admin
```

One command, no install. It starts a small editor at a `127.0.0.1` address and
prints the link — including a token on the end, which is what stops other pages
open in your browser from reaching it. Leave the terminal window open while you
work; press Ctrl+C when you are done.

The panel is served from your own computer only. Nothing about it goes online,
and it works with no internet connection.

**Products** — add, duplicate, reorder and remove. Every field the site shows:
name, link name, category, reference code, price, the descriptions, materials,
care, the photograph description.

- *Price* left empty shows “DM for price”. Fill it in and the shop shows
  `৳2,400` instead.
- *Feature on the home page* puts the piece in the mosaic. Six fill it exactly.
- *Photographs* accepts files dragged straight from your phone or desktop. They
  are resized to 800px and 1600px and converted to WebP **in the browser**,
  before anything is uploaded, so a 6 MB phone photo becomes roughly 150 KB and
  the site stays quick on mobile data. Re-encoding also strips the camera's
  location data, so a photograph can never give away where it was taken.
- *Link name* becomes the shareable address. Leave it blank and it fills itself
  in from the name.

**Categories** — the shop's filter buttons and the home page cards. A category
that still has products in it cannot be removed until they are moved.

**Site** — the brand name and tagline, where orders come in, the message a
customer sends, the hero photograph, the home page words and the footer.

**Words** — the ordering steps, the whole About page, delivery and payment, and
the questions.

### Saving and publishing

**Save** writes to your computer. It checks everything first and marks any
field it does not like in red; a save that fails changes nothing.

**Publish** commits your changes and pushes them to GitHub, and your host
rebuilds the live site a minute or two later. It commits the **whole project** —
the pages, the stylesheets, the build tool and the content together — because a
repository holding only the content is a repository the host cannot build a
website from. `.gitignore` is what keeps junk out.

**History** lists a copy of the content from before each save, with a Restore
button. Every save keeps one automatically, twenty deep.

### If something looks wrong

```
npm run doctor
```

prints what the Publish button checks: whether git knows who you are, whether a
GitHub repository is connected, and whether there is anything waiting to go out.

## Add photographs

The usual way is to drag them into the panel. If you would rather put files in
place by hand, `assets/img/products/README.md` explains the naming.

Until a product has a photograph, the site draws a branded placeholder tile
rather than a broken image, so nothing looks unfinished while you are still
photographing a piece.

## Going live for the first time

Publishing from the panel pushes to GitHub, and GitHub tells your host to
rebuild. So the setup is: put this folder on GitHub once, connect the host to it
once, and then never think about deploying again.

### 1. Put the project on GitHub

Create an empty repository on github.com. It must start empty — no README, no
`.gitignore`. Then open the panel's Publish step, paste its address, and press
**Save this setup**: that sets the remote and the branch name for you.

The first time you publish, git opens a GitHub sign-in window. Approve it once
and it will not ask again on this computer.

### 2. Connect the host

- **Netlify** — Add new site → Import an existing project → GitHub → pick the
  repository. `netlify.toml` already sets the build command and the publish
  directory, so change nothing in the form. Every push from the panel then
  deploys itself.
- **Cloudflare Pages** — much the same, but it does not read `netlify.toml`.
  Set the build command to `node tools/build-content.mjs` and the output
  directory to `/` by hand.
- **GitHub Pages** — Settings → Pages → deploy from the `main` branch. No build
  step runs there, so the published content is whatever was committed; the panel
  keeps the generated file in step, so that is fine.

Dragging the folder onto https://app.netlify.com/drop still works too, as it did
before, if you would rather not use GitHub.

`_redirects` and `_headers` are read by Netlify and Cloudflare. GitHub Pages
ignores both, which only affects caching and keeping `tools/` out of the way.

### Before you go live

1. Add your WhatsApp number in the panel (Site → Where orders come in). Digits
   only, country code first: `8801712345678`. Messenger and Instagram are
   already set to `cozy.stitches07` and `cozy_stitches007`.
2. Replace `https://REPLACE-WITH-YOUR-DOMAIN` throughout `sitemap.xml`, then
   uncomment the `Sitemap:` line in `robots.txt`.
3. In each of the four page files, uncomment the `canonical` and `og:url` lines
   near the top and set your real domain. The 404 page is `noindex` and needs
   nothing.
4. Read the delivery and payment lines in the panel (Words → Contact page). They
   are written to be true without inventing numbers you have not given us.
5. Decide about the two customer reviews (Words → About page). They are quoted
   without names; only use a real name if that customer agreed.

`CONTENT-GUIDE.md` on the next desk over lists what is still needed.

## Version control

A git repository is already initialised here, and the panel does the parts that
matter:

- **It sets your git identity** when you fill it into the Publish step. There is
  nothing to configure in a terminal.
- **It commits the whole project**, not only the content. There is nothing to do
  by hand — but it does mean `git status` is worth a glance before publishing if
  you have added files you would rather not put in the repository.
- **`npm run doctor` says what is missing.** In particular, whether the
  repository actually contains the site's own files. A repository holding only
  the content is one the host cannot build from, and this is where that shows up.

The panel's own History list is the friendlier way to undo a mistake: it holds
snapshots from before each save, including saves you never published.

## Regenerate the brand images

There are three pieces of artwork, and each exists for a different size. All
three are documented in place.

| File | Used for |
|---|---|
| `logo.svg` | Your original file, unmodified. The hero frame while a photograph is missing, the mark section on About, the 404 page, and the generated social card. |
| `mark.svg` | The emblem lifted out of it, enlarged and re-weighted. The header, the footer, and the product placeholders. |
| `favicon.svg` | A heavier build of the same emblem that still reads at 16px. Tab icons only. |

The header uses the emblem rather than the full logo on purpose: the full logo
is a square whose wordmark would be about 3px tall at the 40px a header allows.
The emblem plus real text is the same identity, legible.

Favicons, the app icon and the social card are all generated from that artwork
with the same rendering engine a browser uses, so they are pixel-exact. Colours
and font families are read out of `css/tokens.css`, so the tokens file stays the
single source of truth. After changing a colour there, or swapping the artwork:

```
npm install --no-save playwright
node tools/make-brand-assets.mjs
```

Playwright is the only extra tool involved, and you already need it for the
verification suite. The generator reads the artwork and `css/tokens.css`; there
is no redrawing of the logo anywhere in the project and no Python involved.

## Verify it still works

`tools/verify.mjs` drives every page in a real browser and asserts 141 things:
that all twelve products render, that filters and deep links work, that every
order button produces the right URL, that the dialog is keyboard-operable and
returns focus, that there is no horizontal overflow down to 320px, that the hero
keeps its 3:2 frame, that no text falls below WCAG AA contrast, that the opening
grid never animates and a photograph is never left invisible, that
`prefers-reduced-motion` removes movement without removing feedback — and, for
the panel, that the content file and the generated file agree, that every
referenced photograph exists, that a save with a mistake in it is refused and
names the field, that an upload cannot escape the image folder, and that the
editor draws every one of its repeatable lists.

```
npm install --no-save playwright
node tools/verify.mjs
```

It starts its own preview server and its own copy of the panel, pointed at a
throwaway content file, so running it never touches your real content. Run it
after a batch of changes, or after editing anything in `tools/`. Playwright is
deliberately *not* a dependency of the site itself — the site has no
dependencies at all.

## How it is built, and why

- **Content is data, not markup.** `js/content.json` holds everything, the
  panel edits it, and `tools/build-content.mjs` turns it into the `window.COZY`
  global the pages load. Keeping that one generated file means the site still
  works when you double-click `index.html` — `fetch` and ES modules are blocked
  on `file://`, so a JSON file read at runtime would have broken local preview.
  Your host runs the same generator on deploy, so the two files cannot drift.
- **The panel is local, by design.** A server that can write files and accept
  uploads belongs on your machine, not on the internet. It binds to `127.0.0.1`
  and requires a fresh token each time it starts, because anything on localhost
  is reachable by any page you happen to have open.
- **The editor and the validator share one schema.** `tools/admin/schema.mjs`
  describes every field once; the browser builds the form from it and the server
  checks saves against it. A field cannot be added to one without the other.
- **Photographs are resized in the browser, not on a server.** The browser's own
  encoders produce WebP, which is why this project needs no image library.
- **Relative paths everywhere**, never root-absolute, so hosting on a subpath
  works without configuration.
- **Progressive enhancement.** The mobile menu is only collapsed when
  JavaScript is available; the dialog falls back to a plain `open` attribute
  where `showModal` is missing. Each page carries a `<noscript>` block with a
  direct Facebook link, because the catalog itself is rendered by JavaScript.
- **Motion is one curve and three durations, and it is rationed.** The hero's
  stitch drawing itself is the single orchestrated moment. Everything else is
  either a response to your finger — buttons squeeze by 3%, for 130ms — or a
  bridge for something that would otherwise teleport: a dialog growing into
  place, tiles arriving after a filter, the menu dropping in, a photograph
  fading in as it loads. Nothing animates on first paint, and nothing you would
  see a hundred times a day is animated at all. Under
  `prefers-reduced-motion` the movement is removed but colour and opacity
  stay, so a control still answers you instead of appearing broken.
- **One radius token (2px), and the two typefaces the logo itself declares.**
  Playfair Display is the wordmark's face and is used for page and section
  titles; Montserrat is the tagline's face and carries everything read at
  length, with a Bengali fallback for `কাঁচ`. The visual identity otherwise
  comes straight from the artwork: the ink `#2b2353`, the badge `#8cb3c9`, the
  canvas `#7ba0b8`, and the logo's own 16px dot grid, which becomes the ground
  the product placeholders sit on. A running-stitch motif — the hero's drawn
  line, the seam between a product photo and its label, the section dividers —
  comes from the heart's dashed left half.

### Deliberately not built

No cart, checkout or payment gateway — orders go to a message, as they always
have. No online backend, database or login: the panel is a local tool, so there
is no service to pay for, keep patched, or lose. No user accounts, no drafts or
scheduled posts, no rich-text editor, no image cropping or background removal,
and no order or stock tracking. No Bengali translation: the copy is English with
Bengali product names kept as they are, though the type stack is ready for it.
No dark theme.

Adding a real shop later would keep this content model and replace the ordering
layer.

### Browser support

The site: current Chrome, Edge, Safari and Firefox. It relies on `aspect-ratio`,
`<dialog>`, `backdrop-filter`, `:focus-visible` and CSS Grid. Where `showModal`
is missing the product dialog degrades to an inline panel rather than an
overlay — usable, not pretty.

The panel: any current browser, and it needs `createImageBitmap` and canvas
`toBlob` to prepare photographs, which every current browser has. It also needs
Node 18 or newer to run, which you already have.
