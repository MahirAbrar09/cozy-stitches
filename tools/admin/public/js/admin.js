/* ==========================================================================
   Cozy Stitches — admin panel
   --------------------------------------------------------------------------
   Boot, tabs, the products list, save, publish and history.

   The panel is deliberately small: it holds the content object, patches fields
   inside it, and posts the whole thing back. The server is what decides whether
   a save is acceptable, so the browser is never trusted.
   ========================================================================== */

import { h, getAt, pathKey, slugify, renderField, uploadFiles } from "./fields.js";

const state = {
  token: "",
  tabs: [],
  schema: null,
  data: null,
  mtime: 0,
  dirty: false,
  tab: "",
  selected: null,
  errors: new Map(),
  filter: { q: "", category: "" }
};

const view = document.getElementById("view");
const tabsEl = document.getElementById("tabs");
const stateEl = document.getElementById("save-state");
const panel = document.getElementById("panel");
const panelTitle = document.getElementById("panel-title");
const panelBody = document.getElementById("panel-body");

/* ====================== talking to the server ====================== */

async function api(path, options = {}) {
  const headers = Object.assign({ "X-Admin-Token": state.token }, options.headers || {});
  if (options.body) headers["Content-Type"] = "application/json";

  const response = await fetch(path, Object.assign({}, options, { headers }));
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "The server refused that request.");
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

/* ====================== small pieces of chrome ====================== */

let toastTimer;
function toast(message, tone) {
  const el = document.getElementById("toast");
  el.textContent = message;
  if (tone) el.dataset.tone = tone; else delete el.dataset.tone;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, tone === "error" ? 9000 : 3200);
}

function setStatus(text, options = {}) {
  stateEl.textContent = text;
  if (options.dirty) stateEl.dataset.dirty = "true"; else delete stateEl.dataset.dirty;
  if (options.tone) stateEl.dataset.tone = options.tone; else delete stateEl.dataset.tone;
}

function markDirty() {
  state.dirty = true;
  setStatus("Unsaved changes", { dirty: true });
}

function markClean() {
  state.dirty = false;
  setStatus("Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
}

function fatal(message) {
  view.replaceChildren(h("div", { class: "panel-card" }, [
    h("h2", null, "The panel could not start"),
    h("p", { class: "notice notice--bad" }, message),
    h("p", null, "Start it from a terminal in the project folder with:"),
    h("pre", { class: "output" }, "npm run admin"),
    h("p", null, "Then open the link it prints, including the long token at the end.")
  ]));
  tabsEl.replaceChildren();
}

/* ====================== context handed to every field ====================== */

const ctx = {
  toast,
  onEdit: markDirty,
  onStructure: () => renderView(),
  onUpload: (dir, base, files, existing) => uploadFiles(ctx, dir, base, files, existing),
  onDeleteImage: async (image) => {
    try {
      await api("/api/delete-image", { method: "POST", body: JSON.stringify({ src: image.src }) });
    } catch (error) {
      toast("The file could not be removed: " + error.message, "error");
    }
  }
};

function fieldContext(path, field) {
  return {
    token: state.token,
    toast: ctx.toast,
    onEdit: ctx.onEdit,
    onStructure: ctx.onStructure,
    onUpload: ctx.onUpload,
    onDeleteImage: ctx.onDeleteImage,
    path,
    field,
    root: state.data,
    errors: state.errors
  };
}

/* ====================== tabs and views ====================== */

function renderTabs() {
  tabsEl.replaceChildren();
  state.tabs.forEach((tab) => {
    tabsEl.append(h("button", {
      class: "tab",
      type: "button",
      "aria-current": String(tab.id === state.tab),
      onclick: () => {
        state.tab = tab.id;
        renderTabs();
        renderView();
      }
    }, tab.label));
  });
}

function renderView() {
  view.replaceChildren();
  const tab = state.tabs.find((entry) => entry.id === state.tab);
  if (!tab) return;

  if (tab.id === "products") return renderProducts();
  if (tab.id === "categories") return renderCategories();
  return renderGroups(tab);
}

function renderGroups(tab) {
  tab.sections.forEach((key) => {
    const section = state.schema[key];
    if (!section) return;

    const card = h("section", { class: "panel-card" }, h("h2", null, section.label));
    if (section.help) card.append(h("p", { class: "hint" }, section.help));

    /* A section that is itself a repeatable list — the ordering steps — is one
       field, not a set of loose inputs, so it needs no per-field loop. */
    if (section.type === "objectList") {
      card.append(renderField(fieldContext([key], section)));
      view.append(card);
      return;
    }

    Object.keys(section.fields).forEach((name) => {
      const field = section.fields[name];
      const isList = field.type === "objectList";
      card.append(h("div", isList ? { class: "panel-card" } : null,
        renderField(fieldContext([key, name], field))));
    });
    view.append(card);
  });
}

function renderCategories() {
  const section = state.schema.categories;
  const card = h("section", { class: "panel-card" }, h("h2", null, section.label));
  card.append(h("p", { class: "hint" },
    "Categories become the filter buttons in the shop and the cards on the home page. " +
    "A category that still has products in it cannot be removed — move those products " +
    "to another category first."));
  card.append(renderField(fieldContext(["categories"], section)));
  view.append(card);
}

/* ====================== products ====================== */

function smallestSource(image) {
  if (!image) return "";
  const parts = (image.srcset || "")
    .split(",")
    .map((part) => part.trim().split(/\s+/))
    .filter((bits) => bits[0] && /^\d+w$/.test(bits[1] || ""));
  if (!parts.length) return image.src;
  parts.sort((a, b) => parseInt(a[1], 10) - parseInt(b[1], 10));
  return parts[0][0];
}

function renderProducts() {
  const section = state.schema.products;
  const products = state.data.products || [];
  if (state.selected === null || !products[state.selected]) state.selected = 0;

  /* ---- the list ---- */
  const listCard = h("section", { class: "panel-card" });
  listCard.append(h("h2", null, section.label + " (" + products.length + ")"));

  const search = h("input", {
    class: "field__input",
    type: "search",
    placeholder: "Search by name or code",
    value: state.filter.q
  });
  search.addEventListener("input", () => {
    state.filter.q = search.value;
    renderListItems();
  });

  const categorySelect = h("select", { class: "field__select" });
  categorySelect.append(h("option", { value: "" }, "All categories"));
  (state.data.categories || []).forEach((category) => {
    categorySelect.append(h("option", {
      value: category.id,
      selected: category.id === state.filter.category
    }, category.label));
  });
  categorySelect.addEventListener("change", () => {
    state.filter.category = categorySelect.value;
    renderListItems();
  });

  const items = h("ul", { class: "list" });
  listCard.append(h("div", { class: "field" }, search), h("div", { class: "field" }, categorySelect), items);
  listCard.append(h("div", { class: "actions" },
    h("button", { class: "btn btn--primary", type: "button",
      onclick: () => {
        products.unshift(blankProduct(section));
        state.selected = 0;
        state.filter = { q: "", category: "" };
        markDirty();
        renderView();
      } }, section.addLabel || "Add a product")));

  function renderListItems() {
    const query = state.filter.q.trim().toLowerCase();
    items.replaceChildren();

    const shown = products
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => !state.filter.category || product.category === state.filter.category)
      .filter(({ product }) => !query ||
        String(product.name || "").toLowerCase().includes(query) ||
        String(product.code || "").toLowerCase().includes(query));

    if (!shown.length) {
      items.append(h("li", { class: "list__meta" }, "Nothing matches that."));
      return;
    }

    shown.forEach(({ product, index }) => {
      const cover = (product.images || [])[0];
      items.append(h("li", null, h("button", {
        class: "list__item",
        type: "button",
        "aria-current": String(index === state.selected),
        onclick: () => {
          state.selected = index;
          renderView();
        }
      }, [
        cover
          ? h("img", { class: "list__thumb", src: smallestSource(cover), alt: "", loading: "lazy" })
          : h("img", { class: "list__thumb", src: "/assets/img/brand/mark.svg", alt: "" }),
        h("span", { class: "list__name" }, [
          product.name || "(no name)",
          h("span", { class: "list__meta" }, product.code || "no code")
        ]),
        h("span", { class: "list__price" },
          typeof product.price === "number" ? "৳" + product.price : (product.priceNote || "DM"))
      ])));
    });
  }

  renderListItems();

  /* ---- the editor ---- */
  const editorCard = h("section", { class: "panel-card" });
  const product = products[state.selected];

  if (!product) {
    editorCard.append(h("p", { class: "hint" }, "Add a product to get started."));
  } else {
    editorCard.append(h("div", { class: "row__head" }, [
      h("h2", null, product.name || "New product"),
      h("div", { class: "row__tools" },
        h("button", { class: "btn btn--tiny btn--danger", type: "button",
          onclick: async () => {
            if (!window.confirm(
              "Remove “" + (product.name || "this product") + "” and its photographs?\n\n" +
              "This is not published until you press Publish.")) return;
            for (const image of product.images || []) await ctx.onDeleteImage(image);
            products.splice(state.selected, 1);
            state.selected = Math.max(0, state.selected - 1);
            markDirty();
            renderView();
          } }, "Remove product"))
    ]));

    Object.keys(section.fields).forEach((name) => {
      editorCard.append(renderField(fieldContext(["products", state.selected, name], section.fields[name])));
    });
  }

  view.append(h("div", { class: "split split--list" }, listCard, editorCard));
}

function blankProduct(section) {
  const product = {};
  Object.keys(section.fields).forEach((name) => {
    const field = section.fields[name];
    if (field.type === "boolean") product[name] = false;
    else if (field.type === "price" || field.type === "number") product[name] = null;
    else if (field.type === "imageList" || field.type === "paragraphs" || field.type === "stringList") product[name] = [];
    else product[name] = "";
  });
  product.priceNote = "DM for price";
  return product;
}

/* ====================== saving ====================== */

function applyErrors(list) {
  state.errors = new Map(list.map((entry) => [entry.path, entry.message]));
}

async function save() {
  setStatus("Saving…");
  try {
    const payload = await api("/api/content", {
      method: "POST",
      body: JSON.stringify({ data: state.data, mtime: state.mtime })
    });
    state.mtime = payload.mtime;
    state.errors = new Map();
    markClean();
    return true;
  } catch (error) {
    if (error.status === 409) {
      state.dirty = true;
      setStatus("Needs reloading", { dirty: true, tone: "error" });
      showStale();
      return false;
    }
    if (error.status === 400 && error.payload && error.payload.errors) {
      applyErrors(error.payload.errors);
      renderView();
      setStatus(error.payload.errors.length + " to fix", { dirty: true, tone: "error" });
      toast("Some fields need attention. They are marked in red.", "error");
      return false;
    }
    setStatus("Not saved", { dirty: true, tone: "error" });
    toast(error.message, "error");
    return false;
  }
}

function showStale() {
  openPanel("Reload needed");
  panelBody.replaceChildren(
    h("p", { class: "notice notice--bad" },
      "The content file changed on disk since this page was opened. Saving now would " +
      "overwrite whatever changed."),
    h("p", null, "Reload to take the version on disk. Your unsaved edits in this tab will be lost."),
    h("div", { class: "actions" },
      h("button", { class: "btn btn--primary", type: "button",
        onclick: () => window.location.reload() }, "Reload the panel"))
  );
}

/* ====================== publishing ====================== */

function openPanel(title) {
  panelTitle.textContent = title;
  panelBody.replaceChildren();
  if (!panel.open) panel.showModal();
}

function renderDoctor(report) {
  panelBody.append(h("dl", { class: "kv" }, [
    h("dt", null, "Git"), h("dd", null, report.version || (report.installed ? "found" : "not found")),
    h("dt", null, "Your name"), h("dd", null, report.identity && report.identity.name || "not set"),
    h("dt", null, "Your email"), h("dd", null, report.identity && report.identity.email || "not set"),
    h("dt", null, "Repository"), h("dd", null, report.remote || "not connected"),
    h("dt", null, "Branch"), h("dd", null, report.branch || "—")
  ]));

  panelBody.append(h("p", { class: "notice" },
    "Fill in what is missing. Your GitHub login itself is handled by a window " +
    "that git opens the first time you publish — that part cannot be done from here."));

  if (report.missingFromRepo && report.missingFromRepo.length) {
    panelBody.append(h("p", { class: "notice notice--bad" },
      "This GitHub repository does not contain the website's own files yet — " +
      "only the content is there. Publishing will add them."));
  }

  const name = h("input", { class: "field__input", type: "text", value: (report.identity && report.identity.name) || "" });
  const email = h("input", { class: "field__input", type: "text", value: (report.identity && report.identity.email) || "" });
  const remote = h("input", { class: "field__input", type: "text",
    value: report.remote || "", placeholder: "https://github.com/you/cozy-stitches.git" });
  /* A repository with no commits yet should start on main, which is what GitHub
     uses by default. Renaming a branch afterwards is more confusing than
     starting on the right one. */
  const suggestedBranch = report.hasCommits ? (report.branch || "main") : "main";
  const branch = h("input", { class: "field__input", type: "text", value: suggestedBranch });

  panelBody.append(
    h("div", { class: "field" }, h("label", { class: "field__label" }, "Your name"), name),
    h("div", { class: "field" }, h("label", { class: "field__label" }, "Your email"), email),
    h("div", { class: "field" }, [
      h("label", { class: "field__label" }, "GitHub repository"),
      remote,
      h("p", { class: "field__help" },
        "Create an empty repository on GitHub, then paste its address here. " +
        "It looks like https://github.com/yourname/cozy-stitches.git")
    ]),
    h("div", { class: "field" }, h("label", { class: "field__label" }, "Branch"), branch),
    h("div", { class: "actions" },
      h("button", { class: "btn btn--primary", type: "button",
        onclick: async () => {
          try {
            const result = await api("/api/git-setup", {
              method: "POST",
              body: JSON.stringify({
                name: name.value.trim(),
                email: email.value.trim(),
                remote: remote.value.trim(),
                branch: branch.value.trim()
              })
            });
            panelBody.replaceChildren(h("p", { class: "notice notice--good" }, "Setup updated."));
            const steps = h("ul", { class: "steps" });
            result.steps.forEach((step) => steps.append(h("li", null, (step.ok ? "✓ " : "✕ ") + step.label)));
            panelBody.append(steps);
            if (result.doctor.canPublish) {
              panelBody.append(h("p", null, "Everything is in place. Press Publish again."));
            }
          } catch (error) {
            toast(error.message, "error");
          }
        } }, "Save this setup"))
  );
}

function renderPublishResult(result) {
  const steps = h("ul", { class: "steps" });
  (result.steps || []).forEach((step) => {
    steps.append(h("li", null, [
      step.ok ? "✓ " : "✕ ",
      h("strong", null, step.label),
      step.detail ? " — " + step.detail : ""
    ]));
  });

  panelBody.append(steps);

  if (result.ok && result.nothingToDo) {
    panelBody.append(h("p", { class: "notice notice--good" }, "Everything was already published."));
    return;
  }
  if (result.ok) {
    panelBody.append(h("p", { class: "notice notice--good" },
      "Sent to GitHub. Your host will rebuild in a minute or two, and the live " +
      "site will update on its own."));
    return;
  }
  panelBody.append(h("p", { class: "notice notice--bad" }, result.error || "Publishing failed."));
  panelBody.append(h("p", { class: "hint" },
    "The commit is safe on this computer either way. Once the problem is fixed, " +
    "press Publish again."));
}

async function publish() {
  openPanel("Publish");
  panelBody.append(h("p", null, "Checking your setup…"));

  try {
    const report = await api("/api/doctor");
    if (!report.canPublish) {
      panelBody.replaceChildren();
      renderDoctor(report);
      return;
    }

    if (state.dirty) {
      panelBody.replaceChildren(h("p", null, "Saving your changes first…"));
      const saved = await save();
      if (!saved) {
        panelBody.replaceChildren(h("p", { class: "notice notice--bad" },
          "Fix the highlighted fields, then publish again."));
        return;
      }
    }

    /* Say so before doing it, because this is the difference between a host
       that has something to build and one that has nothing at all. */
    const sending = h("div");
    if (report.missingFromRepo && report.missingFromRepo.length) {
      sending.append(h("p", { class: "notice" },
        "Your GitHub repository does not have the website's own files yet — " +
        "only the content. This publish adds the pages, the stylesheets and the " +
        "build tool as well."));
    }
    sending.append(h("p", null, "Sending to GitHub…"));
    panelBody.replaceChildren(sending);

    const result = await api("/api/publish", { method: "POST" });
    panelBody.replaceChildren();
    renderPublishResult(result);
  } catch (error) {
    panelBody.replaceChildren(h("p", { class: "notice notice--bad" }, error.message));
  }
}

/* ====================== history ====================== */

async function showHistory() {
  openPanel("History");
  panelBody.append(h("p", null, "Loading…"));
  try {
    const { backups } = await api("/api/backups");
    panelBody.replaceChildren();
    if (!backups.length) {
      panelBody.append(h("p", { class: "hint" },
        "No snapshots yet. One is taken automatically every time you save."));
      return;
    }
    panelBody.append(h("p", { class: "hint" },
      "Every save keeps a copy of what the content looked like beforehand. " +
      "Restoring one puts it back on disk; you still have to save or publish it."));

    const list = h("ul", { class: "list" });
    backups.forEach((backup) => {
      list.append(h("li", null, h("div", { class: "list__item" }, [
        h("span", { class: "list__name" }, new Date(backup.savedAt).toLocaleString()),
        h("button", { class: "btn btn--tiny", type: "button",
          onclick: async () => {
            if (!window.confirm("Replace the current content with this snapshot?")) return;
            try {
              const restored = await api("/api/restore", {
                method: "POST",
                body: JSON.stringify({ name: backup.name })
              });
              state.data = restored.data;
              state.mtime = restored.mtime;
              state.errors = new Map();
              markDirty();
              renderView();
              panel.close();
              toast("Snapshot restored. Press Save to keep it, or Publish to send it live.");
            } catch (error) {
              toast(error.message, "error");
            }
          } }, "Restore")
      ])));
    });
    panelBody.append(list);
  } catch (error) {
    panelBody.replaceChildren(h("p", { class: "notice notice--bad" }, error.message));
  }
}

/* ====================== boot ====================== */

async function boot() {
  const params = new URLSearchParams(window.location.search);
  const fromLink = params.get("token");
  if (fromLink) {
    sessionStorage.setItem("admin-token", fromLink);
    /* Take the token out of the address bar: a URL is easy to screenshot or
       paste into a chat by accident, and a token is all the protection there is. */
    params.delete("token");
    const query = params.toString();
    history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
  }

  state.token = fromLink || sessionStorage.getItem("admin-token") || "";
  if (!state.token) {
    fatal("No session token was found. Open the editor using the exact link the " +
          "server printed, including the token on the end.");
    return;
  }
  ctx.token = state.token;

  let schemaPayload;
  let contentPayload;
  try {
    [schemaPayload, contentPayload] = await Promise.all([api("/api/schema"), api("/api/content")]);
  } catch (error) {
    fatal(error.message);
    return;
  }

  state.tabs = schemaPayload.tabs;
  state.schema = schemaPayload.schema;
  state.data = contentPayload.data;
  state.mtime = contentPayload.mtime;
  state.tab = state.tabs[0].id;

  renderTabs();
  renderView();
  markClean();
}

document.getElementById("save").addEventListener("click", save);
document.getElementById("publish").addEventListener("click", publish);
document.getElementById("history").addEventListener("click", showHistory);
document.getElementById("panel-close").addEventListener("click", () => panel.close());

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    save();
  }
});

window.addEventListener("beforeunload", (event) => {
  if (!state.dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

boot();
