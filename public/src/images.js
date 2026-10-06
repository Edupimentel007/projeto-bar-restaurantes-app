import { escapeHtml } from "./utils.js";

const productImages = new Map([
  ["/assets/products/original-600-transparent.png", { stem: "original-600-transparent", ratio: 1 }],
  ["/assets/products/brahma-duplo-malte-350-transparent.png", { stem: "brahma-duplo-malte-350-transparent", ratio: 1 }],
  ["/assets/products/heineken-long-neck-330-transparent.png", { stem: "heineken-long-neck-330-transparent", ratio: 1 }],
  ["/assets/products/skol-pilsen-350-transparent.png", { stem: "skol-pilsen-350-transparent", ratio: 1 }],
  ["/assets/products/coca-cola-original-350-transparent.png", { stem: "coca-cola-original-350-transparent", ratio: 1 }],
  ["/assets/products/coca-cola-zero-350-transparent.png", { stem: "coca-cola-zero-350-transparent", ratio: 1 }],
  ["/assets/products/guarana-antarctica-350.png", { stem: "guarana-antarctica-350", ratio: 1.5 }],
  ["/assets/products/crystal-sem-gas-500.webp", { stem: "crystal-sem-gas-500", ratio: 1 }],
  ["/assets/products/crystal-com-gas-500-transparent.png", { stem: "crystal-com-gas-500-transparent", ratio: 1 }]
]);

const brandImage = {
  source: "/assets/bar-do-nardo-logo.png",
  stem: "bar-do-nardo-logo",
  ratio: 1
};

function renderImage(source, alt, entry, directory, widths, options) {
  const settings = options || {};
  const sizes = escapeHtml(settings.sizes || widths[0] + "px");
  const loading = settings.loading === "lazy" ? ' loading="lazy"' : "";
  const fetchPriority = ["high", "low"].includes(settings.fetchPriority)
    ? ' fetchpriority="' + settings.fetchPriority + '"'
    : "";
  const className = settings.className ? ' class="' + escapeHtml(settings.className) + '"' : "";
  const renderedWidth = widths[0];
  const renderedHeight = Math.round(renderedWidth * entry.ratio);
  const sourceSet = (extension) => widths.map((width) =>
    "/assets/responsive/" + directory + "/" + width + "/" + entry.stem + "." + extension + " " + width + "w"
  ).join(", ");

  return [
    "<picture>",
    '<source type="image/avif" srcset="' + sourceSet("avif") + '" sizes="' + sizes + '" />',
    '<source type="image/webp" srcset="' + sourceSet("webp") + '" sizes="' + sizes + '" />',
    '<img src="' + escapeHtml(source) + '" alt="' + escapeHtml(alt || "") + '" width="' + renderedWidth +
      '" height="' + renderedHeight + '" decoding="async"' + loading + fetchPriority + className + " />",
    "</picture>"
  ].join("");
}

export function productImage(source, alt, options) {
  const safeSource = String(source || "");
  const entry = productImages.get(safeSource);
  if (!entry) {
    const settings = options || {};
    const loading = settings.loading === "lazy" ? ' loading="lazy"' : "";
    return '<img src="' + escapeHtml(safeSource) + '" alt="' + escapeHtml(alt || "") +
      '" decoding="async"' + loading + " />";
  }

  return renderImage(safeSource, alt, entry, "products", [160, 320], options);
}

export function brandLogo(alt, options) {
  return renderImage(brandImage.source, alt, brandImage, "branding", [160, 320, 640], options);
}
