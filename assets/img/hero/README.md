# The home page's large photograph

One picture lives here: the frame beside the headline on the home page.

**Upload it through the panel** rather than by hand:

```
npm run admin     →  Site  →  Home page  →  Hero photograph
```

Until there is one, that frame shows your logo instead, which is deliberate — the
one finished piece of artwork the brand owns is doing work rather than sitting
unused.

## What works best

- **Landscape, about 3:2.** The frame is fixed at 3:2, so anything else is
  cropped at the edges.
- **At least 1600 pixels wide.**
- **A finished piece being worn or held**, not a flat lay. It is the first thing
  anyone sees, and the shop grid already covers flat product shots.

It is stored as two WebP files, `hero-800.webp` and `hero-1600.webp`, by the same
pipeline that handles product photographs. See `../products/README.md` for how a
stored photograph is shaped and why `width` and `height` are recorded alongside
it.
