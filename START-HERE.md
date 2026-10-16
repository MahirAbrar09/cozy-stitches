# Start here

Everything you need to do, in order, written for someone who has never done any
of this before. No coding. Nothing to install except one free program, and that
only if your computer does not already have it.

**First time through: about 40 minutes.** After that, adding a product takes
about two minutes.

There are six parts. Parts 1 to 4 are the setup, and you only ever do them once.
Parts 5 and 6 are the everyday use.

---

## Four words, first

You will see these a lot, so here is what they actually mean.

| Word | What it means |
|---|---|
| **Terminal** | A black window where you type commands. You only ever type three of them, and they are all in this guide. |
| **GitHub** | An online filing cabinet. It stores your project and keeps every past version. Free. |
| **Netlify** | The company that shows your website to the world. Free for a site this size. |
| **Publish** | The button that sends your latest changes to GitHub. Netlify notices and rebuilds your live site, about a minute later. |

**Save** and **Publish** are different, and the difference matters:

- **Save** puts your change on your own computer. Only you can see it.
- **Publish** sends it out. Your customers see it about a minute later.

Nothing goes live until you press Publish. You can experiment freely.

---

# Part 0 — Before you begin

## 0.1 Move the folder out of OneDrive

Your project currently lives inside OneDrive. OneDrive tries to copy the folder
to the cloud **while** the tools are writing to it, which can tangle it up, and
it will slow everything down.

Move it somewhere local first. It takes ten seconds:

1. Close any black terminal windows you have open.
2. Open **File Explorer** and find the `cozy-stitches` folder inside your
   OneDrive Documents.
3. Click it once, then press **Ctrl+X** (cut).
4. In the left sidebar click **This PC**, then open **Windows (C:)**, then open
   the **Users** folder, then **sakib**.
5. Press **Ctrl+V** (paste).

The folder is now at `C:\Users\sakib\cozy-stitches`. Everything below refers to
that. You will never have to type that path — see the next step.

> **This folder is the only copy that matters.** If you ever find more than one
> `cozy-stitches` folder on your computer, the one at
> `C:\Users\sakib\cozy-stitches` is the real one — it is the one connected to
> GitHub. Editing any other copy changes nothing on your website.

> If you would rather not move it, you can skip this. Nothing will immediately
> break. But come back and do it if you ever see odd errors.

## 0.2 Open a terminal in the folder

1. In File Explorer, **open** the `cozy-stitches` folder so you can see
   `index.html`, `css`, `js` and `tools` inside it.
2. Click **once** on the thin address bar at the top of the window — the one
   showing the folder's path. It turns into editable text.
3. Type these three letters: **cmd**
4. Press **Enter**.

A black window opens. It should end with something like:

```
C:\Users\sakib\cozy-stitches>
```

That means you are in the right place. If it ends with something else, close it
and start this step again — the important part is that you were *inside* the
cozy-stitches folder when you typed `cmd`.

> **Every command in this guide is typed into that black window, followed by
> Enter.** Keep this section in mind, because you will do it every time you want
> to edit your site.

## 0.3 Check Node is installed

In the black window, type this and press Enter:

```
node -v
```

**You should see something like** `v24.19.0` or `v20.11.0`. Any number starting
with `v18` or higher is perfect. Move on to Part 1.

**If instead you see** `'node' is not recognized`, Node is not installed:

1. Go to **https://nodejs.org**
2. Download the big button that says **LTS**.
3. Run the installer and click Next through everything. Change nothing.
4. **Close the black window** and open a new one (§0.2), then run `node -v`
   again.

---

# Part 1 — See your site on your own computer

*About 5 minutes. No internet needed.*

In the black window, type:

```
npm run admin
```

Press Enter. Wait about five seconds.

**You should see:** a browser tab opens by itself, showing your editor with
tabs across the top reading **Products, Categories, Site, Words**.

**If no browser opens**, look in the black window for a long line starting with
`http://127.0.0.1:4321/admin/?token=`. Copy that entire line — all of it,
including the long jumble of letters and numbers at the end — paste it into your
browser's address bar, and press Enter.

### Try it out

1. You should be on the **Products** tab. Click any product in the list on the
   left.
2. Change the **Price** box to a number, say `2400`.
3. Click **Save** in the top right. The status turns green and says *Saved*.
4. Click **Open site** in the top right. Your shop opens, and that product now
   shows `৳2,400`.

That is the whole loop. Change something, Save, look at it.

> ### The one thing to remember
>
> **The black window must stay open** the whole time you are editing. The editor
> only exists while it is running.
>
> Closing it does **not** take your website down. Your live site lives on
> Netlify and keeps running on its own. Closing the window would only stop you
> editing for now.
>
> To stop the editor: click the black window and press **Ctrl+C**.

Nothing you do here is online yet. You are editing a copy on your own computer.
That is what **Publish** is for, in Part 3.

---

# Part 2 — Put your project on GitHub

*About 10 minutes. Free.*

GitHub is the online filing cabinet. It stores your project, and later it is how
Netlify knows your site changed.

1. Go to **https://github.com** and create an account if you do not have one.
   Skip to step 2 if you do.
2. Once you are signed in, click the **+** near the top right corner, then click
   **New repository**.
3. **Repository name:** type `cozy-stitches`
4. **This next bit is important.** Leave **Add a README file** *unticked*. The
   repository must start completely empty. If you tick that box, the first
   publish will fail and you will have to do the awkward fix in the
   troubleshooting table.
5. Leave everything else exactly as it is.
6. Click the green **Create repository** button.
7. You land on a page headed *Quick setup*. It shows a web address like
   `https://github.com/yourname/cozy-stitches.git`. There is a small **copy**
   button next to it. Click that copy button.

Keep that address on your clipboard, or paste it into a note. You need it in the
next step.

---

# Part 3 — Connect it and publish

*About 5 minutes.*

1. Go back to your editor tab (the one with Products / Categories / Site /
   Words).
2. Click **Publish** in the top right.
3. Because nothing is set up yet, it shows you a form. Fill in four boxes:

   | Box | What to put |
   |---|---|
   | **Your name** | Your own name. This labels your changes; only you see it. |
   | **Your email** | The email you signed up to GitHub with. |
   | **GitHub repository** | Paste the address you copied, ending in `.git` |
   | **Branch** | Leave it as `main` — it is already filled in |

4. Click **Save this setup**. You should see four ticks.
5. Click **Publish** again.
6. **A GitHub window will open** asking you to sign in and authorise. Sign in
   with the same account. Click **Authorize** / **Sign in**.

   This is git asking permission to send your files to GitHub. It happens **only
   the first time**. After this, publishing is one click.

7. Back in the panel you should see a green box saying *Sent to GitHub*.

**You should see:** *Sent to GitHub. Your host will rebuild in a minute or two…*

There is no host yet, so nothing appears online. That is Part 4.

> **If the GitHub window never appeared** and the panel says the push failed,
> just click **Publish** again. It retries and the window should open this time.

---

# Part 4 — Make it live on the internet

*About 10 minutes. Free.*

1. Go to **https://netlify.com**
2. Click **Sign up**, and choose **Sign up with GitHub**. (Doing it this way
   means Netlify and GitHub are already introduced to each other.)
3. It asks to authorise Netlify to read your repositories. Click **Authorize**.
4. In the Netlify dashboard, click **Add new site**, then
   **Import an existing project**.
5. Choose **GitHub**. It lists your repositories. Click **cozy-stitches**.
6. It shows a build settings form. Your project already contains a file that
   fills this in, so you should see:

   - **Build command:** `node tools/build-content.mjs`
   - **Publish directory:** `.`

   **Leave both exactly as they are.** If either box is empty, type what is
   shown above.

7. Click **Deploy site**. You will see a build log scrolling past. Wait about a
   minute.
8. When it says **Published**, click the address it shows — something like
   `https://cheerful-panda-123456.netlify.app`. **That is your live website.**

### If Netlify asks you to keep the site private

A new Netlify site can start **protected**, which means only you can see it —
everyone else gets a login page. There is often a bar along the bottom of the
browser saying **Private** … **Make public**.

1. Click **Make public** on that bar.
2. If it is not there, go to **Site configuration** → **Access & security** and
   turn site protection off.

Your site is not really live until you do this. Test it in a private window, or
on your phone with wi-fi turned off, so you are not signed in as yourself.

### Give it a nicer address

That random name works, but you can change it once:

1. In Netlify, click **Site configuration**.
2. Click **Change site name**.
3. Type `cozy-stitches` (or anything you like, as long as it is not taken).
4. Your address becomes `https://cozy-stitches.netlify.app`.

### Test the whole loop

Do this once, so you know it works end to end:

1. In the editor, change a price.
2. Click **Publish**.
3. Wait one minute.
4. Open your live address and press **Ctrl+F5** (a full refresh).
5. Your change is there.

**You are done setting up.** From here on it is just Part 5.

---

# Part 5 — The everyday routine

This is the whole thing, every time:

1. Open a terminal in the folder (§0.2 — address bar, type `cmd`, Enter).
2. Type `npm run admin` and press Enter.
3. The editor opens in your browser. Make your changes.
4. Click **Save**. Check it looks right using **Open site**.
5. Click **Publish**.
6. Wait a minute, then refresh your live address to confirm.
7. Press **Ctrl+C** in the black window when you are finished.

That is it. Steps 3 and 4 are where you will spend your time; 1, 2, 6 and 7 are
mechanical.

### Adding a product

1. **Products** tab → **Add a product**.
2. Fill in the name. The **Link name** fills itself in — leave it.
3. Pick a **Category**.
4. Give it a **Reference code**, like `CS-BAG-04`. Keep it short and different
   from every other one.
5. Drag photographs into the **Photographs** box. Do this from your phone or
   computer; they get shrunk and prepared automatically.
6. Put a number in **Price**, or leave it empty to show "DM for price".
7. **Save**, then check it with **Open site**, then **Publish**.

### Changing a price

**Products** → click the product → change **Price** → **Save** → **Publish**.

### Undoing a mistake

Click **History** in the top right. It lists a copy of your content from before
every save. Find the one from before the mistake, click **Restore**, then
**Save** and **Publish**.

Nothing is ever really lost. Old versions are also kept in GitHub for ever.

---

# Part 6 — Put your real details in

These are the things the site is currently guessing at. All of them are in the
editor; none of them need a terminal.

### 1. Your WhatsApp number — most important

**Site** tab → **Where orders come in** → **WhatsApp number**.

Digits only, country code first, no `+`, no spaces:

```
8801712345678
```

Until you do this, the WhatsApp buttons stay hidden. That is deliberate — a
button that leads nowhere is worse than no button.

### 2. Your photographs

**Products** → each product → drag photographs in. This matters more than
everything else on this page. Right now every product shows a placeholder tile.

The originals from your phone or camera are perfect. Landscape, roughly the
shape of a postcard. **Not** the screenshots you showed me — those were far too
small to use.

**Site** → **Home page** → **Hero photograph** takes one big landscape photo for
the top of the front page. Until you add one, that space shows your logo.

### 3. Delivery and payment

**Words** → **Contact page**. The **Delivery** and **Payment** boxes currently
say things like *"Message us your full address and we will confirm the exact
charge before anything is paid."* They are written to be true without inventing
numbers. Replace them with your real ones:

```
Inside Dhaka - ৳80, 1 to 2 days
Outside Dhaka - ৳130, 2 to 4 days
```

### 4. The two reviews

**Words** → **About page** → **Customer reviews**. They are currently quoted
without names, as "Verified buyer". Only put a real name in if that customer
said it was alright.

### 5. Your own web address (optional, costs money)

`cozy-stitches.netlify.app` is free and fine. If you want
`cozystitches.com` one day, buy the name (about ৳1200 a year from a registrar
like Namecheap), then in Netlify go to **Domain management** → **Add a domain**
and follow the instructions.

There is one extra job after that, because the site needs to be told its own
address for search engines. Those are the four lines in the files marked
`canonical` — ask me when you get there and I will do it.

---

# When something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| `'node' is not recognized` | Node is not installed | §0.3 — install it from nodejs.org, then close and reopen the black window |
| `'npm' is not recognized` | Same thing | Same thing |
| No browser opened when you ran `npm run admin` | Nothing is broken | Copy the long `http://127.0.0.1:4321/...` line from the black window into your browser |
| `Port 4321 is already in use` | You already have the editor running in another window | Find the other black window and press Ctrl+C in it. Or just use the one already open. |
| `EADDRINUSE` | Same as above | Same as above |
| The editor says *"This editor session has expired"* | The black window was restarted, so the old link is stale | Open the newest link from the black window |
| Publishing says *"could not be sent to GitHub"* | The GitHub sign-in did not finish | Click **Publish** again and approve the window that appears |
| Publishing says *"GitHub has changes your folder does not have"* | Something was uploaded or edited on the GitHub **website**, so the two sides disagree | See "If publishing says the push was rejected" below |
| Publishing says *"no GitHub repository is connected"* | Part 3 was not finished | Click **Publish**, fill in the four boxes, **Save this setup** |
| Netlify says the deploy **failed** | Usually a photograph the content refers to is missing | Open the editor, re-add that product's photographs, Save, Publish. The build will pass. |
| **Your live address shows an error**, or a page mentioning a *Request ID* | GitHub is missing the website's own files, so Netlify has nothing to build | In the black window run `npm run doctor`. If it lists missing files, open the editor and press **Publish** — that adds them. |
| The live site looks unchanged after Publish | Netlify is still building | Wait a minute and press **Ctrl+F5** |
| I lost the editor link | It changes every time | Run `npm run admin` again — it prints a new one |
| I want to check what is missing | — | In the black window: `npm run doctor` |

### If publishing says the push was rejected

You will see something like:

```
! [rejected]  main -> main (fetch first)
hint: Updates were rejected because the remote contains work that you do not have locally
```

This means **GitHub has something your folder does not** — almost always because
a file was added or changed on the GitHub *website* rather than in the panel.
Both sides then have work the other is missing, and git stops rather than guess.

Nothing is lost, and your work is safe on your computer. To put it right, open a
terminal in `C:\Users\sakib\cozy-stitches` and run these three commands, one at a
time:

```
git fetch origin
git reset --soft origin/main
git add -A
git commit -m "Publish everything from my folder"
```

Then click **Publish** in the panel again. It will go through.

**What those commands do, in plain words.** The first fetches whatever GitHub
has. The second says "start from GitHub's latest, but do not touch a single file
on my disk". The third and fourth make one new commit that describes your folder
exactly as it is now. The result is that GitHub's work is kept, and your folder
is added on top of it.

**To avoid this happening again:** change things in the panel, not on the GitHub
website. The website is fine for *looking* at your project; the panel is how you
edit it.

### If you ticked "Add a README" when creating the GitHub repository

The very first publish will refuse to work, because GitHub already has a file
you do not. That is the same rejection described above, and the same three
commands fix it.

---

# What lives where

Worth understanding, because it explains why closing a window never takes your
site down.

| Thing | Where it lives | When it is available |
|---|---|---|
| **Your live website** | Netlify | Always. 24 hours a day, whether your computer is on or not. |
| **The editor** | Only your computer, only while the black window is open | While you are working |
| **Your project files** | `C:\Users\sakib\cozy-stitches` | Always |
| **Every version you have ever published** | GitHub | Always |
| **Quick undo copies** | The **History** button | Always |

**Never share the editor link.** The long jumble of letters at the end of it is
the only thing stopping other pages on your computer from changing your site.
Close the black window when you are done and the link stops working entirely.

---

# What this costs

Nothing.

- GitHub: free.
- Netlify: free for a site this size. Their free tier gives you 100 GB of
  traffic a month; your site is under 1 MB in total.
- Your own web address, if you want one: about ৳1200 a year. Entirely optional.

---

# You do not need to worry about

- **The site going down when you close your laptop.** It will not.
- **Breaking something permanently.** Every save keeps a copy, and every publish
  keeps a copy in GitHub. Everything can be undone.
- **The site getting slower as you add products.** Photographs are shrunk
  automatically before they are stored.
- **The `tools` folder or the other files you do not recognise.** You never need
  to open them. The editor is the only part you use.
