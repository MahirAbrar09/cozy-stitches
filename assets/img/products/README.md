# Product photographs

**The normal way to fill this folder is the admin panel**, not by hand:

```
npm run admin     →  Products  →  pick a product  →  drag photographs in
```

The panel is much less work and it does three things this folder's convention
cannot do on its own: it resizes and converts each photograph for the web, it
strips the camera's location data, and it writes the right entry into the
content file for you.

What follows is the manual route, for when you would rather move files yourself.

## How a stored photograph is shaped

Each photograph becomes two files, at two widths, so a phone on a slow
connection does not download a large image to fill a small space:

```
assets/img/products/bow-garden-tote-1-800.webp
assets/img/products/bow-garden-tote-1-1600.webp
```

`bow-garden-tote` is the product's link name, `1` counts the photographs on that
product, and `800` / `1600` is the width in pixels. Both files are the same
picture at different sizes.

The content file then holds one entry per photograph, referring to both:

```json
{
  "src": "assets/img/products/bow-garden-tote-1-1600.webp",
  "srcset": "assets/img/products/bow-garden-tote-1-800.webp 800w, assets/img/products/bow-garden-tote-1-1600.webp 1600w",
  "width": 1600,
  "height": 1200
}
```

`width` and `height` are what stop the page jumping about as photographs arrive.
`srcset` is what lets the browser choose.

**Photographs are not renamed if you later change the product's link name.** The
content file stores full paths, so a mismatch is harmless, and renaming files
halfway through a save that might still be rejected would be worse than an
untidy folder.

## What the photographs should be

- **Landscape, roughly 3:2 or 4:3.** Tiles are 4:3; the home page's hero frame
  is 3:2. Portrait phone photographs get cropped at the edges.
- **At least 1600 pixels on the long edge** for the large version, so the images
  stay sharp on phones with high-density screens.
- **Under about 300 KB each.** The panel's conversion lands well inside that.
- **Consistent light.** The existing product shots are photographed flat on
  fabric in daylight; matching that makes the grid look like one body of work.

## The generated content file

`js/content.js` is written by `tools/build-content.mjs` from `js/content.json`.
Editing it by hand achieves nothing — the next save or deploy overwrites it. Edit
`js/content.json` directly if you must, then run:

```
npm run build
```

To rebuild the favicons and the social card after a logo or colour change:

```
npm run assets
```
