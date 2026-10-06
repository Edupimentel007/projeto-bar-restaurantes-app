import {
  dashboardPeriods,
  escapeHtml,
  fullDate,
  money,
  orderItemCount,
  salesSummary,
  statusDetails,
  statusPill,
  tableLink
} from "./utils.js";
import { brandLogo, productImage } from "./images.js";

const navigation = [
  { id: "dashboard", icon: "▦", label: "Visão geral" },
  { id: "orders", icon: "◫", label: "Pedidos" },
  { id: "menu", icon: "☷", label: "Cardápio" },
  { id: "tables", icon: "⌗", label: "Mesas e QR Codes" }
];

function renderBrand(compact) {
  return '<a class="brand admin-brand" href="#/admin/dashboard" data-action="admin-home" aria-label="Voltar ao início da administração">' +
    brandLogo("", { className: "brand-logo", sizes: "(max-width: 820px) 32px, 72px" }) +
    (compact ? "" : '<span class="brand-copy"><b>Bar do Nardo</b><small>Desde 1980</small></span>') + "</a>";
}

function renderThemeToggle(extraClass) {
  return '<button type="button" class="theme-toggle' + (extraClass ? " " + extraClass : "") +
    '" data-action="toggle-theme" aria-label="Alternar entre tema claro e escuro" title="Alternar tema">' +
    '<span class="theme-icon-sun" aria-hidden="true">☀</span><span class="theme-icon-moon" aria-hidden="true">☾</span></button>';
}

function pageTitle(section) {
  const entry = navigation.find((item) => item.id === section);
  return entry ? entry.label : "Visão geral";
}

function renderOrderCard(order, options) {
  const compact = Boolean(options && options.compact);
  const detail = statusDetails[order.status] || {};
  const customer = order.customerName ? " · " + escapeHtml(order.customerName) : "";
  const note = order.customerNote
    ? '<p class="order-note">“' + escapeHtml(order.customerNote) + "”</p>"
    : "";
  const action = detail.next
    ? '<button class="button button-small button-primary button-block" data-action="advance-order" data-id="' +
      escapeHtml(order.id) + '" data-status="' + detail.next + '">' + detail.action + "</button>"
    : "";
  const itemPreview = order.items.slice(0, compact ? 2 : 3).map((item) =>
    '<li><span><b>' + item.quantity + "×</b> " + escapeHtml(item.productNameSnapshot) +
    "</span><strong>" + money(item.lineTotalCents) + "</strong></li>").join("");
  const remainingItems = order.items.length > (compact ? 2 : 3)
    ? '<li class="extra-items">+ ' + (order.items.length - (compact ? 2 : 3)) + " item(ns) no pedido</li>"
    : "";

  return [
    '<article class="order-card">',
    '<div class="order-card-header">',
    '<div><span class="order-code">' + escapeHtml(order.publicCode) + "</span><p><b>⌖ " +
      escapeHtml(order.tableLabel) + "</b>" + customer + "</p></div>",
    statusPill(order.status),
    "</div>",
    '<div class="order-card-payment"><span>✓ Pagamento aprovado</span><span>Pix · ' +
      fullDate(order.paidAt || order.createdAt) + "</span></div>",
    '<ul class="order-items">' + itemPreview + remainingItems + "</ul>",
    note,
    '<div class="order-card-footer"><span>' + orderItemCount(order) + " item(ns)</span><strong>" +
      money(order.totalCents) + "</strong></div>",
    '<div class="order-card-actions"><button class="button button-small button-outline" data-action="open-order-details" data-id="' +
      escapeHtml(order.id) + '">Ver detalhes</button>' + action + "</div>",
    "</article>"
  ].join("");
}

function renderDashboard(data, ui) {
  const summary = salesSummary(data.orders, ui.dashboardPeriod);
  const openOrders = data.orders.filter((order) => ["NEW", "PREPARING", "READY"].includes(order.status));
  const productMax = summary.topProducts.length ? summary.topProducts[0].quantity : 1;
  const topProduct = summary.topProducts[0];
  const recentOrders = summary.paidOrders.slice(0, 6);
  const recentRows = recentOrders.length
    ? recentOrders.map((order) =>
      '<div class="table-row"><span><b>' + escapeHtml(order.publicCode) + "</b><small>" + fullDate(order.paidAt || order.createdAt) +
      "</small></span><span>" + escapeHtml(order.tableLabel) + "</span><span>" + statusPill(order.status) +
      "</span><strong>" + money(order.totalCents) + "</strong></div>").join("")
    : '<div class="recent-orders-empty"><span aria-hidden="true">▱</span><p>Nenhum pagamento aprovado neste período.</p></div>';

  return [
    '<section class="admin-page-header">',
    '<div><p class="eyebrow">Operação em tempo real</p><div class="dashboard-title-line"><h1>Seu dia no bar</h1><span class="dashboard-current-date">▣ ' +
      escapeHtml(summary.period.rangeLabel) + '</span></div><p>Acompanhe as vendas do período sem perder a fila de pedidos ao vivo.</p></div>',
    '<span class="live-indicator"><i></i> Atualiza automaticamente</span>',
    "</section>",
    '<section class="dashboard-period-filter" aria-label="Filtro do painel">',
    '<div class="dashboard-period-copy"><span>Período dos indicadores</span><small>Pagamentos aprovados</small></div>',
    '<div class="dashboard-period-tabs" role="group" aria-label="Selecionar período">' + dashboardPeriods.map((period) =>
      '<button type="button" class="' + (summary.period.id === period.id ? "is-active" : "") +
      '" data-action="set-dashboard-period" data-period="' + period.id + '" aria-pressed="' +
      (summary.period.id === period.id ? "true" : "false") + '">' + period.label + "</button>").join("") + "</div>",
    "</section>",
    '<section class="metrics-grid">',
    '<article class="metric-card"><div class="metric-icon revenue">R$</div><div><span>Faturamento</span><strong>' + money(summary.revenue) + '</strong><small>Pagamentos no período</small></div></article>',
    '<article class="metric-card"><div class="metric-icon orders">◫</div><div><span>Pedidos pagos</span><strong>' + summary.count + '</strong><small>No período selecionado</small></div></article>',
    '<article class="metric-card"><div class="metric-icon ticket">◎</div><div><span>Ticket médio</span><strong>' + money(summary.average) + '</strong><small>Média do período</small></div></article>',
    '<article class="metric-card"><div class="metric-icon favorite">★</div><div><span>Mais pedido</span><strong class="metric-product">' + escapeHtml(topProduct ? topProduct.name : "—") + '</strong><small>' + (topProduct ? topProduct.quantity + " unidades" : "Ainda sem vendas") + "</small></div></article>",
    "</section>",
    '<section class="dashboard-grid">',
    '<article class="dashboard-card sales-card">',
    '<div class="card-heading"><div><p class="eyebrow">Produtos</p><h2>Mais vendidos</h2></div><span class="subtle-label">' + escapeHtml(summary.period.badgeLabel) + "</span></div>",
    (summary.topProducts.length ? '<div class="bar-list">' + summary.topProducts.slice(0, 5).map((product) =>
      '<div class="bar-row"><div><span>' + escapeHtml(product.name) + "</span><b>" + product.quantity +
      " un.</b></div><div class=\"bar-track\"><i style=\"width:" +
      Math.max(10, Math.round((product.quantity / productMax) * 100)) + '%\"></i></div></div>').join("") +
      "</div>" : '<div class="empty-inline"><span>📈</span><p>As vendas aparecerão aqui.</p></div>'),
    "</article>",
    '<article class="dashboard-card order-summary-card">',
    '<div class="card-heading"><div><p class="eyebrow">Fila operacional</p><h2>Pedidos agora</h2></div><a href="#/admin/orders">Ver todos</a></div>',
    '<div class="status-summary">',
    '<div><span class="status-dot dot-info"></span><p>Novos</p><strong>' + data.orders.filter((order) => order.status === "NEW").length + "</strong></div>",
    '<div><span class="status-dot dot-warning"></span><p>Em preparo</p><strong>' + data.orders.filter((order) => order.status === "PREPARING").length + "</strong></div>",
    '<div><span class="status-dot dot-success"></span><p>Prontos</p><strong>' + data.orders.filter((order) => order.status === "READY").length + "</strong></div>",
    "</div>",
    '<div class="recent-mini-list">' + openOrders.slice(0, 3).map((order) =>
      '<div><span><b>' + escapeHtml(order.publicCode) + "</b> · " + escapeHtml(order.tableLabel) +
      "<br /><small>" + fullDate(order.paidAt || order.createdAt) + "</small></span>" +
      statusPill(order.status) + "</div>").join("") + "</div>",
    "</article>",
    "</section>",
    '<section class="dashboard-card recent-orders-card">',
    '<div class="card-heading"><div><p class="eyebrow">Pagamentos</p><h2>Movimentação no período</h2></div><a href="#/admin/orders">Abrir fila</a></div>',
    '<div class="recent-orders-table" tabindex="0" role="region" aria-label="Pedidos pagos no período selecionado">',
    '<div class="table-head"><span>Pedido</span><span>Mesa</span><span>Status</span><span>Total</span></div>',
    recentRows,
    "</div>",
    "</section>"
  ].join("");
}

function renderOrderDetails(order) {
  const detail = statusDetails[order.status] || {};
  const action = detail.next
    ? '<button class="button button-primary button-block" data-action="advance-order" data-id="' +
      escapeHtml(order.id) + '" data-status="' + detail.next + '">' + detail.action + "</button>"
    : "";
  const customer = order.customerName ? escapeHtml(order.customerName) : "Não informado";
  const note = order.customerNote
    ? '<section class="detail-note"><p class="eyebrow">Observação do cliente</p><p>“' +
      escapeHtml(order.customerNote) + "”</p></section>"
    : "";
  const nextLabel = detail.next ? detail.action : "Pedido finalizado";

  return [
    '<div class="overlay" data-action="close-panel"></div>',
    '<aside class="side-panel order-detail-panel" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">',
    '<div class="panel-header"><div><p class="eyebrow">Detalhes do pedido</p><h2 id="order-detail-title">' +
      escapeHtml(order.publicCode) + "</h2></div><button class=\"close-button\" data-action=\"close-panel\" aria-label=\"Fechar detalhes\">×</button></div>",
    '<div class="order-detail-status">' + statusPill(order.status) +
      '<span>✓ Pagamento aprovado via Pix</span></div>',
    '<section class="detail-table-card"><span class="detail-table-icon">⌖</span><div><span>Pedido para</span><strong>' +
      escapeHtml(order.tableLabel) + "</strong></div><strong>" + money(order.totalCents) + "</strong></section>",
    '<section class="detail-grid">',
    '<div><span>Cliente</span><strong>' + customer + "</strong></div>",
    '<div><span>Criado em</span><strong>' + fullDate(order.createdAt) + "</strong></div>",
    '<div><span>Pagamento</span><strong>' + fullDate(order.paidAt) + "</strong></div>",
    '<div><span>Itens</span><strong>' + orderItemCount(order) + " no total</strong></div>",
    "</section>",
    '<section class="detail-section"><div class="detail-section-title"><p class="eyebrow">Consumo</p><h3>Itens do pedido</h3></div>',
    '<ul class="detail-items">' + order.items.map((item) =>
      '<li><span class="detail-item-qty">' + item.quantity + "×</span><div><strong>" +
      escapeHtml(item.productNameSnapshot) + "</strong><small>" + money(item.unitPriceCentsSnapshot) +
      " cada</small></div><strong>" + money(item.lineTotalCents) + "</strong></li>").join("") + "</ul></section>",
    note,
    '<section class="detail-total"><span>Total pago</span><strong>' + money(order.totalCents) + "</strong></section>",
    '<section class="order-progress"><span class="is-complete">✓ Pago</span><i></i><span class="' +
      (order.status !== "NEW" ? "is-complete" : "") + '">✓ Preparo</span><i></i><span class="' +
      (order.status === "READY" || order.status === "DELIVERED" ? "is-complete" : "") +
      '">✓ Pronto</span><i></i><span class="' + (order.status === "DELIVERED" ? "is-complete" : "") +
      '">✓ Entregue</span></section>',
    '<div class="detail-action-area"><p>Próxima ação: <strong>' + escapeHtml(nextLabel) + "</strong></p>" +
      action + "</div>",
    "</aside>"
  ].join("");
}

function renderOrders(data, ui) {
  const stages = ["NEW", "PREPARING", "READY"];
  const titles = {
    NEW: "Novos",
    PREPARING: "Em preparo",
    READY: "Prontos"
  };
  const descriptions = {
    NEW: "Pagos e aguardando aceite",
    PREPARING: "Itens em montagem",
    READY: "Aguardando entrega"
  };
  const filters = [
    { id: "ACTIVE", label: "Em andamento" },
    { id: "ALL", label: "Todos os pagos" },
    { id: "NEW", label: "Novos" },
    { id: "PREPARING", label: "Em preparo" },
    { id: "READY", label: "Prontos" },
    { id: "DELIVERED", label: "Entregues" }
  ];
  const selectedFilter = ui.orderFilter || "ACTIVE";
  const search = String(ui.orderSearch || "").trim().toLocaleLowerCase("pt-BR");
  const paidOrders = data.orders.filter((order) => order.paymentStatus === "APPROVED");
  const searchMatch = (order) => {
    const content = [
      order.publicCode,
      order.tableLabel,
      order.customerName,
      order.customerNote,
      ...order.items.map((item) => item.productNameSnapshot)
    ].join(" ").toLocaleLowerCase("pt-BR");
    return !search || content.includes(search);
  };
  const filterMatch = (order) => {
    if (selectedFilter === "ACTIVE") {
      return stages.includes(order.status);
    }
    if (selectedFilter === "ALL") {
      return true;
    }
    return order.status === selectedFilter;
  };
  const visibleOrders = paidOrders
    .filter(filterMatch)
    .filter(searchMatch)
    .sort((first, second) => new Date(second.paidAt || second.createdAt) - new Date(first.paidAt || first.createdAt));
  const activeCount = paidOrders.filter((order) => stages.includes(order.status)).length;
  const finishedOrders = paidOrders.filter((order) => ["DELIVERED", "CANCELLED"].includes(order.status));
  const shouldShowBoard = ["ACTIVE", "NEW", "PREPARING", "READY"].includes(selectedFilter);
  const listTitle = selectedFilter === "DELIVERED" ? "Pedidos entregues" :
    selectedFilter === "ALL" ? "Todos os pedidos pagos" : "Resultado da busca";

  return [
    '<section class="admin-page-header">',
    '<div><p class="eyebrow">Central operacional</p><h1>Pedidos da mesa</h1><p>Tudo que foi pago pelo QR Code chega aqui com mesa, itens, observações e valor.</p></div>',
    '<span class="live-indicator"><i></i> Ao vivo</span>',
    "</section>",
    '<section class="order-stat-strip">',
    stages.map((stage) => {
      const amount = paidOrders.filter((order) => order.status === stage).length;
      return '<div><span>' + titles[stage] + "</span><strong>" + amount + "</strong></div>";
    }).join(""),
    "</section>",
    '<section class="orders-toolbar"><div class="order-filter-tabs">' + filters.map((filter) =>
      '<button class="' + (selectedFilter === filter.id ? "is-active" : "") +
      '" data-action="set-order-filter" data-filter="' + filter.id + '">' + filter.label +
      "</button>").join("") + '</div><label class="order-search"><span aria-hidden="true">⌕</span><input data-action="search-orders" value="' +
      escapeHtml(ui.orderSearch || "") + '" placeholder="Buscar pedido, mesa, cliente ou item" aria-label="Buscar pedidos" /></label></section>',
    shouldShowBoard ? '<section class="order-board">' + stages.map((stage) => {
      const orders = visibleOrders.filter((order) => order.status === stage);
      return [
        '<div class="order-column">',
        '<header><div><h2>' + titles[stage] + "</h2><p>" + descriptions[stage] + '</p></div><span>' + orders.length + "</span></header>",
        '<div class="order-column-list">' + (orders.length
          ? orders.map((order) => renderOrderCard(order, { compact: true })).join("")
          : '<div class="empty-column"><span>✓</span><p>Nenhum pedido aqui.</p></div>') + "</div>",
        "</div>"
      ].join("");
    }).join("") + "</section>" :
      '<section class="orders-result-list"><header><div><p class="eyebrow">Consulta</p><h2>' + listTitle +
      "</h2></div><span>" + visibleOrders.length + " pedido(s)</span></header><div>" +
      (visibleOrders.length ? visibleOrders.map((order) => renderOrderCard(order, { compact: false })).join("") :
        '<div class="empty-column"><span>⌕</span><p>Nenhum pedido encontrado.</p></div>') + "</div></section>",
    selectedFilter === "ACTIVE" && finishedOrders.length ?
      '<section class="orders-history-preview"><header><div><p class="eyebrow">Histórico recente</p><h2>Finalizados</h2></div><button class="link-button" data-action="set-order-filter" data-filter="DELIVERED">Ver entregues</button></header><div>' +
      finishedOrders.slice(0, 3).map((order) => renderOrderCard(order, { compact: true })).join("") + "</div></section>" : "",
    '<section class="admin-note"><span>ℹ</span><p>' + activeCount + " pedido(s) estão em andamento. O painel atualiza automaticamente a cada poucos segundos.</p></section>"
  ].join("");
}

function renderMenuManagement(data) {
  const grouped = data.categories.filter((category) => category.active).sort((a, b) => a.sortOrder - b.sortOrder).map((category) => {
    const products = data.products.filter((product) => product.categoryId === category.id && product.active);
    return [
      '<section class="menu-admin-group">',
      '<header><div><span>' + escapeHtml(category.emoji) + "</span><h2>" + escapeHtml(category.name) + "</h2></div><small>" + products.length + " produtos</small></header>",
      '<div class="product-admin-list">' + products.map((product) => {
        const isAvailable = product.available !== false;
        const visual = product.imageUrl
          ? '<div class="product-admin-icon has-image">' + productImage(product.imageUrl, "", {
            loading: "lazy",
            sizes: "31px"
          }) + "</div>"
          : '<div class="product-admin-icon">' + escapeHtml(product.emoji) + "</div>";
        const metadata = [product.brand, product.volume, product.packaging].filter(Boolean).join(" · ");
        return '<article class="product-admin-row' + (isAvailable ? "" : " is-unavailable") + '">' + visual +
        '<div class="product-admin-name"><strong>' + escapeHtml(product.name) + "</strong>" +
        (metadata ? '<span class="product-admin-meta">' + escapeHtml(metadata) + "</span>" : "") +
        '<small>' + escapeHtml(product.description) + "</small></div><strong>" + money(product.priceCents) +
        '</strong><label class="toggle-control"><input type="checkbox" data-action="toggle-product" data-id="' +
        escapeHtml(product.id) + '" aria-label="Disponibilidade de ' + escapeHtml(product.name) + '"' + (isAvailable ? " checked" : "") +
        ' /><span></span><b>' + (isAvailable ? "Disponível" : "Indisponível") + "</b></label></article>";
      }).join("") + "</div>",
      "</section>"
    ].join("");
  }).join("");

  return [
    '<section class="admin-page-header">',
    '<div><p class="eyebrow">Gestão do cardápio</p><h1>Produtos e disponibilidade</h1><p>Todos começam disponíveis. Desmarque a opção quando um item acabar.</p></div>',
    '<button class="button button-primary" data-action="open-new-product">+ Novo produto</button>',
    "</section>",
    '<section class="admin-tip"><span>💡</span><p>Marcado significa disponível para venda. Ao desmarcar, o produto aparece como indisponível para o cliente.</p></section>',
    grouped
  ].join("");
}

function renderTables(data) {
  return [
    '<section class="admin-page-header">',
    '<div><p class="eyebrow">Acesso por mesa</p><h1>Mesas e QR Codes</h1><p>Imprima um QR Code para cada mesa e leve o cliente direto ao cardápio correto.</p></div>',
    '<button class="button button-primary" data-action="open-new-table">+ Nova mesa</button>',
    "</section>",
    '<section class="tables-grid">' + data.tables.filter((table) => table.active)
      .sort((first, second) => first.label.localeCompare(second.label, "pt-BR", { numeric: true, sensitivity: "base" }))
      .map((table) =>
      '<article class="table-card"><div class="table-card-top"><span class="table-icon">⌖</span><span class="status-pill status-success">Ativa</span></div><h2>' +
      escapeHtml(table.label) + "</h2><p>Link exclusivo do cardápio</p>" +
      '<div class="table-link"><input readonly value="' + escapeHtml(tableLink(table, data.publicBaseUrl)) + '" aria-label="Link da ' +
      escapeHtml(table.label) + '" /></div><div class="table-actions"><button class="button button-outline button-small" data-action="copy-link" data-table="' +
      escapeHtml(table.id) + '">Copiar link</button><button class="button button-primary button-small" data-action="show-qr" data-table="' +
      escapeHtml(table.id) + '">Ver QR Code</button></div></article>').join("") + "</section>",
    '<section class="admin-note"><span>ℹ</span><p>Na versão de demonstração, use “Ver QR Code” para baixar ou imprimir o código de cada mesa.</p></section>'
  ].join("");
}

function renderNewProductModal(data, productDraft) {
  const draft = productDraft || {};
  const imageUrl = String(draft.imageUrl || "").trim();
  const checked = (value) => value ? " checked" : "";
  return [
    '<div class="modal-backdrop" data-action="close-panel"></div>',
    '<section class="modal-card admin-modal product-editor-modal" role="dialog" aria-modal="true" aria-labelledby="new-product-title">',
    '<div class="panel-header"><div><p class="eyebrow">Cardápio</p><h2 id="new-product-title">Novo produto</h2></div><button class="close-button" data-action="close-panel" aria-label="Fechar">×</button></div>',
    '<form id="new-product-form" class="form-stack product-editor-form" autocomplete="off">',
    '<div class="product-editor-layout"><div class="product-editor-fields">',
    '<section class="product-form-section"><div class="product-form-heading"><span>1</span><div><h3>Identificação</h3><p>Como o item aparecerá para o cliente.</p></div></div>',
    '<div class="form-row"><label>Nome do produto<input name="name" data-product-field="name" required maxlength="80" value="' + escapeHtml(draft.name || "") + '" placeholder="Ex.: Brahma Duplo Malte" /></label>',
    '<label>Marca <span class="optional">(opcional)</span><input name="brand" data-product-field="brand" maxlength="60" value="' + escapeHtml(draft.brand || "") + '" placeholder="Ex.: Brahma" /></label></div>',
    '<label>Descrição<textarea name="description" data-product-field="description" maxlength="180" rows="3" placeholder="Conte o que torna este produto especial">' + escapeHtml(draft.description || "") + "</textarea></label></section>",
    '<section class="product-form-section"><div class="product-form-heading"><span>2</span><div><h3>Venda e apresentação</h3><p>Preço, tamanho e embalagem.</p></div></div>',
    '<div class="form-row"><label>Categoria<select name="categoryId" data-product-field="categoryId" required>' + data.categories.filter((category) => category.active).map((category) =>
      '<option value="' + escapeHtml(category.id) + '"' + (draft.categoryId === category.id ? " selected" : "") + '>' + escapeHtml(category.emoji) + " " + escapeHtml(category.name) +
      "</option>").join("") + '</select></label><label>Preço (R$)<input name="price" data-product-field="price" required inputmode="decimal" value="' + escapeHtml(draft.price || "") + '" placeholder="0,00" /></label></div>',
    '<div class="form-row form-row-three"><label>Volume/tamanho<input name="volume" data-product-field="volume" maxlength="30" value="' + escapeHtml(draft.volume || "") + '" placeholder="Ex.: 350 ml" /></label>',
    '<label>Embalagem<input name="packaging" data-product-field="packaging" maxlength="40" value="' + escapeHtml(draft.packaging || "") + '" placeholder="Ex.: Lata" /></label>',
    '<label>Código interno <span class="optional">(SKU)</span><input name="sku" data-product-field="sku" maxlength="40" value="' + escapeHtml(draft.sku || "") + '" placeholder="Ex.: BEB-001" /></label></div></section>',
    '<section class="product-form-section"><div class="product-form-heading"><span>3</span><div><h3>Imagem e vitrine</h3><p>Use um arquivo de /assets ou uma URL HTTPS.</p></div></div>',
    '<label>Imagem do produto<input name="imageUrl" data-product-field="imageUrl" maxlength="500" value="' + escapeHtml(draft.imageUrl || "") + '" placeholder="/assets/products/produto.png" /></label>',
    '<div class="form-row"><label>Texto alternativo<input name="imageAlt" data-product-field="imageAlt" maxlength="120" value="' + escapeHtml(draft.imageAlt || "") + '" placeholder="Ex.: Lata de Brahma 350 ml" /></label>',
    '<label>Emoji de reserva<input name="emoji" data-product-field="emoji" maxlength="8" value="' + escapeHtml(draft.emoji || "🍽️") + '" /></label></div>',
    '<label>Selo no cardápio <span class="optional">(opcional)</span><input name="badge" data-product-field="badge" maxlength="32" value="' + escapeHtml(draft.badge || "") + '" placeholder="Ex.: Mais pedido" /></label></section>',
    '</div><aside class="product-editor-summary"><p class="eyebrow">Prévia</p><div class="product-form-preview" data-product-image-preview><img' + (imageUrl ? ' src="' + escapeHtml(imageUrl) + '"' : "") + ' alt="Prévia do produto"' + (imageUrl ? "" : " hidden") + ' /><span' + (imageUrl ? " hidden" : "") + '>' + escapeHtml(draft.emoji || "🍽️") + '</span></div>',
    '<strong data-product-preview-name>' + escapeHtml(draft.name || "Nome do produto") + '</strong><small data-product-preview-meta>' + escapeHtml([draft.brand, draft.volume].filter(Boolean).join(" · ") || "Marca e tamanho") + '</small>',
    '<div class="product-options"><label class="product-option"><input type="checkbox" name="featured" data-product-field="featured"' + checked(Boolean(draft.featured)) + ' /><span><b>Destacar no cardápio</b><small>Exibe o item entre os especiais.</small></span></label>',
    '<label class="product-option"><input type="checkbox" name="available" data-product-field="available"' + checked(draft.available !== false) + ' /><span><b>Disponível para venda</b><small>O cliente já poderá adicionar ao carrinho.</small></span></label></div></aside></div>',
    '<div class="product-editor-actions"><button class="button button-ghost" type="button" data-action="close-panel">Cancelar</button><button class="button button-primary" type="submit">Adicionar ao cardápio</button></div>',
    "</form></section>"
  ].join("");
}

function renderNewTableModal() {
  return [
    '<div class="modal-backdrop" data-action="close-panel"></div>',
    '<section class="modal-card admin-modal" role="dialog" aria-modal="true" aria-labelledby="new-table-title">',
    '<div class="panel-header"><div><p class="eyebrow">Mesas</p><h2 id="new-table-title">Nova mesa</h2></div><button class="close-button" data-action="close-panel" aria-label="Fechar">×</button></div>',
    '<form id="new-table-form" class="form-stack"><label>Identificação da mesa<input name="label" required maxlength="40" placeholder="Ex.: Mesa 13 ou Deck 02" /></label>',
    '<div class="notice notice-info"><span aria-hidden="true">⌗</span><p>Um link exclusivo e um QR Code serão criados automaticamente.</p></div>',
    '<button class="button button-primary button-block" type="submit">Criar mesa</button></form></section>'
  ].join("");
}

function renderQrModal(data, ui) {
  const table = data.tables.find((item) => item.id === ui.qrTable);
  if (!table) {
    return "";
  }
  const qr = ui.qrResult;
  const image = qr && qr.dataUrl
    ? '<img class="qr-image" src="' + qr.dataUrl + '" alt="QR Code do cardápio para ' + escapeHtml(table.label) + '" />'
    : '<div class="qr-loading"><span class="spinner"></span><p>Gerando QR Code...</p></div>';
  const link = qr && qr.menuUrl ? qr.menuUrl : tableLink(table, data.publicBaseUrl);
  const download = qr && qr.dataUrl
    ? '<a class="button button-primary button-block" href="' + qr.dataUrl + '" download="qr-' +
      escapeHtml(table.label.toLowerCase().replace(/\s+/g, "-")) + '.png">Baixar PNG</a>'
    : "";

  return [
    '<div class="modal-backdrop" data-action="close-panel"></div>',
    '<section class="modal-card qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">',
    '<div class="panel-header"><div><p class="eyebrow">Acesso da mesa</p><h2 id="qr-title">' + escapeHtml(table.label) + '</h2></div><button class="close-button" data-action="close-panel" aria-label="Fechar">×</button></div>',
    '<div class="qr-content">' + image + '<p>Aponte a câmera para abrir o cardápio desta mesa.</p></div>',
    '<div class="qr-actions"><div class="copy-field"><input readonly value="' + escapeHtml(link) + '" aria-label="Link da mesa" /><button class="button button-outline" data-action="copy-link" data-table="' +
    escapeHtml(table.id) + '">Copiar</button></div>' + download + "</div>",
    "</section>"
  ].join("");
}

export function renderAdminLogin() {
  return [
    '<main class="login-page">',
    renderThemeToggle("theme-toggle-floating"),
    '<section class="login-panel">',
    renderBrand(false),
    '<div class="login-copy"><p class="eyebrow">Área do estabelecimento</p><h1>O coração do Bar do Nardo, em uma tela.</h1><p>Pedidos pagos, cardápio e resultado do dia para a operação seguir no ritmo do balcão.</p></div>',
    '<div class="login-features"><span>✓ Pedidos em tempo real</span><span>✓ Controle de disponibilidade</span><span>✓ Indicadores de vendas</span></div>',
    "</section>",
    '<section class="login-form-panel"><form id="admin-login-form" class="login-form"><p class="eyebrow">Acesso administrativo</p><h2>Entrar no painel</h2><p>Use as credenciais demonstrativas para conhecer o sistema.</p>',
    '<label>E-mail<input name="email" type="email" autocomplete="email" required value="dono@bardonardo.local" /></label>',
    '<label>Senha<input name="password" type="password" autocomplete="current-password" required /></label>',
    '<button class="button button-primary button-block" type="submit">Acessar painel</button>',
    '<div class="login-demo-note"><span>ℹ</span><p>Ambiente de demonstração<br />Use as credenciais privadas do administrador.</p></div>',
    '<a href="/?mesa=m01" class="text-link">← Voltar ao cardápio</a></form></section>',
    "</main>"
  ].join("");
}

export function renderAdmin(data, ui) {
  const section = ui.adminSection || "dashboard";
  const firstActiveTable = data.tables.find((table) => table.active);
  const customerMenuUrl = firstActiveTable
    ? "/?mesa=" + encodeURIComponent(firstActiveTable.qrToken || firstActiveTable.id)
    : "#/admin/dashboard";
  let content = renderDashboard(data, ui);
  if (section === "orders") {
    content = renderOrders(data, ui);
  }
  if (section === "menu") {
    content = renderMenuManagement(data);
  }
  if (section === "tables") {
    content = renderTables(data);
  }

  const selectedOrder = data.orders.find((order) => order.id === ui.selectedOrderId);
  const modal = ui.panel === "order-details" && selectedOrder ? renderOrderDetails(selectedOrder) :
    ui.panel === "new-product" ? renderNewProductModal(data, ui.productDraft) :
    ui.panel === "new-table" ? renderNewTableModal() :
      ui.panel === "qr" ? renderQrModal(data, ui) : "";

  return [
    '<div class="admin-layout">',
    '<aside class="admin-sidebar">',
    '<div class="sidebar-brand">' + renderBrand(false) + '<span class="workspace-label">Painel do bar</span></div>',
    '<nav class="admin-nav" aria-label="Navegação administrativa">' + navigation.map((item) =>
      '<a href="#/admin/' + item.id + '" class="admin-nav-link' + (section === item.id ? " is-active" : "") +
      '"><span aria-hidden="true">' + item.icon + "</span>" + item.label + "</a>").join("") + "</nav>",
    '<div class="sidebar-bottom">' + renderThemeToggle("theme-toggle-sidebar") + '<a class="visit-menu-link" href="' +
    escapeHtml(customerMenuUrl) + '"><span>↗</span> Ver cardápio</a><button class="logout-button" data-action="logout">Sair</button></div>',
    "</aside>",
    '<main class="admin-main">',
    '<header class="admin-mobile-top"><button class="mobile-brand" data-action="admin-home" aria-label="Voltar ao início da administração">' +
    brandLogo("", { className: "brand-logo", sizes: "32px" }) + '<span>Nardo</span></button><span>' +
    escapeHtml(pageTitle(section)) + '</span><div class="admin-mobile-actions">' + renderThemeToggle("theme-toggle-compact") + '<button class="logout-button" data-action="logout">Sair</button></div></header>',
    '<div class="admin-content">' + content + "</div>",
    "</main>",
    '<nav class="admin-mobile-nav">' + navigation.map((item) =>
      '<a href="#/admin/' + item.id + '" class="' + (section === item.id ? "is-active" : "") +
      '"><span>' + item.icon + "</span>" + item.label + "</a>").join("") + "</nav>",
    modal,
    "</div>"
  ].join("");
}
