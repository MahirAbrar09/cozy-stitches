/* ==========================================================================
   Cozy Stitches — render.js
   --------------------------------------------------------------------------
   Builds every repeating list on the site from window.COZY. No product,
   category, review, FAQ or channel markup is duplicated in the HTML: edit
   js/content.js and every page follows.

   Exposed as window.CozyUI for site.js.
   ========================================================================== */

(function () {
  "use strict";

  var C = window.COZY;
  if (!C) {
    if (window.console) {
      console.error("[Cozy Stitches] js/content.js did not load — nothing can render.");
    }
    return;
  }

  /* ====================== DOM helpers ====================== */

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value === null || value === undefined || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key in node) node[key] = value;
        else node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    append(node, children);
    return node;
  }

  function append(node, children) {
    if (children === null || children === undefined) return;
    (Array.isArray(children) ? children : [children]).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function setText(selector, value) {
    /* Silently keep the fallback already in the HTML rather than rendering
       the string "undefined" if a value is missing from content.js. */
    if (value === null || value === undefined) return;
    qsa(selector).forEach(function (node) { node.textContent = value; });
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  /* ====================== icons ====================== */

  var ICONS = {
    messenger:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M12 3.4c4.9 0 8.7 3.4 8.7 7.7s-3.8 7.7-8.7 7.7c-1 0-2-.16-2.9-.45L4.6 19.8l1.2-3.3A7.4 7.4 0 0 1 3.3 11.1C3.3 6.8 7.1 3.4 12 3.4Z"/>' +
      '<path d="m8.6 13.2 2.6-3.4 2.3 2.1 2.5-3.1"/></svg>',

    whatsapp:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M3.6 20.4l1.3-4a8.4 8.4 0 1 1 3.2 3.1l-4.5.9Z"/>' +
      '<path d="M9 8.9c.3 2.7 2.6 5 5.3 5.5l1-1.5 1.9.9c-.4 1.6-1.8 2.3-3.4 2.1-3.4-.4-6.3-3.3-6.7-6.7-.2-1.5.6-2.9 2.1-3.3l.9 1.9L9 8.9Z"/></svg>',

    instagram:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5"/>' +
      '<circle cx="12" cy="12" r="4"/><circle cx="16.9" cy="7.1" r=".9" fill="currentColor"/></svg>',

    email:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<rect x="3" y="5.2" width="18" height="13.6" rx="2.4"/>' +
      '<path d="m3.8 7 8.2 5.9L20.2 7"/></svg>'
  };

  var PARSER;
  function svgEl(name, className) {
    if (!PARSER) PARSER = document.implementation.createHTMLDocument("");
    PARSER.body.innerHTML = ICONS[name] || "";
    var node = PARSER.body.firstElementChild;
    if (!node) return el("span");
    if (className) node.setAttribute("class", className);
    return document.importNode(node, true);
  }

  /* ====================== channels ====================== */

  var CHANNEL = {
    messenger: {
      order: "Order on Messenger",
      plain: "Message us on Messenger",
      short: "Messenger",
      handle: function (v) { return "m.me/" + v; }
    },
    whatsapp: {
      order: "Order on WhatsApp",
      plain: "Message us on WhatsApp",
      short: "WhatsApp",
      handle: function (v) { return "+" + String(v).replace(/[^\d]/g, ""); }
    },
    instagram: {
      order: "Ask on Instagram",
      plain: "Message us on Instagram",
      short: "Instagram",
      handle: function (v) { return "@" + v; }
    },
    email: {
      order: "Email us",
      plain: "Email us",
      short: "Email",
      handle: function (v) { return v; }
    }
  };

  function handleFor(id) {
    var value = C.channels && C.channels[id];
    return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
  }

  function isAvailable(id) {
    return !!handleFor(id) && !!CHANNEL[id];
  }

  function availableChannels() {
    var order = (C.order && C.order.priority) || ["messenger", "whatsapp", "instagram", "email"];
    return order.filter(isAvailable);
  }

  function primaryChannel() {
    return availableChannels()[0] || "";
  }

  function encode(text) {
    return encodeURIComponent(text);
  }

  /* The order message lives in the content file as a template with {name} and
     {code} tokens, because that file has to be plain data the admin can write.
     A function is still honoured if one turns up in an older content file. */
  function messageFor(product) {
    if (!product) return (C.order && C.order.genericMessage) || "";
    if (C.order && typeof C.order.message === "function") return C.order.message(product);

    var template = (C.order && C.order.messageTemplate) || "";
    return template
      .replace(/\{name\}/g, product.name)
      .replace(/\{code\}/g, product.code || "");
  }

  /* Builds the destination for a channel. `product` may be null for a
     general enquiry. Returns "" when the channel is not configured. */
  function channelUrl(id, product) {
    var handle = handleFor(id);
    if (!handle) return "";
    var text = messageFor(product);

    switch (id) {
      case "messenger":
        return "https://m.me/" + encode(handle) + "?ref=" +
               encode(product ? product.slug : "site") +
               (C.order.messengerPrefillText ? "&text=" + encode(text) : "");

      case "whatsapp":
        return "https://wa.me/" + String(handle).replace(/[^\d]/g, "") + "?text=" + encode(text);

      case "instagram":
        return "https://instagram.com/" + encode(handle);

      case "email": {
        var subject = product ? "Order — " + product.name + " (" + product.code + ")" : "Enquiry";
        return "mailto:" + handle + "?subject=" + encode(subject) + "&body=" + encode(text);
      }

      default:
        return "";
    }
  }

  /* Anchor for one channel. Always opens in a new tab for web channels,
     and carries rel="noopener" so the target cannot reach back. */
  function channelLink(id, product, opts) {
    var options = opts || {};
    var url = channelUrl(id, product);
    if (!url) return null;

    var isMail = id === "email";
    var link = el("a", {
      class: options.className || "btn btn--primary",
      href: url,
      target: isMail ? null : "_blank",
      rel: isMail ? null : "noopener",
      "data-channel": id
    });

    if (options.withIcon !== false) link.appendChild(svgEl(id, "btn__icon"));
    link.appendChild(el("span", {
      text: product
        ? (options.label || CHANNEL[id].order)
        : (options.label || CHANNEL[id].plain)
    }));
    return link;
  }

  function channelButtons(product, opts) {
    var options = opts || {};
    var wrap = el("div", { class: options.className || "actions actions--stack" });
    var ids = availableChannels();

    ids.forEach(function (id, index) {
      var link = channelLink(id, product, {
        className: index === 0 ? "btn btn--primary" : "btn btn--secondary",
        withIcon: true
      });
      if (link) wrap.appendChild(link);
    });

    if (!ids.length) {
      wrap.appendChild(el("a", {
        class: "btn btn--primary",
        href: "./contact.html",
        text: "See how to reach us"
      }));
    }
    return wrap;
  }

  /* ====================== media ====================== */

  function placeholderBlock(product, opts) {
    var options = opts || {};
    var box = el("div", { class: "placeholder" });
    /* The real emblem, pulled from the brand folder rather than redrawn here,
       so there is exactly one copy of the artwork in the project. */
    box.appendChild(el("img", {
      class: "placeholder__mark",
      src: "./assets/img/brand/mark.svg",
      alt: "",
      width: 44,
      height: 44,
      loading: "lazy",
      decoding: "async"
    }));
    box.appendChild(el("p", { class: "placeholder__name", text: product.name }));
    box.appendChild(el("p", {
      class: "placeholder__note",
      text: options.note || "Photograph coming soon"
    }));
    return box;
  }

  /* The smallest entry in a srcset, so a 56px thumbnail does not download a
     1600px photograph. */
  function smallestSource(image) {
    var candidates = (image.srcset || "")
      .split(",")
      .map(function (part) {
        var bits = part.trim().split(/\s+/);
        return { url: bits[0], width: parseInt(bits[1], 10) || 0 };
      })
      .filter(function (candidate) { return !!candidate.url; });

    if (!candidates.length) return image.src;
    candidates.sort(function (a, b) { return a.width - b.width; });
    return candidates[0].url;
  }

  /* Photographs fade in as they arrive, so a slow connection fills the grid in
     rather than making it jump about. The attribute that makes an image start
     transparent is only ever added from here, so without JavaScript every
     photograph is visible from the first frame.

     Deliberately skipped for two kinds of image:
       • the smallest variant, used for thumbnails — a strip of them fading in
         one by one is busier than the thing it is dressing
       • eager images, which is the hero — fading the largest, most important
         picture on the page would delay the one thing people are waiting for,
         and an element at zero opacity is not counted as painted. */
  function revealOnLoad(node) {
    function show() { node.classList.add("is-revealed"); }

    if (node.complete && node.naturalWidth) return;

    node.dataset.reveal = "";
    node.addEventListener("load", show, { once: true });
    node.addEventListener("error", show, { once: true });

    /* It can finish between that check and these listeners going on. */
    if (node.complete) show();
  }

  /* One <img> from one stored photograph. Width and height are always set so
     the page does not shift about as photographs arrive. */
  function imageElement(product, image, opts) {
    var options = opts || {};
    var node = el("img", {
      src: options.smallest ? smallestSource(image) : image.src,
      alt: options.withAlt === false
        ? ""
        : (options.alt || product.alt || product.name || ""),
      loading: options.priority ? "eager" : "lazy",
      decoding: options.priority ? "sync" : "async",
      fetchpriority: options.priority ? "high" : null,
      width: image.width,
      height: image.height
    });

    if (options.className) node.className = options.className;
    if (!options.smallest && image.srcset) node.setAttribute("srcset", image.srcset);
    if (!options.smallest && options.sizes) node.setAttribute("sizes", options.sizes);
    if (!options.smallest && !options.priority) revealOnLoad(node);
    return node;
  }

  function mediaBlock(product, opts) {
    var options = opts || {};
    var wrap = el("div", { class: options.className || "tile__media" });
    var images = product.images || [];

    if (images.length) {
      wrap.appendChild(imageElement(product, images[0], {
        priority: options.priority,
        alt: options.alt,
        sizes: options.sizes || "(min-width: 62rem) 30vw, (min-width: 40rem) 45vw, 92vw"
      }));
    } else {
      wrap.appendChild(placeholderBlock(product, { note: options.note }));
    }
    return wrap;
  }

  /* The dialog's media column: the cover photograph, and a strip of thumbnails
     when the piece has more than one. site.js swaps the cover on a click. */
  function galleryMedia(product) {
    var images = product.images || [];
    var wrap = el("div", { class: "detail__media" });

    if (!images.length) {
      wrap.appendChild(placeholderBlock(product, { note: "Photograph coming soon" }));
      return wrap;
    }

    wrap.appendChild(imageElement(product, images[0], {
      className: "detail__main",
      priority: true,
      sizes: "(min-width: 46rem) 46vw, 100vw"
    }));

    if (images.length > 1) {
      var strip = el("div", {
        class: "detail__thumbs",
        role: "group",
        "aria-label": "All photographs of this piece"
      });

      images.forEach(function (image, index) {
        /* The full-size details ride on the button, so switching the cover does
           not need to go looking for the product again. */
        var button = el("button", {
          class: "detail__thumb",
          type: "button",
          "data-gallery-thumb": String(index),
          "aria-pressed": index === 0 ? "true" : "false"
        });
        button.dataset.src = image.src;
        button.dataset.srcset = image.srcset || "";
        button.dataset.width = String(image.width);
        button.dataset.height = String(image.height);

        button.appendChild(imageElement(product, image, { smallest: true, withAlt: false }));
        strip.appendChild(button);
      });

      wrap.appendChild(strip);
    }
    return wrap;
  }

  /* ====================== product tile ====================== */

  function categoryLabel(id) {
    var found = (C.categories || []).filter(function (c) { return c.id === id; })[0];
    return found ? found.label : "Hand embroidered";
  }

  function priceLabel(product) {
    if (typeof product.price === "number" && isFinite(product.price)) {
      return "৳" + product.price.toLocaleString("en-IN");
    }
    return product.priceNote || "DM for price";
  }

  /* opts.crossLink sends home-page tiles to the shop page, where the detail
     dialog lives, rather than opening a dialog on the home page itself. */
  function tile(product, opts) {
    var options = opts || {};
    var link = el("a", {
      href: options.crossLink ? "./shop.html#" + product.slug : "#" + product.slug,
      text: product.name
    });
    if (!options.crossLink) link.setAttribute("data-detail", product.slug);
    link.setAttribute("aria-label", product.name + " — details and ordering");

    return el("li", {
      class: "tile",
      dataset: { product: product.slug, category: product.category }
    }, [
      mediaBlock(product),
      el("div", { class: "tile__body" }, [
        el("h3", { class: "tile__name" }, link),
        el("p", { class: "tile__tag", text: categoryLabel(product.category) }),
        el("p", { class: "tile__price", text: priceLabel(product) })
      ])
    ]);
  }

  /* ====================== category card ====================== */

  function categoryCard(category, count) {
    return el("li", null, el("a", {
      class: "category-card",
      href: "./shop.html?c=" + encodeURIComponent(category.id)
    }, [
      el("span", { class: "category-card__name", text: category.label }),
      el("span", { class: "category-card__count", text: count + (count === 1 ? " piece" : " pieces") }),
      category.note ? el("span", { class: "category-card__seam", text: category.note }) : null
    ]));
  }

  /* ====================== detail dialog content ====================== */

  function detailContent(product) {
    var close = el("button", {
      class: "detail__close",
      type: "button",
      "data-detail-close": "",
      "aria-label": "Close"
    }, "✕");

    var actions = el("div", { class: "detail__footer" });
    actions.appendChild(channelButtons(product, { className: "actions actions--stack" }));

    if (C.order && (C.order.messageTemplate || C.order.message)) {
      var copyChip = el("button", {
        class: "chip chip--code",
        type: "button",
        "data-copy": product.code,
        text: "Reference " + product.code + " — copy"
      });
      var status = el("p", {
        class: "small muted",
        "aria-live": "polite",
        text: "Quote this reference in your message so we know which piece you mean."
      });
      actions.appendChild(el("div", { class: "actions" }, copyChip));
      actions.appendChild(status);
    }

    var specs = el("dl", { class: "detail__specs" });
    if (product.materials) {
      specs.appendChild(el("dt", { text: "Materials" }));
      specs.appendChild(el("dd", { text: product.materials }));
    }
    if (product.care) {
      specs.appendChild(el("dt", { text: "Care" }));
      specs.appendChild(el("dd", { text: product.care }));
    }
    specs.appendChild(el("dt", { text: "Price" }));
    specs.appendChild(el("dd", { text: priceLabel(product) }));

    /* The "photographs are coming" note sits high, directly under the title.
       It explains the placeholder, so it must not be buried, and it must stay
       clear of the sticky order footer at the bottom of the scroll area. */
    var photoNote = product.images && product.images.length
      ? null
      : el("p", {
          class: "detail__note",
          text: "Photographs of this piece are on the way. Message us and we will send them straight away."
        });

    var body = el("div", { class: "detail__body" }, [
      el("h2", { class: "detail__title", id: "detail-title", text: product.name }),
      el("p", { class: "detail__meta" }, [
        el("span", { text: categoryLabel(product.category) }),
        el("span", { text: "Ref " + product.code })
      ]),
      photoNote,
      el("p", { text: product.description || product.blurb || "" }),
      specs,
      actions
    ]);

    return el("div", { class: "detail__scroll", dataset: { detailBody: product.slug } }, [
      close,
      galleryMedia(product),
      body
    ]);
  }

  /* ====================== static sections ====================== */

  function productsIn(categoryId) {
    return (C.products || []).filter(function (p) {
      return !categoryId || p.category === categoryId;
    });
  }

  function renderCategories() {
    qsa("[data-render='categories']").forEach(function (list) {
      clear(list);
      (C.categories || []).forEach(function (category) {
        list.appendChild(categoryCard(category, productsIn(category.id).length));
      });
    });
  }

  function renderFeatured() {
    qsa("[data-render='featured']").forEach(function (list) {
      clear(list);
      var featured = (C.products || []).filter(function (p) { return p.featured; });
      if (!featured.length) featured = (C.products || []).slice(0, 6);
      featured.slice(0, 6).forEach(function (product) {
        list.appendChild(tile(product, { crossLink: true }));
      });
    });
  }

  function renderProducts() {
    qsa("[data-render='products']").forEach(function (list) {
      clear(list);
      (C.products || []).forEach(function (product) {
        list.appendChild(tile(product));
      });
    });
  }

  function renderProcess() {
    qsa("[data-render='process']").forEach(function (list) {
      clear(list);
      (C.process || []).forEach(function (step, index) {
        list.appendChild(el("li", null, [
          el("span", { class: "process__step", text: "Step " + (index + 1) }),
          el("h3", { class: "process__title", text: step.title }),
          el("p", { text: step.body })
        ]));
      });
    });
  }

  function renderReviews() {
    qsa("[data-render='reviews']").forEach(function (list) {
      clear(list);
      ((C.about && C.about.reviews) || []).forEach(function (review) {
        list.appendChild(el("li", null, el("figure", { class: "review" }, [
          el("blockquote", { class: "review__quote" }, el("p", { text: "“" + review.quote + "”" })),
          el("figcaption", {
            text: review.author + (review.source ? " · " + review.source : "")
          })
        ])));
      });
    });
  }

  function renderFaq() {
    qsa("[data-render='faq']").forEach(function (list) {
      clear(list);
      ((C.contact && C.contact.faq) || []).forEach(function (item) {
        list.appendChild(el("div", { class: "faq__item" }, [
          el("details", null, [
            el("summary", { class: "faq__summary", text: item.q }),
            el("div", { class: "faq__body" }, el("p", { text: item.a }))
          ])
        ]));
      });
    });
  }

  /* Contact-page rows: light cards with an icon. */
  function channelCard(id) {
    var handle = handleFor(id);
    return el("li", null, el("a", {
      class: "channel",
      href: channelUrl(id),
      target: id === "email" ? null : "_blank",
      rel: id === "email" ? null : "noopener",
      "data-channel": id
    }, [
      svgEl(id, "channel__icon"),
      el("span", null, [
        el("span", { class: "channel__label", text: CHANNEL[id].short }),
        el("span", { class: "channel__handle", text: CHANNEL[id].handle(handle) })
      ])
    ]));
  }

  /* Footer rows: plain links, because the footer sits on the dark ink ground
     and the card treatment would put near-white text on near-white paper. */
  function channelPlain(id) {
    var handle = handleFor(id);
    return el("li", null, el("a", {
      class: "site-footer__channel",
      href: channelUrl(id),
      target: id === "email" ? null : "_blank",
      rel: id === "email" ? null : "noopener",
      "data-channel": id
    }, [
      svgEl(id, "site-footer__channel-icon"),
      el("span", null, [
        el("span", { class: "site-footer__channel-label", text: CHANNEL[id].short }),
        el("span", { class: "site-footer__channel-handle", text: CHANNEL[id].handle(handle) })
      ])
    ]));
  }

  function renderChannelLists() {
    var ids = availableChannels();

    qsa("[data-render='channels']").forEach(function (list) {
      clear(list);
      ids.forEach(function (id) { list.appendChild(channelCard(id)); });
    });

    qsa("[data-render='channels-plain']").forEach(function (list) {
      clear(list);
      ids.forEach(function (id) { list.appendChild(channelPlain(id)); });
    });
  }

  function renderChannelActions() {
    qsa("[data-render='channel-actions']").forEach(function (wrap) {
      var slug = wrap.getAttribute("data-product");
      var product = slug ? productBySlug(slug) : null;
      var fresh = channelButtons(product, { className: wrap.className });
      wrap.parentNode.replaceChild(fresh, wrap);
    });
  }

  function renderOrderCta() {
    var id = primaryChannel();
    qsa("[data-render='order-cta']").forEach(function (link) {
      if (!id) {
        link.href = "./contact.html";
        link.textContent = "How to order";
        return;
      }
      link.href = channelUrl(id);
      link.target = id === "email" ? null : "_blank";
      if (id !== "email") link.rel = "noopener";
      link.setAttribute("data-channel", id);
      link.textContent = "Message us";
    });
  }

  /* Until a photograph exists the hero shows the full logo rather than an empty
     frame, so the one piece of finished artwork the brand owns is doing work on
     the homepage instead of sitting unused in a folder. */
  function renderHeroMedia() {
    qsa("[data-render='hero-media']").forEach(function (wrap) {
      var photo = C.home && C.home.heroPhoto;
      var hasPhoto = !!(photo && typeof photo === "object" && photo.src);

      if (hasPhoto) {
        wrap.insertBefore(imageElement(
          { alt: (C.home && C.home.heroCaption) || "A hand-embroidered piece by Cozy Stitches" },
          photo,
          { priority: true, sizes: "100vw" }
        ), wrap.firstChild);
      } else {
        wrap.insertBefore(el("div", { class: "hero-brand" }, el("img", {
          class: "brand-plate",
          src: "./assets/img/brand/logo.svg",
          alt: "The Cozy Stitches logo: a needle and thread stitched into a heart, " +
               "above the name Cozy Stitches and the words Threads and Needles.",
          width: 500,
          height: 500,
          loading: "eager",
          decoding: "async"
        })), wrap.firstChild);
      }

      /* The caption describes whatever is actually in the frame: the piece
         photographed, or the fact that a photograph is still missing. */
      setText("[data-render='hero-caption']", hasPhoto
        ? ((C.home && C.home.heroCaption) || "")
        : ((C.home && C.home.heroPlaceholder) || "Photograph coming soon"));
    });
  }

  function renderText() {
    setText("[data-render='brand']", C.brand.name);
    setText("[data-render='tagline']", C.brand.tagline);
    setText("[data-render='subline']", C.brand.subline);
    setText("[data-render='footer-note']", C.footer ? C.footer.note : "");
    setText("[data-render='year']", String(new Date().getFullYear()));

    if (C.home) {
      setText("[data-render='hero-heading']", C.home.heroHeading);
      setText("[data-render='hero-lede']", C.home.heroLede);
      setText("[data-render='categories-heading']", C.home.categoriesHeading);
      setText("[data-render='featured-heading']", C.home.featuredHeading);
      setText("[data-render='featured-note']", C.home.featuredNote);
      setText("[data-render='process-heading']", C.home.processHeading);
      setText("[data-render='cta-heading']", C.home.ctaHeading);
      setText("[data-render='cta-body']", C.home.ctaBody);
    }
    if (C.about) {
      setText("[data-render='about-heading']", C.about.heading);
      setText("[data-render='about-lead']", C.about.lead);
      setText("[data-render='materials-heading']", C.about.materials.heading);
      setText("[data-render='care-heading']", C.about.care.heading);
      setText("[data-render='reviews-heading']", C.about.reviewsHeading);
      setText("[data-render='mark-heading']", C.about.markHeading);
      setText("[data-render='mark-body']", C.about.markBody);
    }
    if (C.contact) {
      setText("[data-render='contact-heading']", C.contact.heading);
      setText("[data-render='contact-lead']", C.contact.lead);
      setText("[data-render='shipping-heading']", C.contact.shipping.heading);
      setText("[data-render='payments-heading']", C.contact.payments.heading);
      setText("[data-render='custom-heading']", C.contact.custom.heading);
      setText("[data-render='custom-body']", C.contact.custom.body);
    }
  }

  function renderProse() {
    qsa("[data-render='about-body']").forEach(function (wrap) {
      clear(wrap);
      ((C.about && C.about.body) || []).forEach(function (paragraph) {
        wrap.appendChild(el("p", { text: paragraph }));
      });
    });

    qsa("[data-render='materials-list']").forEach(function (list) {
      clear(list);
      ((C.about && C.about.materials.items) || []).forEach(function (item) {
        list.appendChild(el("li", null, [
          el("span", { class: "spec-list__key", text: item.key }),
          el("span", { text: item.value })
        ]));
      });
    });

    qsa("[data-render='care-list']").forEach(function (list) {
      clear(list);
      ((C.about && C.about.care.items) || []).forEach(function (item) {
        list.appendChild(el("li", { text: item }));
      });
    });

    [["[data-render='shipping-list']", C.contact && C.contact.shipping],
     ["[data-render='payments-list']", C.contact && C.contact.payments]
    ].forEach(function (pair) {
      qsa(pair[0]).forEach(function (list) {
        clear(list);
        ((pair[1] && pair[1].items) || []).forEach(function (item) {
          list.appendChild(el("li", { text: item }));
        });
      });
    });

    qsa("[data-render='footer-links']").forEach(function (list) {
      clear(list);
      ((C.footer && C.footer.links) || []).forEach(function (link) {
        list.appendChild(el("li", null, el("a", { href: link.href, text: link.label })));
      });
    });
  }

  /* ====================== lookups ====================== */

  function productBySlug(slug) {
    return (C.products || []).filter(function (p) { return p.slug === slug; })[0] || null;
  }

  function categoryById(id) {
    return (C.categories || []).filter(function (c) { return c.id === id; })[0] || null;
  }

  /* ====================== public API ====================== */

  window.CozyUI = {
    el: el,
    append: append,
    qsa: qsa,
    clear: clear,
    setText: setText,
    svgEl: svgEl,
    CHANNEL: CHANNEL,
    isAvailable: isAvailable,
    availableChannels: availableChannels,
    primaryChannel: primaryChannel,
    handleFor: handleFor,
    channelUrl: channelUrl,
    channelLink: channelLink,
    channelButtons: channelButtons,
    productBySlug: productBySlug,
    categoryById: categoryById,
    categoryLabel: categoryLabel,
    priceLabel: priceLabel,
    tile: tile,
    detailContent: detailContent,
    productsIn: productsIn,
    renderAll: function () {
      renderText();
      renderCategories();
      renderFeatured();
      renderProducts();
      renderProcess();
      renderReviews();
      renderFaq();
      renderProse();
      renderChannelLists();
      renderOrderCta();
      renderHeroMedia();
      renderChannelActions();
    }
  };
})();
