# What to send us

> Never done any of this before? Read [START-HERE.md](START-HERE.md) first. It
> covers installing, publishing and everyday use, one click at a time.

Most of this list has moved into the admin panel. Start it with:

```
npm run admin
```

and everything below marked **in the panel** is a form field with a Save button.
Only two things are still genuinely blocked on files from you.

---

## 1. Product photographs — the big one

This matters more than anything else here. The site is built to sell handwork,
and right now every product shows a branded placeholder tile instead of a
picture.

**How:** open the panel → Products → pick a product → drag the photographs into
the Photographs box. That is the whole job. They are resized to 800px and
1600px, converted to WebP and stored on your computer; you will see a cover
badge on the first one, and you can reorder them or make a different one the
cover.

**What to send:** the originals from your camera or phone. Landscape, roughly
3:2 or 4:3. **Not** the screenshots you showed us — those were about 200 pixels
wide and far too small to use.

A few things worth knowing:

- **iPhone photos in HEIC format** cannot be read by Chrome. If the panel
  refuses them, set Camera → Formats → Most Compatible on the phone, or send the
  picture as a JPEG. Safari reads them fine.
- Resizing happens before upload, so a 6 MB photo becomes roughly 150 KB and the
  site stays quick on mobile data.
- Re-encoding strips the camera's location data, so a photograph can never give
  away where it was taken.
- **The photograph description** field on each product is read aloud by screen
  readers and shown if a picture fails to load. Describe the photograph rather
  than repeating the product name.

---

## 2. A hero photograph

The home page's large frame currently shows your logo. A single strong landscape
photograph — a finished piece being worn, like your cover photo — would be
better. Upload it in the panel at **Site → Home page → Hero photograph**.

It wants to be about 3:2 and at least 1600 pixels wide.

---

## Everything else is a form field now

### In the panel, under Site

| What | Where |
|---|---|
| Your WhatsApp number | Site → Where orders come in. Digits only, country code first: `8801712345678` |
| Your Messenger page name | Already set to `cozy.stitches07` |
| Your Instagram name | Already set to `cozy_stitches007` |
| An email for wholesale enquiries | Site → Where orders come in |
| The message a customer sends | Site → The order message. `{name}` becomes the product name, `{code}` its reference |
| The home page words | Site → Home page |
| The footer note and links | Site → Footer |

### In the panel, under Words

| What | Where |
|---|---|
| Delivery charges and timing | Words → Contact page → Delivery |
| Payment methods | Words → Contact page → Payment |
| The questions and answers | Words → Contact page → Questions |
| The About story, materials and care | Words → About page |
| The two customer reviews | Words → About page → Customer reviews |

**The delivery and payment lines are written to be true without inventing
numbers you have not given us.** They currently say things like "Message us your
full address and we will confirm the exact charge before anything is paid."
Replace them with your real figures — `Inside Dhaka — ৳80, 1 to 2 days` — when
you are ready to publish them.

**The two reviews are quoted without names**, as "Verified buyer". Only put a
real name in if that customer agreed to it.

### In the panel, under Products and Categories

Prices. Every product currently shows "DM for price", matching how your page
works today. Type a number into the Price field and the shop shows `৳2,400`
instead. Mixing the two is fine — an empty price falls back to whatever the
"Instead of a price, show" field says.

Categories. Add, rename and reorder freely. A category that still has products
in it cannot be removed until you move them somewhere else.

---

## 3. Your domain

Nothing needs a domain yet. It becomes relevant in four places, all in
`README.md` under "Before you go live": `sitemap.xml`, `robots.txt`, the
`canonical` and `og:url` lines in the four page files, and the hosting provider.

Until then, a free `*.netlify.app` or `*.github.io` address works exactly as
well, because every path in the site is relative.

---

## Worth checking once you are set up

- **Whether `m.me` can pre-fill the message.** Every Messenger button carries
  the product reference as a tracking parameter, and a "Reference CS-PCH-01 —
  copy" chip sits beside the order buttons so a buyer can paste the item into the
  chat. Facebook documents `?ref=` but not pre-filled message text, so the site
  does not claim the latter. If you test
  `https://m.me/cozy.stitches07?text=hello` and the message arrives already
  typed, tick **Site → The order message → Also send the message to Messenger**.
- **Whether you want a Bengali version.** The type stack already carries a
  Bengali face so `কাঁচ` renders correctly today, but translating the copy is
  real work.
- **Whether you want a care guide or a blog.** Not built. It would fit without
  disturbing anything.
- **Product names, codes and descriptions.** The twelve products were written
  from your photo albums. The names, the codes like `CS-PCH-01`, and all the
  copy are ours, and every one of them is a field in the panel.
