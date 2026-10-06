import {
  categoryById,
  escapeHtml,
  fullDate,
  makePixCode,
  money,
  statusPill
} from "./utils.js";
import { brandLogo, productImage } from "./images.js";

export function resolveTable(data, token) {
  const safeToken = String(token || "").trim();
  if (!safeToken) {
    return null;
  }
  return data.tables.find((item) => item.active && (item.qrToken === safeToken || item.id === safeToken)) || null;
}

export function getCartItems(data, cart) {
  return Object.entries(cart)
    .map(([productId, quantity]) => {
      const product = data.products.find((item) => {
        return item.id === productId && item.active && item.available !== false;
      });
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);
}

export function cartTotal(items) {
  return items.reduce((total, item) => total + item.priceCents * item.quantity, 0);
}

function renderProduct(product, quantity) {
  const isAvailable = product.available !== false;
  const availability = isAvailable
    ? '<button class="button button-small button-primary" data-action="add-item" data-id="' +
      escapeHtml(product.id) + '">Adicionar</button>'
    : '<span class="unavailable-label">Indisponível</span>';
  const badge = product.badge
    ? '<span class="product-badge">' + escapeHtml(product.badge) + "</span>"
    : product.featured ? '<span class="product-badge">Mais pedido</span>' : "";
  const count = quantity
    ? '<span class="in-cart-count">' + quantity + " no carrinho</span>"
    : "";
  const metadata = [product.brand, product.volume, product.packaging].filter(Boolean);
  const visual = product.imageUrl
    ? '<div class="product-visual has-image">' + productImage(product.imageUrl, product.imageAlt || product.name, {
      loading: "lazy",
      sizes: "(max-width: 620px) 80px, 94px"
    }) + "</div>"
    : '<div class="product-visual" aria-hidden="true"><span>' + escapeHtml(product.emoji) + "</span></div>";

  return [
    '<article class="product-card' + (isAvailable ? "" : " is-unavailable") + (product.imageUrl ? " has-product-image" : "") + '">',
    visual,
    '<div class="product-content">',
    '<div class="product-topline">',
    badge,
    count,
    "</div>",
    (metadata.length ? '<div class="product-meta">' + metadata.map((item) => '<span>' + escapeHtml(item) + "</span>").join("") + "</div>" : ""),
    '<h3>' + escapeHtml(product.name) + "</h3>",
    '<p>' + escapeHtml(product.description) + "</p>",
    '<div class="product-footer">',
    '<strong>' + money(product.priceCents) + "</strong>",
    availability,
    "</div>",
    "</div>",
    "</article>"
  ].join("");
}

function visibleProducts(data, ui) {
  const search = String(ui.search || "").toLocaleLowerCase("pt-BR");
  return data.products
    .filter((item) => item.active && item.available !== false)
    .filter((item) => ui.category === "all" || item.categoryId === ui.category)
    .filter((item) => !search || [item.name, item.description, item.brand, item.volume, item.packaging]
      .filter(Boolean).join(" ").toLocaleLowerCase("pt-BR").includes(search));
}

export function renderProductGrid(data, ui) {
  const products = visibleProducts(data, ui);
  return products.length
    ? products.map((product) => renderProduct(product, ui.cart[product.id] || 0)).join("")
    : '<div class="empty-state"><span>🍽️</span><h3>Nada por aqui</h3><p>Tente outra busca ou categoria.</p></div>';
}

function renderBrand(extraClass, table) {
  const tableToken = table && (table.qrToken || table.id);
  const homeUrl = tableToken ? "/?mesa=" + encodeURIComponent(tableToken) : "/";
  return '<a class="brand' + (extraClass ? " " + extraClass : "") + '" href="' + escapeHtml(homeUrl) +
    '" data-action="client-home" aria-label="Voltar ao início do cardápio">' +
    brandLogo("", { className: "brand-logo", sizes: "(max-width: 480px) 42px, 52px" }) +
    '<span class="brand-copy"><b>Bar do Nardo</b><small>Desde 1980</small></span></a>';
}

function renderThemeToggle(extraClass) {
  return '<button type="button" class="theme-toggle' + (extraClass ? " " + extraClass : "") +
    '" data-action="toggle-theme" aria-label="Alternar entre tema claro e escuro" title="Alternar tema">' +
    '<span class="theme-icon-sun" aria-hidden="true">☀</span><span class="theme-icon-moon" aria-hidden="true">☾</span></button>';
}

function renderCartItem(item) {
  const visual = item.imageUrl
    ? '<span class="cart-item-emoji has-image">' + productImage(item.imageUrl, "", {
      loading: "lazy",
      sizes: "34px"
    }) + "</span>"
    : '<span class="cart-item-emoji" aria-hidden="true">' + escapeHtml(item.emoji) + "</span>";
  return [
    '<li class="cart-item">',
    visual,
    '<div class="cart-item-details">',
    '<strong>' + escapeHtml(item.name) + "</strong>",
    '<span>' + money(item.priceCents) + " cada</span>",
    (!item.available ? '<small class="text-danger">Indisponível no momento</small>' : ""),
    "</div>",
    '<div class="cart-item-actions">',
    '<div class="quantity-control" aria-label="Quantidade de ' + escapeHtml(item.name) + '">',
    '<button class="icon-button" data-action="decrease-item" data-id="' + escapeHtml(item.id) + '" aria-label="Diminuir">−</button>',
    '<span>' + item.quantity + "</span>",
    '<button class="icon-button" data-action="increase-item" data-id="' + escapeHtml(item.id) + '" aria-label="Aumentar">+</button>',
    "</div>",
    '<strong>' + money(item.priceCents * item.quantity) + "</strong>",
    "</div>",
    "</li>"
  ].join("");
}

function renderCartDrawer(items, total) {
  if (!items.length) {
    return "";
  }

  return [
    '<div class="overlay" data-action="close-panel"></div>',
    '<aside class="side-panel cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title">',
    '<div class="panel-header">',
    '<div><p class="eyebrow">Seu pedido</p><h2 id="cart-title">Carrinho</h2></div>',
    '<button class="close-button" data-action="close-panel" aria-label="Fechar carrinho">×</button>',
    "</div>",
    '<ul class="cart-list">' + items.map(renderCartItem).join("") + "</ul>",
    '<div class="cart-summary">',
    '<div><span>Subtotal</span><strong>' + money(total) + "</strong></div>",
    '<p>Pagamento por Pix antes de enviar o pedido.</p>',
    '<button class="button button-primary button-block" data-action="open-checkout"' +
      (items.some((item) => !item.available) ? " disabled" : "") + '>Revisar e pagar</button>',
    "</div>",
    "</aside>"
  ].join("");
}

function renderCheckout(items, total, table) {
  return [
    '<div class="modal-backdrop" data-action="close-panel"></div>',
    '<section class="modal-card checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">',
    '<div class="panel-header">',
    '<div><p class="eyebrow">Confirme os detalhes</p><h2 id="checkout-title">Finalizar pedido</h2></div>',
    '<button class="close-button" data-action="close-panel" aria-label="Fechar">×</button>',
    "</div>",
    '<div class="checkout-table"><span>Pedido para</span><strong>' + escapeHtml(table.label) + "</strong></div>",
    '<ul class="compact-order-list">' + items.map((item) =>
      '<li><span>' + item.quantity + "× " + escapeHtml(item.name) + "</span><strong>" +
      money(item.priceCents * item.quantity) + "</strong></li>").join("") + "</ul>",
    '<div class="checkout-total"><span>Total</span><strong>' + money(total) + "</strong></div>",
    '<form id="checkout-form" class="form-stack">',
    '<label>Seu nome <span class="optional">(opcional)</span>',
    '<input name="customerName" maxlength="80" autocomplete="name" placeholder="Como podemos chamar você?" />',
    "</label>",
    '<label>Observação para o bar <span class="optional">(opcional)</span>',
    '<textarea name="customerNote" maxlength="280" rows="3" placeholder="Ex.: sem gelo, alergia, ponto do petisco"></textarea>',
    "</label>",
    '<div class="notice notice-info"><span aria-hidden="true">🔒</span><p>Seu pedido só será enviado ao bar após a confirmação do pagamento.</p></div>',
    '<button class="button button-primary button-block" type="submit">Gerar Pix de ' + money(total) + "</button>",
    '<button class="button button-ghost button-block" type="button" data-action="open-cart">Voltar ao carrinho</button>',
    "</form>",
    "</section>"
  ].join("");
}

function renderPayment(order) {
  const pixCode = makePixCode(order);
  return [
    '<div class="modal-backdrop modal-static"></div>',
    '<section class="modal-card payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title">',
    '<div class="centered-copy">',
    '<span class="payment-lock" aria-hidden="true">◈</span>',
    '<p class="eyebrow">Pix seguro</p>',
    '<h2 id="payment-title">Pague para liberar o pedido</h2>',
    '<p>Pedido ' + escapeHtml(order.publicCode) + " · " + fullDate(order.createdAt) + "</p>",
    "</div>",
    '<div class="demo-pix-code" aria-label="Código Pix de demonstração"><span>PIX</span></div>',
    '<p class="pix-payment-total"><span>Valor a pagar</span><strong>' + money(order.totalCents) + "</strong></p>",
    '<div class="notice notice-card-payment"><span aria-hidden="true">💳</span><p><strong>Prefere pagar no cartão?</strong> Vá até o balcão para passar o cartão na maquininha do proprietário.</p></div>',
    '<div class="notice notice-warning"><span aria-hidden="true">ℹ</span><p>Ambiente de demonstração. A confirmação abaixo simula o retorno aprovado do gateway Pix.</p></div>',
    '<label class="pix-copy-label">Pix copia e cola',
    '<div class="copy-field"><input readonly value="' + escapeHtml(pixCode) + '" aria-label="Código Pix" /><button type="button" class="button button-outline" data-action="copy-pix" data-copy="' + escapeHtml(pixCode) + '">Copiar</button></div>',
    "</label>",
    '<form id="payment-form" class="form-stack">',
    '<button class="button button-primary button-block" type="submit">Confirmar pagamento demonstrativo</button>',
    '<p class="helper-text">Após a confirmação, o pedido aparece imediatamente na tela do bar.</p>',
    "</form>",
    "</section>"
  ].join("");
}

function renderOrderConfirmation(order, table) {
  const steps = [
    ["Pagamento aprovado", true],
    ["Em preparo", order.status !== "NEW"],
    ["Pronto para servir", order.status === "READY" || order.status === "DELIVERED"],
    ["Entregue", order.status === "DELIVERED"]
  ];
  const readyPickupNotice = order.status === "READY"
    ? '<div class="notice ready-pickup-notice"><span aria-hidden="true">🔔</span><p><strong>Seu pedido está pronto!</strong> Ele está aguardando a entrega na mesa. Se estiver com muita pressa, você pode retirá-lo no balcão.</p></div>'
    : "";
  return [
    '<main class="confirmation-page client-shell">',
    '<header class="simple-client-header">',
    renderBrand("", table),
    renderThemeToggle(),
    "</header>",
    '<section class="confirmation-card">',
    '<div class="success-orb" aria-hidden="true">✓</div>',
    '<p class="eyebrow">Tudo certo</p>',
    '<h1>Pedido enviado ao bar!</h1>',
    '<p>O pagamento foi aprovado e o pedido <strong>' + escapeHtml(order.publicCode) + "</strong> está na fila.</p>",
    '<div class="confirmation-meta">',
    '<span>' + escapeHtml(order.tableLabel) + "</span>",
    '<span>' + fullDate(order.paidAt || order.createdAt) + "</span>",
    '<strong>' + money(order.totalCents) + "</strong>",
    "</div>",
    '<div class="status-track">' + steps.map((step) =>
      '<div class="track-step' + (step[1] ? " is-complete" : "") + '"><span>' +
      (step[1] ? "✓" : "") + "</span><p>" + step[0] + "</p></div>").join("") + "</div>",
    readyPickupNotice,
    '<div class="notice notice-info"><span aria-hidden="true">🍺</span><p>Você pode continuar aproveitando. O bar entregará seu pedido na mesa.</p></div>',
    '<button class="button button-outline button-block" data-action="new-order">Fazer outro pedido</button>',
    "</section>",
    "</main>"
  ].join("");
}

export function renderClient(data, ui, table) {
  if (ui.lastOrder && ui.lastOrder.tableId === table.id && ui.lastOrder.publicCode) {
    return renderOrderConfirmation(ui.lastOrder, table);
  }

  const cartItems = getCartItems(data, ui.cart);
  const total = cartTotal(cartItems);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const activeCategories = data.categories.filter((item) => item.active).sort((a, b) => a.sortOrder - b.sortOrder);

  return [
    '<div class="client-shell">',
    '<header class="client-topbar">',
    renderBrand("", table),
    '<div class="client-actions">',
    renderThemeToggle(),
    '<button class="link-button desktop-only" data-action="go-admin">Administração</button>',
    '<button class="cart-button" data-action="open-cart" aria-label="Abrir carrinho">',
    '<span aria-hidden="true">🛒</span>',
    (totalItems ? '<b>' + totalItems + "</b>" : ""),
    "</button>",
    "</div>",
    "</header>",
    '<main>',
    '<section class="client-hero">',
    '<div class="hero-copy">',
    '<p class="eyebrow">Tradição em Nova Odessa</p>',
    '<h1>Boteco de verdade, servido na sua mesa.</h1>',
    '<p>' + escapeHtml(data.bar.subtitle) + "</p>",
    '<div class="hero-pills"><span class="open-pill"><i></i>' + escapeHtml(data.bar.openingHours) + '</span><span class="table-pill">⌖ ' + escapeHtml(table.label) + "</span></div>",
    "</div>",
    '<div class="hero-glass">' + brandLogo("Bar do Nardo — desde 1980", {
      fetchPriority: "high",
      sizes: "(max-width: 620px) 104px, 172px"
    }) + '<small>Caipirinha<br />do Nardo<br />é da casa.</small></div>',
    "</section>",
    '<section class="menu-section" aria-labelledby="menu-title">',
    '<div class="menu-heading">',
    '<div><p class="eyebrow">Cardápio digital</p><h2 id="menu-title">Escolha seu pedido</h2></div>',
    '<div class="table-select-wrap"><span>Mesa identificada</span><strong>⌖ ' + escapeHtml(table.label) + "</strong></div>",
    "</div>",
    '<label class="search-field"><span aria-hidden="true">⌕</span><input data-action="search-menu" value="' + escapeHtml(ui.search) + '" placeholder="Buscar no cardápio" aria-label="Buscar produto" /></label>',
    '<nav class="category-tabs" aria-label="Categorias do cardápio">',
    '<button class="category-tab' + (ui.category === "all" ? " is-active" : "") + '" data-action="set-category" data-category="all">Todos</button>',
    activeCategories.map((category) =>
      '<button class="category-tab' + (ui.category === category.id ? " is-active" : "") +
      '" data-action="set-category" data-category="' + escapeHtml(category.id) + '">' +
      escapeHtml(category.emoji) + " " + escapeHtml(category.name) + "</button>").join(""),
    "</nav>",
    '<div class="product-grid">' + renderProductGrid(data, ui) + "</div>",
    "</section>",
    "</main>",
    '<footer class="client-footer"><span>Bar do Nardo · tradição de Nova Odessa desde 1980.</span><button class="link-button" data-action="go-admin">Área do bar</button></footer>',
    totalItems ? '<button class="floating-cart" data-action="open-cart"><span>' + totalItems + (totalItems === 1 ? " item" : " itens") + " · " + money(total) + '</span><strong>Ver carrinho →</strong></button>' : "",
    ui.panel === "cart" ? renderCartDrawer(cartItems, total) : "",
    ui.panel === "checkout" ? renderCheckout(cartItems, total, table) : "",
    ui.panel === "payment" && ui.paymentOrder ? renderPayment(ui.paymentOrder) : "",
    "</div>"
  ].join("");
}
