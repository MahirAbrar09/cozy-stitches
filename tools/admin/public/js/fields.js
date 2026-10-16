/* ==========================================================================
   Cozy Stitches — field controls
   --------------------------------------------------------------------------
   Every input on the panel is generated from the schema the server sends, so
   adding a field to a record means editing one file rather than three.

   Two rules worth knowing:
     • typing never re-renders the form (it would steal focus). It only marks
       the page dirty. Adding, removing, reordering and uploading do re-render.
     • the client holds the whole content object and patches fields in it, so
       any key the schema does not know about survives a save untouched.
   ========================================================================== */

/* ====================== paths ====================== */

export const pathKey = (path) => path.reduce(
  (text, key) => (typeof key === "number"
    ? text + "[" + key + "]"
    : (text ? text + "." + key : String(key))),
  ""
);

export const getAt = (root, path) =>
  path.reduce((node, key) => (node == null ? undefined : node[key]), root);

export function setAt(root, path, value) {
  const parent = path.slice(0, -1).reduce((node, key) => node[key], root);
  parent[path[path.length - 1]] = value;
}

export function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ====================== tiny DOM helper ====================== */

export function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  if (props) {
    Object.entries(props).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key in node) node[key] = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
  }
  kids.flat(Infinity).forEach((kid) => {
    if (kid === null || kid === undefined || kid === false) return;
    node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  });
  return node;
}

function labelled(id, field, control, extras) {
  /* Filtered rather than appended raw: Element.append() turns a null into the
     literal text "null", which is how a stray "null" appeared after every
     help line. h() already drops these; append() does not. */
  return [
    h("label", { class: "field__label", for: id }, field.label),
    control,
    field.help ? h("p", { class: "field__help" }, field.help) : null,
    extras
  ].filter((node) => node !== null && node !== undefined && node !== false);
}

/* ====================== one field ====================== */

export function renderField(context) {
  const { path, field, root, onEdit, onStructure, errors } = context;
  const key = pathKey(path);
  const value = getAt(root, path);
  const message = errors && errors.get(key);

  if (field.type === "group") {
    const box = h("fieldset", { class: "field", dataset: { field: key } });
    box.append(h("legend", { class: "field__label" }, field.label));
    if (field.help) box.append(h("p", { class: "field__help" }, field.help));
    Object.keys(field.fields).forEach((name) => {
      box.append(renderField(Object.assign({}, context, {
        path: path.concat(name),
        field: field.fields[name]
      })));
    });
    return box;
  }

  if (field.type === "objectList") return renderObjectList(context);

  const wrap = h("div", { class: "field" + (message ? " field--bad" : ""), dataset: { field: key } });
  const id = "f-" + key.replace(/[^A-Za-z0-9_-]/g, "-");

  if (field.type === "boolean") {
    const input = h("input", { class: "field__checkbox", id, type: "checkbox", checked: !!value });
    input.addEventListener("change", () => {
      setAt(root, path, input.checked);
      onEdit();
    });
    const row = h("div", { class: "field--inline" }, input,
      h("label", { class: "field__label", for: id }, field.label));
    wrap.append(row);
    if (field.help) wrap.append(h("p", { class: "field__help" }, field.help));
    if (message) wrap.append(h("p", { class: "field__error" }, message));
    return wrap;
  }

  if (field.type === "select") {
    const select = h("select", { class: "field__select", id });
    select.append(h("option", { value: "" }, field.required ? "Choose one…" : "—"));
    resolveOptions(field, root).forEach((option) => {
      select.append(h("option", { value: option, selected: option === value }, option));
    });
    select.addEventListener("change", () => {
      setAt(root, path, select.value);
      onEdit();
      onStructure();
    });
    wrap.append(...labelled(id, field, select, message ? h("p", { class: "field__error" }, message) : null));
    return wrap;
  }

  if (field.type === "stringList" || field.type === "paragraphs") {
    wrap.append(renderLineList(context));
    if (message) wrap.append(h("p", { class: "field__error" }, message));
    return wrap;
  }

  if (field.type === "image") {
    wrap.append(renderSingleImage(context));
    if (message) wrap.append(h("p", { class: "field__error" }, message));
    return wrap;
  }

  if (field.type === "imageList") {
    wrap.append(renderImageList(context));
    if (message) wrap.append(h("p", { class: "field__error" }, message));
    return wrap;
  }

  const control = textControl(context, id, value);
  wrap.append(...labelled(id, field, control, message ? h("p", { class: "field__error" }, message) : null));
  return wrap;
}

function resolveOptions(field, root) {
  if (field.options) return field.options.slice();
  const source = root[field.from];
  if (!Array.isArray(source)) return [];
  return source.map((entry) => entry && entry[field.valueField]).filter(Boolean);
}

/* ====================== text-ish controls ====================== */

function textControl(context, id, value) {
  const { path, field, root, onEdit, onStructure } = context;

  if (field.type === "textarea") {
    const area = h("textarea", { class: "field__textarea", id, rows: 3, value: value || "" });
    area.addEventListener("input", () => {
      setAt(root, path, area.value);
      onEdit();
    });
    return area;
  }

  const type = field.type === "price" || field.type === "number" ? "number" : "text";
  const input = h("input", {
    class: "field__input",
    id,
    type,
    value: value === null || value === undefined ? "" : String(value),
    min: type === "number" ? "0" : null,
    step: type === "number" ? "1" : null,
    inputmode: field.type === "price" ? "numeric" : null
  });

  input.addEventListener("input", () => {
    if (field.type === "price" || field.type === "number") {
      setAt(root, path, input.value === "" ? null : Number(input.value));
    } else if (field.type === "channel") {
      const cleaned = cleanChannel(path[path.length - 1], input.value);
      if (cleaned !== input.value) input.value = cleaned;
      setAt(root, path, cleaned);
    } else {
      setAt(root, path, input.value);
    }
    onEdit();
  });

  /* A link name left blank fills itself from the product's name. */
  if (field.type === "slug") {
    input.addEventListener("blur", () => {
      if (input.value.trim()) return;
      const sibling = getAt(root, path.slice(0, -1).concat("name"));
      if (!sibling) return;
      input.value = slugify(sibling);
      setAt(root, path, input.value);
      onEdit();
      onStructure();
    });
  }

  return input;
}

function cleanChannel(key, value) {
  if (key === "whatsapp") return value.replace(/[^\d]/g, "");
  if (key === "instagram") {
    return value.trim()
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
      .replace(/^@+/, "");
  }
  if (key === "messenger") {
    return value.trim().replace(/^https?:\/\/(www\.)?(m\.me|facebook\.com|fb\.com)\//i, "").replace(/^@+/, "");
  }
  return value;
}

/* ====================== lists of plain lines ====================== */

function renderLineList(context) {
  const { path, field, root, onEdit, onStructure } = context;
  const value = getAt(root, path);
  const lines = Array.isArray(value) ? value : [];
  const box = h("div", { class: "field" });

  box.append(h("span", { class: "field__label" }, field.label));
  if (field.help) box.append(h("p", { class: "field__help" }, field.help));

  const rows = h("div", { class: "rows" });

  const commit = () => { setAt(root, path, lines.slice()); onEdit(); };
  const rerender = () => { setAt(root, path, lines.slice()); onEdit(); onStructure(); };

  const move = (from, to) => {
    if (to < 0 || to >= lines.length) return;
    const [item] = lines.splice(from, 1);
    lines.splice(to, 0, item);
    rerender();
  };

  lines.forEach((line, index) => {
    const isParagraph = field.type === "paragraphs";
    const control = isParagraph
      ? h("textarea", { class: "field__textarea", rows: 3, value: line })
      : textOrSelect(field, line, (next) => { lines[index] = next; commit(); });

    if (isParagraph) {
      control.addEventListener("input", () => { lines[index] = control.value; commit(); });
    }

    rows.append(h("div", { class: "row" }, [
      h("div", { class: "row__head" }, [
        h("span", { class: "row__title" }, (isParagraph ? "Paragraph " : "Line ") + (index + 1)),
        h("div", { class: "row__tools" }, [
          h("button", { class: "btn btn--tiny", type: "button", title: "Move up",
            onclick: () => move(index, index - 1) }, "↑"),
          h("button", { class: "btn btn--tiny", type: "button", title: "Move down",
            onclick: () => move(index, index + 1) }, "↓"),
          h("button", { class: "btn btn--tiny btn--danger", type: "button", title: "Remove",
            onclick: () => { lines.splice(index, 1); rerender(); } }, "Remove")
        ])
      ]),
      control
    ]));
  });

  box.append(rows);
  box.append(h("div", { class: "actions", style: "margin-top:0.75rem" },
    h("button", { class: "btn", type: "button",
      onclick: () => { lines.push(field.options ? field.options[0] : ""); rerender(); } },
      field.type === "paragraphs" ? "Add a paragraph" : "Add a line")));

  return box;
}

function textOrSelect(field, value, onChange) {
  if (!field.options) {
    const input = h("input", { class: "field__input", type: "text", value: value || "" });
    input.addEventListener("input", () => onChange(input.value));
    return input;
  }
  const select = h("select", { class: "field__select" });
  field.options.forEach((option) => {
    select.append(h("option", { value: option, selected: option === value }, option));
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

/* ====================== lists of records ====================== */

function renderObjectList(context) {
  /* The definition lives on `field`. It was called `section` here, which meant
     every repeatable list threw before it drew anything. */
  const { path, field: section, root, onEdit, onStructure } = context;
  const value = getAt(root, path);
  const entries = Array.isArray(value) ? value : [];
  const box = h("div", { class: "field", dataset: { field: pathKey(path) } });

  box.append(h("span", { class: "field__label" }, section.label));
  if (section.help) box.append(h("p", { class: "field__help" }, section.help));

  const rows = h("div", { class: "rows" });

  const rerender = () => { setAt(root, path, entries.slice()); onEdit(); onStructure(); };

  const move = (from, to) => {
    if (to < 0 || to >= entries.length) return;
    const [item] = entries.splice(from, 1);
    entries.splice(to, 0, item);
    rerender();
  };

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;
    const title = section.titleField ? entry[section.titleField] : "";
    const row = h("div", { class: "row" }, [
      h("div", { class: "row__head" }, [
        h("span", { class: "row__title" },
          (title || (section.singular || "entry")) + " " + (index + 1)),
        h("div", { class: "row__tools" }, [
          h("button", { class: "btn btn--tiny", type: "button", title: "Move up",
            onclick: () => move(index, index - 1) }, "↑"),
          h("button", { class: "btn btn--tiny", type: "button", title: "Move down",
            onclick: () => move(index, index + 1) }, "↓"),
          h("button", { class: "btn btn--tiny", type: "button", title: "Duplicate",
            onclick: () => { entries.splice(index + 1, 0, JSON.parse(JSON.stringify(entry))); rerender(); } }, "Copy"),
          h("button", { class: "btn btn--tiny btn--danger", type: "button", title: "Remove",
            onclick: () => {
              if (!window.confirm("Remove this " + (section.singular || "entry") + "?")) return;
              entries.splice(index, 1);
              rerender();
            } }, "Remove")
        ])
      ])
    ]);

    Object.keys(section.fields).forEach((name) => {
      row.append(renderField(Object.assign({}, context, {
        path: path.concat(index, name),
        field: section.fields[name]
      })));
    });

    rows.append(row);
  });

  box.append(rows);
  box.append(h("div", { class: "actions", style: "margin-top:0.75rem" },
    h("button", { class: "btn", type: "button",
      onclick: () => { entries.push(blankEntry(section)); rerender(); } },
      section.addLabel || ("Add a " + (section.singular || "entry")))));

  return box;
}

function blankEntry(section) {
  const entry = {};
  Object.keys(section.fields).forEach((name) => {
    const field = section.fields[name];
    if (field.type === "boolean") entry[name] = false;
    else if (field.type === "price" || field.type === "number") entry[name] = null;
    else if (field.type === "image") entry[name] = null;
    else if (field.type === "imageList") entry[name] = [];
    else if (field.type === "paragraphs" || field.type === "stringList") entry[name] = [];
    else if (field.type === "objectList") entry[name] = [];
    else if (field.type === "group") entry[name] = blankEntry({ fields: field.fields });
    else entry[name] = "";
  });
  return entry;
}

/* ====================== photographs ====================== */

function imageBase(context) {
  const { path, field, root } = context;
  const named = field.nameFrom ? getAt(root, path.slice(0, -1).concat(field.nameFrom)) : "";
  return slugify(named || field.imageDir || "image");
}

function nextImageIndex(images) {
  let highest = 0;
  (images || []).forEach((image) => {
    const paths = [image.src].concat(
      (image.srcset || "").split(",").map((part) => part.trim().split(/\s+/)[0])
    );
    paths.forEach((candidate) => {
      const match = /-(\d+)-\d+\.\w+$/.exec(candidate || "");
      if (match) highest = Math.max(highest, Number(match[1]));
    });
  });
  return highest + 1;
}

function renderSingleImage(context) {
  const { path, field, root, onEdit, onStructure } = context;
  const image = getAt(root, path);
  const box = h("div", { class: "field" });

  box.append(h("span", { class: "field__label" }, field.label));
  if (field.help) box.append(h("p", { class: "field__help" }, field.help));

  if (image && image.src) {
    box.append(h("div", { class: "shots" }, h("div", { class: "shot", dataset: { cover: "true" } }, [
      h("img", { src: image.src, alt: "" }),
      h("div", { class: "shot__tools" },
        h("button", { class: "btn btn--tiny btn--danger", type: "button",
          onclick: async () => {
            await context.onDeleteImage(image);
            setAt(root, path, null);
            onEdit();
            onStructure();
          } }, "Remove"))
    ])));
  }

  box.append(imageDrop(context, async (files) => {
    const list = await context.onUpload(field.imageDir, imageBase(context), files, []);
    if (list.length) {
      setAt(root, path, list[0]);
      onEdit();
      onStructure();
    }
  }));

  return box;
}

function renderImageList(context) {
  const { path, field, root, onEdit, onStructure } = context;
  const value = getAt(root, path);
  const images = Array.isArray(value) ? value : [];
  const box = h("div", { class: "field" });

  box.append(h("span", { class: "field__label" }, field.label));
  if (field.help) box.append(h("p", { class: "field__help" }, field.help));

  const strip = h("div", { class: "shots" });

  images.forEach((image, index) => {
    const shot = h("div", { class: "shot", dataset: { cover: String(index === 0) } }, [
      index === 0 ? h("span", { class: "shot__cover" }, "Cover") : null,
      h("img", { src: image.src, alt: "", loading: "lazy" }),
      h("div", { class: "shot__tools" }, [
        h("button", { class: "btn btn--tiny", type: "button", title: "Make this the cover",
          disabled: index === 0,
          onclick: () => {
            const [item] = images.splice(index, 1);
            images.unshift(item);
            onEdit();
            onStructure();
          } }, "Cover"),
        h("button", { class: "btn btn--tiny", type: "button", title: "Move left",
          disabled: index === 0,
          onclick: () => { const [item] = images.splice(index, 1); images.splice(index - 1, 0, item); onEdit(); onStructure(); } }, "←"),
        h("button", { class: "btn btn--tiny", type: "button", title: "Move right",
          disabled: index === images.length - 1,
          onclick: () => { const [item] = images.splice(index, 1); images.splice(index + 1, 0, item); onEdit(); onStructure(); } }, "→"),
        h("button", { class: "btn btn--tiny btn--danger", type: "button",
          onclick: async () => {
            if (!window.confirm("Delete this photograph?")) return;
            await context.onDeleteImage(image);
            images.splice(index, 1);
            onEdit();
            onStructure();
          } }, "Remove")
      ])
    ]);
    strip.append(shot);
  });

  if (images.length) box.append(strip);

  const accept = async (files) => {
    const added = await context.onUpload(field.imageDir, imageBase(context), files, images);
    added.forEach((image) => images.push(image));
    onEdit();
    onStructure();
  };

  box.append(imageDrop(context, accept));
  return box;
}

function imageDrop(context, onFiles) {
  const input = h("input", { type: "file", accept: "image/*", multiple: true });
  const zone = h("div", { class: "drop" }, [
    h("p", null, "Drag photographs here, or"),
    h("p", null, h("label", { class: "btn", for: input.id = "pick-" + Math.random().toString(36).slice(2) }, "choose files")),
    h("p", { class: "field__help" },
      "They are shrunk and converted for the web in this browser before uploading. " +
      "Nothing is stored anywhere but your own computer.")
  ]);

  input.id = zone.querySelector("label").getAttribute("for");
  input.style.display = "none";
  zone.append(input);

  const handle = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;
    zone.dataset.over = "false";
    try {
      await onFiles(files);
    } catch (error) {
      context.toast(String(error.message || error), "error");
    }
  };

  input.addEventListener("change", () => handle(input.files));

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.dataset.over = "true";
  });
  zone.addEventListener("dragleave", () => { zone.dataset.over = "false"; });
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    handle(event.dataTransfer.files);
  });

  return zone;
}

/* ====================== preparing and sending ====================== */

const TARGET_WIDTHS = [800, 1600];

/* Resizes and re-encodes in the browser. Using the browser's own encoders is
   why this project needs no image library at all, and re-drawing through a
   canvas is also what strips GPS and camera metadata out of a phone photo. */
export async function optimizeImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (error) {
    throw new Error(
      "This browser could not read “" + file.name + "”. Photos straight from an " +
      "iPhone are the usual cause: they are in HEIC format, which only Safari can " +
      "open. On the phone, set Camera → Formats → Most Compatible, or send the " +
      "picture as a JPEG."
    );
  }

  const longEdge = Math.max(bitmap.width, bitmap.height);
  let targets = TARGET_WIDTHS.filter((width) => width <= longEdge);
  if (!targets.length) targets = [longEdge];

  const variants = [];
  for (const target of targets) {
    const scale = target / longEdge;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);

    let blob = await toBlob(canvas, "image/webp", 0.82);
    let ext = "webp";
    if (!blob) {
      blob = await toBlob(canvas, "image/jpeg", 0.86);
      ext = "jpg";
    }
    if (!blob) throw new Error("This browser could not prepare “" + file.name + "”.");

    variants.push({ target, width, height, blob, ext });
  }

  if (bitmap.close) bitmap.close();
  return variants;
}

/* Resolves only if the browser really produced the format asked for, which is
   how WebP support is detected rather than guessed from the user agent. */
function toBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob && blob.type === type ? blob : null);
    }, type, quality);
  });
}

export async function sendImage(token, dir, name, blob) {
  const response = await fetch(
    "/api/upload?dir=" + encodeURIComponent(dir) + "&name=" + encodeURIComponent(name),
    {
      method: "POST",
      headers: {
        "X-Admin-Token": token,
        "Content-Type": blob.type || "application/octet-stream"
      },
      body: blob
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "The upload failed.");
  return payload;
}

/* Turns browser Files into stored photographs, ready for the content file. */
export async function uploadFiles(context, dir, base, files, existing) {
  const added = [];
  let index = nextImageIndex(existing);

  for (const file of files) {
    const variants = await optimizeImage(file);
    const uploaded = [];

    for (const variant of variants) {
      const name = base + "-" + index + "-" + variant.target + "." + variant.ext;
      const saved = await sendImage(context.token, dir, name, variant.blob);
      uploaded.push({ width: variant.target, w: variant.width, h: variant.height, src: saved.src });
    }

    const largest = uploaded[uploaded.length - 1];
    added.push({
      src: largest.src,
      srcset: uploaded.length > 1
        ? uploaded.map((variant) => variant.src + " " + variant.width + "w").join(", ")
        : "",
      width: largest.w,
      height: largest.h
    });

    index += 1;
    context.toast("Added " + file.name + " (" + Math.round(largest.srcset ? uploaded[uploaded.length - 1].w : largest.w) + "px)");
  }

  return added;
}
