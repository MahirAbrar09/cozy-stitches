/* ==========================================================================
   Cozy Stitches — site.js
   --------------------------------------------------------------------------
   Behaviour only: mobile navigation, category filtering, the product detail
   dialog, deep links and the reference-code copy button. All content comes
   from content.js via render.js.
   ========================================================================== */

(function () {
  "use strict";

  var C = window.COZY;
  var UI = window.CozyUI;

  if (!C || !UI) {
    if (window.console) {
      console.error("[Cozy Stitches] content.js and render.js must load before site.js.");
    }
    return;
  }

  /* History changes throw on file:// (origin "null"), which is how the site
     is previewed locally by double-clicking. Never let that break the page. */
  function safeHistory(method, url) {
    try {
      window.history[method](null, "", url);
    } catch (error) {
      /* Previewing from disk, or a sandboxed frame: ignore. */
    }
  }

  function withUrlParam(name, value) {
    var params = new URLSearchParams(window.location.search);
    if (value) params.set(name, value);
    else params.delete(name);
    var query = params.toString();
    return window.location.pathname + (query ? "?" + query : "") + window.location.hash;
  }

  /* ====================== mobile navigation ====================== */

  function setupNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    function setOpen(open) {
      nav.setAttribute("data-open", open ? "true" : "false");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }

    toggle.addEventListener("click", function () {
      setOpen(nav.getAttribute("data-open") !== "true");
    });

    document.addEventListener("click", function (event) {
      if (nav.getAttribute("data-open") !== "true") return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (nav.getAttribute("data-open") !== "true") return;
      setOpen(false);
      toggle.focus();
    });

    setOpen(false);
  }

  /* ====================== category filtering ====================== */

  function setupFilters() {
    var bar = document.querySelector("[data-render='filters']");
    var grid = document.querySelector("[data-render='products']");
    if (!bar) return;

    var tiles = grid ? UI.qsa("[data-product]", grid) : [];
    var countEl = document.querySelector("[data-render='count']");
    var emptyEl = document.querySelector("[data-render='empty']");

    var groups = [{ id: "", label: "All", count: tiles.length }].concat(
      (C.categories || []).map(function (category) {
        return {
          id: category.id,
          label: category.label,
          count: UI.productsIn(category.id).length
        };
      })
    );

    UI.clear(bar);
    groups.forEach(function (group) {
      var chip = UI.el("button", {
        class: "chip",
        type: "button",
        "aria-pressed": "false",
        dataset: { filter: group.id }
      });
      chip.appendChild(UI.el("span", { text: group.label }));
      chip.appendChild(UI.el("span", { class: "chip__count", text: String(group.count) }));
      bar.appendChild(chip);
    });

    /* A tile that was hidden and is now shown arrives rather than teleporting.
       Only ever on a filter change: the opening grid must appear immediately. */
    function enter(tile) {
      tile.classList.remove("is-entering");
      /* Reading a layout property restarts the animation if it is still on. */
      void tile.offsetWidth;
      tile.classList.add("is-entering");
      tile.addEventListener("animationend", function () {
        tile.classList.remove("is-entering");
      }, { once: true });
    }

    function apply(id, silent) {
      var shown = 0;

      tiles.forEach(function (item) {
        var match = !id || item.getAttribute("data-category") === id;
        var wasHidden = item.hidden;
        item.hidden = !match;
        if (match) {
          shown += 1;
          if (!silent && wasHidden) enter(item);
        }
      });

      UI.qsa("[data-filter]", bar).forEach(function (chip) {
        chip.setAttribute("aria-pressed", chip.getAttribute("data-filter") === id ? "true" : "false");
      });

      if (countEl) {
        countEl.textContent = shown + (shown === 1 ? " piece" : " pieces");
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;

      if (!silent) safeHistory("replaceState", withUrlParam("c", id));
    }

    bar.addEventListener("click", function (event) {
      var chip = event.target.closest ? event.target.closest("[data-filter]") : null;
      if (!chip) return;
      apply(chip.getAttribute("data-filter"), false);
      /* Keep the catalog in view rather than jumping to the page top. */
      var anchor = document.querySelector("[data-anchor='catalog']");
      if (anchor && !tiles.length) anchor.scrollIntoView({ block: "start" });
    });

    var requested = new URLSearchParams(window.location.search).get("c");
    var known = requested && (C.categories || []).some(function (c) { return c.id === requested; });
    apply(known ? requested : "", true);
  }

  /* ====================== product detail dialog ====================== */

  function setupDetail() {
    var dialog = document.getElementById("detail");
    if (!dialog) return;

    var lastFocus = null;
    var closeSilently = false;

    function openDetail(slug, silent) {
      var product = UI.productBySlug(slug);
      if (!product) return false;

      UI.clear(dialog);
      dialog.appendChild(UI.detailContent(product));

      if (!dialog.open) {
        lastFocus = document.activeElement;
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }

      var closeButton = dialog.querySelector("[data-detail-close]");
      if (closeButton) closeButton.focus();

      if (!silent) safeHistory("pushState", "#" + slug);
      return true;
    }

    function onClosed() {
      var silent = closeSilently;
      closeSilently = false;
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      if (!silent) safeHistory("pushState", window.location.pathname + window.location.search);
    }

    function closeDetail(silent) {
      closeSilently = !!silent;
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else {
        dialog.removeAttribute("open");
        onClosed();
      }
    }

    dialog.addEventListener("close", onClosed);

    /* Clicking the backdrop reports the dialog itself as the target. */
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDetail();
    });

    /* Thumbnail strip: swap the cover photograph in place. The full-size
       details travel on the button, so this needs no second lookup. */
    dialog.addEventListener("click", function (event) {
      if (!event.target.closest) return;
      var thumb = event.target.closest("[data-gallery-thumb]");
      if (!thumb) return;
      event.preventDefault();

      var main = dialog.querySelector(".detail__main");
      if (!main) return;

      main.setAttribute("src", thumb.getAttribute("data-src"));
      var srcset = thumb.getAttribute("data-srcset");
      if (srcset) main.setAttribute("srcset", srcset);
      else main.removeAttribute("srcset");
      main.setAttribute("width", thumb.getAttribute("data-width"));
      main.setAttribute("height", thumb.getAttribute("data-height"));

      UI.qsa("[data-gallery-thumb]", dialog).forEach(function (node) {
        node.setAttribute("aria-pressed", node === thumb ? "true" : "false");
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest) return;

      var opener = event.target.closest("[data-detail]");
      if (opener) {
        event.preventDefault();
        openDetail(opener.getAttribute("data-detail"));
        return;
      }

      var closer = event.target.closest("[data-detail-close]");
      if (closer) {
        event.preventDefault();
        closeDetail();
      }
    });

    window.addEventListener("popstate", function () {
      var slug = window.location.hash.replace(/^#/, "");
      if (slug && UI.productBySlug(slug)) openDetail(slug, true);
      else closeDetail(true);
    });

    var initial = window.location.hash.replace(/^#/, "");
    if (initial && UI.productBySlug(initial)) openDetail(initial, true);
  }

  /* ====================== reference-code copying ====================== */

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(
        function () { return true; },
        function () { return legacyCopy(text); }
      );
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.top = "-1000px";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(field);
      return ok;
    } catch (error) {
      return false;
    }
  }

  function setupClipboard() {
    document.addEventListener("click", function (event) {
      if (!event.target.closest) return;
      var button = event.target.closest("[data-copy]");
      if (!button) return;

      var code = button.getAttribute("data-copy");
      var original = button.getAttribute("data-copy-label") || button.textContent;
      button.setAttribute("data-copy-label", original);

      copyText(code).then(function (ok) {
        var scope = button.closest(".detail") || document;
        var status = scope.querySelector(".detail__footer [aria-live]");

        if (ok) {
          button.textContent = "Copied " + code;
          if (status) status.textContent = "Reference copied. Paste it into the message.";
          window.setTimeout(function () { button.textContent = original; }, 2400);
        } else if (status) {
          status.textContent = "Copying is blocked in this browser. The reference is " +
            code + " — select and copy it from the button.";
        }
      });
    });
  }

  /* ====================== boot ====================== */

  function init() {
    UI.renderAll();
    setupNav();
    setupFilters();
    setupDetail();
    setupClipboard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
