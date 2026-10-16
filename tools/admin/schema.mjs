/* ==========================================================================
   Cozy Stitches — content schema
   --------------------------------------------------------------------------
   ONE definition of the shape of js/content.json.

   It is read by two things and they must never disagree:
     • tools/admin/public/admin.js   builds the editor forms from it
     • tools/admin/lib/validate.mjs  checks every save against it

   Field types
     text          single line
     textarea      multi-line
     paragraphs    a list of multi-line paragraphs
     number        numeric, may be null
     price         numeric in taka, may be null (null shows "DM for price")
     boolean       checkbox
     select        one of `options`, or of another section's entries via `from`
     slug          url-safe id, unique across the document
     code          short reference, unique across the document
     channel       a handle, validated per channel
     stringList    a list of single lines
     objectList    a repeatable set of fields
     group         a nested fixed set of fields
     image         one uploaded photograph, or null
     imageList     a reorderable set of uploaded photographs

   `help` text is shown under the input. It replaces the guidance comments that
   used to live in the hand-written content.js, which is now generated.
   ========================================================================== */

export const tabs = [
  { id: "products",   label: "Products",   sections: ["products"] },
  { id: "categories", label: "Categories", sections: ["categories"] },
  { id: "site",       label: "Site",       sections: ["brand", "channels", "order", "home", "footer"] },
  { id: "structure",  label: "Words",      sections: ["process", "about", "contact"] }
];

export const schema = {

  /* ======================= products ====================================== */
  products: {
    label: "Products",
    singular: "product",
    type: "objectList",
    addLabel: "Add a product",
    titleField: "name",
    subtitleField: "code",
    fields: {
      name: {
        label: "Name",
        type: "text",
        required: true,
        maxLength: 80,
        help: "What it is called in the shop."
      },
      slug: {
        label: "Link name",
        type: "slug",
        required: true,
        help: "Becomes the shareable link: shop.html#your-link-name. Lower case, " +
              "dashes instead of spaces. Filled in from the name if you leave it blank."
      },
      category: {
        label: "Category",
        type: "select",
        from: "categories",
        valueField: "id",
        displayField: "label",
        required: true
      },
      code: {
        label: "Reference code",
        type: "code",
        required: true,
        help: "Short and unique, like CS-BAG-01. This is what a customer quotes " +
              "so you know which piece to make."
      },
      price: {
        label: "Price",
        type: "price",
        help: "Leave empty to show “DM for price” instead."
      },
      priceNote: {
        label: "Instead of a price, show",
        type: "text",
        maxLength: 40,
        help: "Only used when the price above is empty."
      },
      featured: {
        label: "Feature on the home page",
        type: "boolean",
        help: "Six featured pieces fill the home page mosaic exactly. A seventh " +
              "starts a new row."
      },
      blurb: {
        label: "One-line description",
        type: "textarea",
        maxLength: 200,
        help: "Shown under the name in lists."
      },
      description: {
        label: "Full description",
        type: "textarea",
        help: "Shown when the piece is opened. Two to four sentences reads best."
      },
      materials: {
        label: "Materials",
        type: "text",
        help: "For example: Cotton canvas, cotton embroidery thread, metal zip"
      },
      care: {
        label: "Care",
        type: "text",
        help: "One or two short sentences."
      },
      alt: {
        label: "Photograph description",
        type: "text",
        help: "Read aloud by screen readers, and shown if a photograph fails to " +
              "load. Describe the picture rather than repeating the name."
      },
      images: {
        label: "Photographs",
        type: "imageList",
        imageDir: "products",
        nameFrom: "slug",
        help: "The first one is the cover. They are resized and converted for " +
              "the web automatically — upload the originals from your phone."
      }
    }
  },

  /* ======================= categories ==================================== */
  categories: {
    label: "Categories",
    singular: "category",
    type: "objectList",
    addLabel: "Add a category",
    titleField: "label",
    subtitleField: "id",
    fields: {
      label: {
        label: "Name",
        type: "text",
        required: true,
        maxLength: 50,
        help: "Shown on the cards and on the shop's filter buttons."
      },
      id: {
        label: "Short name",
        type: "slug",
        required: true,
        help: "Used in links, like shop.html?c=pouches. Lower case, no spaces."
      },
      note: {
        label: "Note",
        type: "text",
        maxLength: 60,
        help: "A few words on the category card, for example “Totes and crossbodies”."
      }
    }
  },

  /* ======================= brand ======================================== */
  brand: {
    label: "Brand",
    type: "group",
    fields: {
      name: { label: "Business name", type: "text", required: true, maxLength: 60 },
      tagline: {
        label: "Tagline",
        type: "textarea",
        maxLength: 160,
        help: "Appears in the footer and on the About page."
      },
      subline: { label: "Sub-line", type: "text", maxLength: 120 },
      location: { label: "Location", type: "text", maxLength: 60 },
      category: {
        label: "Page category",
        type: "text",
        maxLength: 40,
        help: "What Facebook calls the page. Not currently shown on the site."
      }
    }
  },

  /* ======================= channels ===================================== */
  channels: {
    label: "Where orders come in",
    type: "group",
    help: "Leave any of these empty and its buttons disappear from the whole " +
          "site — nothing ever points at a channel you have not set.",
    fields: {
      messenger: {
        label: "Messenger page name",
        type: "channel",
        maxLength: 60,
        help: "From facebook.com/your-name. Example: cozy.stitches07"
      },
      whatsapp: {
        label: "WhatsApp number",
        type: "channel",
        help: "Digits only, country code first, no plus sign and no spaces. " +
              "Example: 8801712345678"
      },
      instagram: {
        label: "Instagram name",
        type: "channel",
        help: "Without the @. Leave empty to hide the Instagram buttons."
      },
      email: {
        label: "Email",
        type: "channel",
        help: "For wholesale and collaboration enquiries. Leave empty to hide."
      }
    }
  },

  /* ======================= order message ================================ */
  order: {
    label: "The order message",
    type: "group",
    fields: {
      messageTemplate: {
        label: "Message a customer sends",
        type: "textarea",
        required: true,
        help: "{name} becomes the product name and {code} its reference. This " +
              "arrives already typed when someone taps an order button."
      },
      genericMessage: {
        label: "Message from a general button",
        type: "textarea",
        required: true,
        help: "Used by the buttons that are not attached to one product."
      },
      priority: {
        label: "Order of preference",
        type: "stringList",
        options: ["messenger", "whatsapp", "instagram", "email"],
        help: "The first one that is set gets the main button everywhere."
      },
      messengerPrefillText: {
        label: "Also send the message to Messenger",
        type: "boolean",
        help: "Facebook documents the reference parameter but not pre-filled " +
              "text. Turn this on only if you have tested it and the message " +
              "arrives already written."
      }
    }
  },

  /* ======================= home page ==================================== */
  home: {
    label: "Home page",
    type: "group",
    fields: {
      heroPhoto: {
        label: "Hero photograph",
        type: "image",
        imageDir: "hero",
        help: "The large picture beside the headline. Until you add one, the " +
              "frame shows your logo. A landscape shot, roughly 3:2, works best."
      },
      heroCaption: {
        label: "Hero caption",
        type: "text",
        help: "One line under the hero picture, usually naming the piece shown."
      },
      heroPlaceholder: {
        label: "Hero caption while there is no photograph",
        type: "text",
        help: "Only shown until you upload a hero photograph."
      },
      heroHeading: { label: "Headline", type: "text", required: true, maxLength: 120 },
      heroLede: { label: "Intro line", type: "textarea", maxLength: 240 },
      categoriesHeading: { label: "Categories heading", type: "text", maxLength: 60 },
      featuredHeading: { label: "Featured heading", type: "text", maxLength: 60 },
      featuredNote: { label: "Featured note", type: "text", maxLength: 80 },
      processHeading: { label: "Ordering steps heading", type: "text", maxLength: 60 },
      ctaHeading: { label: "Closing heading", type: "text", maxLength: 80 },
      ctaBody: { label: "Closing paragraph", type: "textarea", maxLength: 300 }
    }
  },

  /* ======================= process ====================================== */
  process: {
    label: "How an order goes",
    singular: "step",
    type: "objectList",
    addLabel: "Add a step",
    titleField: "title",
    fields: {
      title: { label: "Step name", type: "text", required: true, maxLength: 40 },
      body: { label: "What happens", type: "textarea", required: true, maxLength: 240 }
    }
  },

  /* ======================= about ======================================== */
  about: {
    label: "About page",
    type: "group",
    fields: {
      heading: { label: "Heading", type: "text", required: true, maxLength: 80 },
      lead: { label: "Opening paragraph", type: "textarea", maxLength: 300 },
      body: {
        label: "Story",
        type: "paragraphs",
        help: "Each box is one paragraph."
      },
      materials: {
        label: "Materials",
        type: "group",
        fields: {
          heading: { label: "Heading", type: "text", maxLength: 40 },
          items: {
            label: "Rows",
            type: "objectList",
            addLabel: "Add a row",
            titleField: "key",
            fields: {
              key: { label: "Label", type: "text", required: true, maxLength: 30 },
              value: { label: "Value", type: "text", required: true, maxLength: 120 }
            }
          }
        }
      },
      care: {
        label: "Looking after it",
        type: "group",
        fields: {
          heading: { label: "Heading", type: "text", maxLength: 40 },
          items: { label: "Points", type: "stringList" }
        }
      },
      markHeading: { label: "Logo section heading", type: "text", maxLength: 40 },
      markBody: {
        label: "Logo section text",
        type: "textarea",
        maxLength: 500,
        help: "The paragraph beside the logo. The current wording only describes " +
              "what is drawn — replace it if the mark means more than that."
      },
      reviewsHeading: { label: "Reviews heading", type: "text", maxLength: 60 },
      reviews: {
        label: "Customer reviews",
        singular: "review",
        type: "objectList",
        addLabel: "Add a review",
        titleField: "author",
        fields: {
          quote: { label: "What they said", type: "textarea", required: true, maxLength: 400 },
          author: {
            label: "Name shown",
            type: "text",
            maxLength: 40,
            help: "“Verified buyer” keeps it anonymous. Only use a real name if " +
                  "that customer agreed."
          },
          source: { label: "Where it came from", type: "text", maxLength: 40 }
        }
      }
    }
  },

  /* ======================= contact ====================================== */
  contact: {
    label: "Contact page",
    type: "group",
    fields: {
      heading: { label: "Heading", type: "text", required: true, maxLength: 80 },
      lead: { label: "Opening paragraph", type: "textarea", maxLength: 300 },
      shipping: {
        label: "Delivery",
        type: "group",
        fields: {
          heading: { label: "Heading", type: "text", maxLength: 40 },
          items: {
            label: "Points",
            type: "stringList",
            help: "Put your real charges here, for example " +
                  "“Inside Dhaka — ৳80, 1 to 2 days”."
          }
        }
      },
      payments: {
        label: "Payment",
        type: "group",
        fields: {
          heading: { label: "Heading", type: "text", maxLength: 40 },
          items: { label: "Points", type: "stringList" }
        }
      },
      custom: {
        label: "Custom work",
        type: "group",
        fields: {
          heading: { label: "Heading", type: "text", maxLength: 40 },
          body: { label: "Paragraph", type: "textarea", maxLength: 500 }
        }
      },
      faq: {
        label: "Questions",
        singular: "question",
        type: "objectList",
        addLabel: "Add a question",
        titleField: "q",
        fields: {
          q: { label: "Question", type: "text", required: true, maxLength: 120 },
          a: { label: "Answer", type: "textarea", required: true, maxLength: 600 }
        }
      }
    }
  },

  /* ======================= footer ======================================= */
  footer: {
    label: "Footer",
    type: "group",
    fields: {
      note: { label: "Note", type: "text", maxLength: 160 },
      links: {
        label: "Page links",
        singular: "link",
        type: "objectList",
        addLabel: "Add a link",
        titleField: "label",
        fields: {
          label: { label: "Text", type: "text", required: true, maxLength: 30 },
          href: {
            label: "Link",
            type: "text",
            required: true,
            maxLength: 120,
            help: "A page on this site, like ./shop.html, or a full web address."
          }
        }
      }
    }
  }
};

/* Which sections hold records rather than settings. The editor treats these
   differently: records get a list view, settings get a form. */
export const listSections = Object.keys(schema).filter((k) => schema[k].type === "objectList");

export const channelIds = ["messenger", "whatsapp", "instagram", "email"];
