import {
  addProduct,
  addTable,
  approveOrder,
  changeOrderStatus,
  createOrder,
  getMenu,
  getOrderTracking,
  getState,
  getTableQr,
  loginAdmin,
  patchProduct
} from "./api.js";
import { renderAdmin, renderAdminLogin } from "./admin.js";
import { cartTotal, getCartItems, renderClient, renderProductGrid, resolveTable } from "./client.js";
import { brandLogo } from "./images.js";
import { dashboardPeriods, escapeHtml, tableLink, toCents } from "./utils.js";

const appRoot = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
const cartStorageKey = "brique-bar-cart-v1";
const sessionStorageKey = "brique-bar-admin-session-v1";
const adminTokenStorageKey = "brique-bar-admin-token-v1";
const pendingOrderStorageKey = "brique-bar-pending-order-v1";
const lastOrderStorageKey = "brique-bar-last-order-v1";
const themeStorageKey = "bar-do-nardo-theme-v1";
const storedCart = readCart();
let orderSearchRenderTimer = null;
let mountedPanel = null;
let dialogReturnTarget = null;
let restoreDialogFocusOnMount = false;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function applyTheme(theme, persist) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = safeTheme;
  document.documentElement.style.colorScheme = safeTheme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    themeColor.setAttribute("content", safeTheme === "dark" ? "#12170d" : "#43520c");
  }
  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, safeTheme);
    } catch {
      // O tema ainda funciona durante a sessão quando o armazenamento está indisponível.
    }
  }
}

applyTheme(document.documentElement.dataset.theme, false);

function createProductDraft(categoryId) {
  return {
    name: "",
    brand: "",
    description: "",
    categoryId: categoryId || "",
    price: "",
    volume: "",
    packaging: "",
    sku: "",
    imageUrl: "",
    imageAlt: "",
    emoji: "🍽️",
    badge: "",
    featured: false,
    available: true
  };
}

const ui = {
  data: null,
  cart: storedCart.items,
  cartTableId: storedCart.tableId,
  category: "all",
  search: "",
  panel: null,
  paymentOrder: readTrackedOrder(pendingOrderStorageKey),
  lastOrder: readTrackedOrder(lastOrderStorageKey),
  adminSession: Boolean(sessionStorage.getItem(adminTokenStorageKey)),
  adminSection: "dashboard",
  dashboardPeriod: "today",
  orderFilter: "ACTIVE",
  orderSearch: "",
  selectedOrderId: null,
  productDraft: null,
  adminSnapshotReady: false,
  qrTable: null,
  qrResult: null
};

function readCart() {
  try {
    const parsed = JSON.parse(localStorage.getItem(cartStorageKey) || "{}");
    if (parsed && typeof parsed === "object" && parsed.items && typeof parsed.items === "object") {
      return { tableId: parsed.tableId || null, items: parsed.items };
    }
    return { tableId: null, items: parsed && typeof parsed === "object" ? parsed : {} };
  } catch {
    return { tableId: null, items: {} };
  }
}

function saveCart() {
  localStorage.setItem(cartStorageKey, JSON.stringify({
    tableId: ui.cartTableId,
    items: ui.cart
  }));
}

function readTrackedOrder(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed && parsed.id && parsed.accessToken ? parsed : null;
  } catch {
    return null;
  }
}

function saveTrackedOrder(key, order) {
  localStorage.setItem(key, JSON.stringify({
    id: order.id,
    tableId: order.tableId,
    accessToken: order.accessToken
  }));
}

function clearTrackedOrder(key) {
  localStorage.removeItem(key);
}

function isAdminRoute() {
  return window.location.hash.startsWith("#/admin") ||
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/");
}

function getAdminSection() {
  const route = window.location.hash.startsWith("#/admin")
    ? window.location.hash.replace(/^#\/?/, "")
    : window.location.pathname.replace(/^\/+/, "");
  const parts = route.split("/");
  const requested = parts[1] || "dashboard";
  return ["dashboard", "orders", "menu", "tables"].includes(requested) ? requested : "dashboard";
}

function syncAppManifest() {
  const manifestLink = document.querySelector("#app-manifest");
  if (!manifestLink) {
    return;
  }

  const manifestParams = new URLSearchParams();
  const admin = isAdminRoute();
  manifestParams.set("context", admin ? "admin" : "client");
  if (!admin) {
    const tableToken = new URLSearchParams(window.location.search).get("mesa");
    if (tableToken) {
      manifestParams.set("mesa", tableToken);
    }
  }

  const nextHref = "/manifest.webmanifest?" + manifestParams.toString();
  if (manifestLink.getAttribute("href") !== nextHref) {
    manifestLink.setAttribute("href", nextHref);
  }
}

function currentTable() {
  const token = new URLSearchParams(window.location.search).get("mesa");
  return resolveTable(ui.data, token);
}

function isVisibleFocusable(element) {
  if (!(element instanceof HTMLElement) || element.hidden || element.closest("[inert]")) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function focusableElements(scope) {
  return Array.from(scope.querySelectorAll(focusableSelector)).filter(isVisibleFocusable);
}

function describeFocusTarget(element, scope) {
  if (!(element instanceof HTMLElement) || !scope.contains(element)) {
    return null;
  }
  const candidates = focusableElements(scope);
  return {
    action: element.dataset.action || "",
    id: element.dataset.id || "",
    table: element.dataset.table || "",
    name: element.getAttribute("name") || "",
    ariaLabel: element.getAttribute("aria-label") || "",
    tagName: element.tagName,
    index: candidates.indexOf(element)
  };
}

function findFocusTarget(scope, descriptor) {
  if (!descriptor) {
    return null;
  }
  const candidates = focusableElements(scope);
  const exact = candidates.find((element) => {
    return element.tagName === descriptor.tagName &&
      (element.dataset.action || "") === descriptor.action &&
      (element.dataset.id || "") === descriptor.id &&
      (element.dataset.table || "") === descriptor.table &&
      (element.getAttribute("name") || "") === descriptor.name &&
      (element.getAttribute("aria-label") || "") === descriptor.ariaLabel;
  });
  if (exact) {
    return exact;
  }
  if (descriptor.action) {
    const sameAction = candidates.filter((element) => element.dataset.action === descriptor.action);
    if (sameAction.length) {
      return sameAction[Math.min(Math.max(descriptor.index, 0), sameAction.length - 1)];
    }
  }
  return descriptor.index >= 0 ? candidates[Math.min(descriptor.index, candidates.length - 1)] || null : null;
}

function dialogFieldKey(field, fields) {
  const name = field.getAttribute("name") || field.dataset.productField || field.dataset.action || field.tagName;
  const peers = fields.filter((candidate) => {
    const candidateName = candidate.getAttribute("name") || candidate.dataset.productField || candidate.dataset.action || candidate.tagName;
    return candidateName === name && candidate.tagName === field.tagName;
  });
  return field.tagName + ":" + name + ":" + peers.indexOf(field);
}

function captureDialogState(dialog) {
  if (!dialog) {
    return null;
  }
  const fields = Array.from(dialog.querySelectorAll("input, select, textarea"));
  const values = fields.map((field) => ({
    key: dialogFieldKey(field, fields),
    value: field.value,
    checked: field.checked
  }));
  const scrollTargets = [dialog, ...dialog.querySelectorAll(".cart-list, .product-editor-fields, .compact-order-list, .qr-content")];
  const activeElement = document.activeElement;
  const active = describeFocusTarget(activeElement, dialog);
  const selection = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement
    ? { start: activeElement.selectionStart, end: activeElement.selectionEnd }
    : null;
  return {
    values,
    active,
    selection,
    scroll: scrollTargets.map((element) => ({ top: element.scrollTop, left: element.scrollLeft }))
  };
}

function restoreDialogState(dialog, state) {
  if (!dialog || !state) {
    return false;
  }
  const fields = Array.from(dialog.querySelectorAll("input, select, textarea"));
  const valueByKey = new Map(state.values.map((entry) => [entry.key, entry]));
  fields.forEach((field) => {
    const entry = valueByKey.get(dialogFieldKey(field, fields));
    if (!entry || field.type === "file") {
      return;
    }
    if (["checkbox", "radio"].includes(field.type)) {
      field.checked = entry.checked;
    } else {
      field.value = entry.value;
    }
  });

  const target = findFocusTarget(dialog, state.active);
  if (target) {
    target.focus({ preventScroll: true });
    if (state.selection && typeof target.setSelectionRange === "function" && state.selection.start !== null) {
      target.setSelectionRange(state.selection.start, state.selection.end);
    }
  }

  const scrollTargets = [dialog, ...dialog.querySelectorAll(".cart-list, .product-editor-fields, .compact-order-list, .qr-content")];
  scrollTargets.forEach((element, index) => {
    const position = state.scroll[index];
    if (position) {
      element.scrollTop = position.top;
      element.scrollLeft = position.left;
    }
  });
  return Boolean(target);
}

function setDialogBackgroundInert(dialog) {
  if (!dialog || !dialog.parentElement) {
    return;
  }
  Array.from(dialog.parentElement.children).forEach((element) => {
    if (element === dialog || element.matches(".overlay, .modal-backdrop")) {
      return;
    }
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
  });
}

function focusDialogInitially(dialog) {
  if (!dialog) {
    return;
  }
  if (!dialog.hasAttribute("tabindex")) {
    dialog.setAttribute("tabindex", "-1");
  }
  const target = dialog.querySelector("[autofocus], [data-dialog-initial-focus]") ||
    dialog.querySelector("input:not([type='hidden']):not([readonly]):not([disabled]), textarea:not([readonly]):not([disabled]), select:not([disabled])") ||
    dialog.querySelector('[data-action="close-panel"]') ||
    focusableElements(dialog)[0] || dialog;
  target.focus({ preventScroll: true });
}

function rememberDialogTrigger(element) {
  if (!ui.panel) {
    dialogReturnTarget = describeFocusTarget(element, appRoot);
    restoreDialogFocusOnMount = false;
  }
}

function discardDialogFocusReturn() {
  dialogReturnTarget = null;
  restoreDialogFocusOnMount = false;
}

function mountApp(markup) {
  const previousDialog = appRoot.querySelector('[role="dialog"][aria-modal="true"]');
  const preserveDialogState = previousDialog && mountedPanel && mountedPanel === ui.panel
    ? captureDialogState(previousDialog)
    : null;
  appRoot.innerHTML = markup;
  const hasOpenLayer = Boolean(appRoot.querySelector(".overlay, .modal-backdrop, .side-panel, .modal-card"));
  const isAdminView = Boolean(appRoot.querySelector(".admin-layout"));
  document.body.classList.toggle("is-layer-open", hasOpenLayer);
  document.body.classList.toggle("is-admin-view", isAdminView);

  const dialog = appRoot.querySelector('[role="dialog"][aria-modal="true"]');
  mountedPanel = dialog ? ui.panel : null;
  if (dialog) {
    setDialogBackgroundInert(dialog);
    if (!restoreDialogState(dialog, preserveDialogState)) {
      focusDialogInitially(dialog);
    }
    return;
  }

  if (restoreDialogFocusOnMount) {
    const returnTarget = findFocusTarget(appRoot, dialogReturnTarget);
    if (returnTarget) {
      returnTarget.focus({ preventScroll: true });
    }
  }
  discardDialogFocusReturn();
}

function renderPreservingScroll(selector) {
  const current = appRoot.querySelector(selector);
  const scrollTop = current ? current.scrollTop : 0;
  const scrollLeft = current ? current.scrollLeft : 0;
  render();
  const updated = appRoot.querySelector(selector);
  if (updated) {
    updated.scrollTop = scrollTop;
    updated.scrollLeft = scrollLeft;
  }
}

function render() {
  syncAppManifest();

  if (isAdminRoute() && !ui.adminSession) {
    ui.adminSection = getAdminSection();
    mountApp(renderAdminLogin());
    return;
  }

  if (!ui.data) {
    mountApp('<div class="initial-loading">' + brandLogo("Bar do Nardo", {
      className: "brand-logo brand-logo-loading",
      fetchPriority: "high",
      sizes: "112px"
    }) + '<p>Preparando seu cardápio...</p></div>');
    return;
  }

  if (isAdminRoute()) {
    ui.adminSection = getAdminSection();
    mountApp(ui.adminSession ? renderAdmin(ui.data, ui) : renderAdminLogin());
    return;
  }

  const table = currentTable();
  if (!table) {
    mountApp('<main class="fatal-state"><span>⌗</span><h1>Mesa não encontrada</h1><p>Confira o QR Code ou peça ajuda a um atendente.</p></main>');
    return;
  }
  if (ui.cartTableId !== table.id) {
    ui.cart = {};
    ui.cartTableId = table.id;
    saveCart();
  }
  mountApp(renderClient(ui.data, ui, table));
}

function expireAdminSession(failedToken) {
  const currentToken = sessionStorage.getItem(adminTokenStorageKey);
  if (failedToken && currentToken && failedToken !== currentToken) {
    return;
  }

  const wasLoggedIn = ui.adminSession;
  sessionStorage.removeItem(sessionStorageKey);
  sessionStorage.removeItem(adminTokenStorageKey);
  discardDialogFocusReturn();
  ui.adminSession = false;
  ui.adminSnapshotReady = false;
  ui.data = null;
  ui.panel = null;
  ui.productDraft = null;
  ui.selectedOrderId = null;
  ui.qrResult = null;
  ui.qrTable = null;
  render();
  if (wasLoggedIn) {
    notify("Sua sessão expirou. Entre novamente.", "error");
  }
}

async function refreshData(renderAfter) {
  let payload;
  const loadingAdmin = isAdminRoute();
  const previousData = ui.data;
  const panelBeforeRefresh = ui.panel;
  if (loadingAdmin) {
    if (!ui.adminSession) {
      render();
      return;
    }
    payload = await getState();
  } else {
    const tableToken = new URLSearchParams(window.location.search).get("mesa");
    if (!tableToken) {
      throw new Error("Este acesso não possui uma mesa válida. Escaneie o QR Code da sua mesa.");
    }
    payload = await getMenu(tableToken);
  }
  const knownOrderIds = loadingAdmin && ui.adminSnapshotReady && ui.data && ui.data.orders
    ? new Set(ui.data.orders.map((order) => order.id))
    : new Set();
  ui.data = payload;
  if (loadingAdmin) {
    const incomingOrders = payload.orders.filter((order) => {
      return order.paymentStatus === "APPROVED" && order.status === "NEW" && !knownOrderIds.has(order.id);
    });
    if (ui.adminSnapshotReady && incomingOrders.length) {
      notify(incomingOrders.length === 1 ? "Novo pedido pago chegou à fila." :
        incomingOrders.length + " novos pedidos pagos chegaram à fila.", "success");
    }
    ui.adminSnapshotReady = true;
  }
  const removedCartItems = cleanCart(previousData);
  if (!isAdminRoute()) {
    await restoreCustomerTracking();
  }
  const mustReconcileOpenCart = !loadingAdmin && removedCartItems.length > 0 &&
    ["cart", "checkout"].includes(panelBeforeRefresh) && ui.panel === panelBeforeRefresh;
  if (mustReconcileOpenCart) {
    const remainingItems = getCartItems(ui.data, ui.cart);
    if (!remainingItems.length) {
      ui.panel = null;
      restoreDialogFocusOnMount = Boolean(dialogReturnTarget);
    }
    render();
    const removedNames = removedCartItems.map((item) => item.name).filter(Boolean);
    const subject = removedNames.length === 1
      ? removedNames[0] + " ficou indisponível e foi removido"
      : (removedNames.length > 1 ? removedNames.join(", ") : "Alguns itens") + " ficaram indisponíveis e foram removidos";
    notify(subject + (remainingItems.length
      ? ". Revise o total atualizado antes de continuar."
      : ". Seu carrinho ficou vazio."), "error");
    return;
  }
  if (renderAfter !== false) {
    render();
  }
}

async function restoreCustomerTracking() {
  const table = currentTable();
  if (!table) {
    return;
  }
  const candidates = [
    { key: pendingOrderStorageKey, kind: "pending", value: ui.paymentOrder },
    { key: lastOrderStorageKey, kind: "last", value: ui.lastOrder }
  ];

  for (const candidate of candidates) {
    const stored = candidate.value;
    if (!stored) {
      continue;
    }
    if (stored.tableId !== table.id) {
      clearTrackedOrder(candidate.key);
      if (candidate.kind === "pending") {
        ui.paymentOrder = null;
      } else {
        ui.lastOrder = null;
      }
      continue;
    }
    try {
      const response = await getOrderTracking(stored.id, stored.accessToken);
      const trackedOrder = { ...response.order, accessToken: stored.accessToken };
      if (trackedOrder.paymentStatus === "PENDING") {
        ui.paymentOrder = trackedOrder;
        ui.lastOrder = null;
        ui.panel = "payment";
        saveTrackedOrder(pendingOrderStorageKey, trackedOrder);
        clearTrackedOrder(lastOrderStorageKey);
      } else {
        ui.lastOrder = trackedOrder;
        ui.paymentOrder = null;
        ui.panel = null;
        saveTrackedOrder(lastOrderStorageKey, trackedOrder);
        clearTrackedOrder(pendingOrderStorageKey);
      }
      return;
    } catch {
      clearTrackedOrder(candidate.key);
      if (candidate.kind === "pending") {
        ui.paymentOrder = null;
      } else {
        ui.lastOrder = null;
      }
    }
  }
}

function cleanCart(previousData) {
  if (!ui.data) {
    return [];
  }
  const validIds = new Set(ui.data.products
    .filter((product) => product.active && product.available !== false)
    .map((product) => product.id));
  const nextCart = {};
  const removedItems = [];
  Object.entries(ui.cart).forEach(([id, quantity]) => {
    if (validIds.has(id) && Number.isInteger(quantity) && quantity > 0) {
      nextCart[id] = quantity;
      return;
    }
    const product = ui.data.products.find((item) => item.id === id) ||
      (previousData && previousData.products ? previousData.products.find((item) => item.id === id) : null);
    removedItems.push({ id, name: product ? product.name : "Item", quantity });
  });
  ui.cart = nextCart;
  saveCart();
  return removedItems;
}

function notify(message, tone) {
  const safeTone = tone || "success";
  toastRegion.innerHTML = '<div class="toast toast-' + safeTone + '"><span>' +
    (safeTone === "success" ? "✓" : "!") + "</span><p>" + escapeHtml(message) + "</p></div>";
  window.clearTimeout(notify.timeoutId);
  notify.timeoutId = window.setTimeout(() => {
    toastRegion.innerHTML = "";
  }, 4200);
}

function dismissToast() {
  window.clearTimeout(notify.timeoutId);
  toastRegion.innerHTML = "";
}

function setCartQuantity(productId, nextQuantity) {
  if (nextQuantity <= 0) {
    delete ui.cart[productId];
  } else {
    ui.cart[productId] = Math.min(20, nextQuantity);
  }
  saveCart();
}

function setMenuTable(token) {
  const url = new URL(window.location.href);
  url.searchParams.set("mesa", token);
  history.replaceState({}, "", url.pathname + url.search + url.hash);
  ui.cart = {};
  ui.cartTableId = null;
  saveCart();
  render();
  notify("Mesa alterada. O carrinho foi atualizado.", "success");
}

function closePanel() {
  if (ui.panel === "new-product") {
    ui.productDraft = null;
  }
  restoreDialogFocusOnMount = Boolean(dialogReturnTarget);
  ui.panel = null;
  ui.selectedOrderId = null;
  ui.qrResult = null;
  ui.qrTable = null;
  render();
}

async function copyToClipboard(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }
  notify(successMessage || "Copiado para a área de transferência.", "success");
}

async function handleAction(actionElement) {
  const action = actionElement.dataset.action;

  if (action === "toggle-theme") {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
    notify(nextTheme === "dark" ? "Tema escuro ativado." : "Tema claro ativado.", "success");
    return;
  }
  if (action === "go-admin") {
    window.location.hash = "#/admin/dashboard";
    return;
  }
  if (action === "admin-home") {
    discardDialogFocusReturn();
    ui.panel = null;
    ui.productDraft = null;
    ui.selectedOrderId = null;
    ui.qrResult = null;
    ui.qrTable = null;
    ui.adminSection = "dashboard";
    if (window.location.hash === "#/admin/dashboard") {
      render();
    } else {
      window.location.hash = "#/admin/dashboard";
    }
    return;
  }
  if (action === "client-home") {
    const table = currentTable() || (ui.data && ui.data.tables.find((item) => item.active));
    if (!table) {
      notify("Não foi possível identificar a mesa deste cardápio.", "error");
      return;
    }
    discardDialogFocusReturn();
    ui.panel = null;
    if (ui.lastOrder) {
      ui.lastOrder = null;
      clearTrackedOrder(lastOrderStorageKey);
    }
    ui.category = "all";
    ui.search = "";
    const url = new URL(window.location.href);
    url.pathname = "/";
    url.hash = "";
    url.search = "";
    url.searchParams.set("mesa", table.qrToken || table.id);
    history.replaceState({}, "", url.pathname + url.search);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (action === "go-client") {
    const url = new URL(window.location.href);
    const table = ui.data && ui.data.tables.find((item) => item.active);
    if (table) {
      url.searchParams.set("mesa", table.qrToken || table.id);
    }
    url.hash = "";
    window.location.href = url.pathname + url.search;
    return;
  }
  if (action === "add-item") {
    const product = ui.data.products.find((item) => item.id === actionElement.dataset.id);
    if (!product || product.available === false) {
      notify("Esse produto está indisponível no momento.", "error");
      return;
    }
    setCartQuantity(product.id, (ui.cart[product.id] || 0) + 1);
    render();
    notify(product.name + " foi adicionado ao carrinho.", "success");
    return;
  }
  if (action === "increase-item") {
    const product = ui.data.products.find((item) => item.id === actionElement.dataset.id);
    if (!product || product.available === false) {
      notify("Esse produto está indisponível no momento.", "error");
      return;
    }
    setCartQuantity(actionElement.dataset.id, (ui.cart[actionElement.dataset.id] || 0) + 1);
    renderPreservingScroll(".cart-list");
    return;
  }
  if (action === "decrease-item") {
    setCartQuantity(actionElement.dataset.id, (ui.cart[actionElement.dataset.id] || 0) - 1);
    if (!getCartItems(ui.data, ui.cart).length) {
      restoreDialogFocusOnMount = Boolean(dialogReturnTarget);
      ui.panel = null;
    }
    renderPreservingScroll(".cart-list");
    return;
  }
  if (action === "set-category") {
    ui.category = actionElement.dataset.category || "all";
    renderPreservingScroll(".category-tabs");
    return;
  }
  if (action === "open-cart") {
    const items = getCartItems(ui.data, ui.cart);
    if (!items.length) {
      notify("Seu carrinho ainda está vazio.", "error");
      return;
    }
    dismissToast();
    rememberDialogTrigger(actionElement);
    ui.panel = "cart";
    render();
    return;
  }
  if (action === "close-panel") {
    closePanel();
    return;
  }
  if (action === "open-checkout") {
    const items = getCartItems(ui.data, ui.cart);
    if (!items.length) {
      notify("Adicione um item antes de finalizar.", "error");
      return;
    }
    if (items.some((item) => item.available === false)) {
      notify("Remova os itens indisponíveis antes de continuar.", "error");
      return;
    }
    dismissToast();
    ui.panel = "checkout";
    render();
    return;
  }
  if (action === "copy-pix") {
    await copyToClipboard(actionElement.dataset.copy || "", "Código Pix copiado.");
    return;
  }
  if (action === "new-order") {
    discardDialogFocusReturn();
    ui.lastOrder = null;
    ui.paymentOrder = null;
    ui.panel = null;
    clearTrackedOrder(lastOrderStorageKey);
    clearTrackedOrder(pendingOrderStorageKey);
    render();
    return;
  }
  if (action === "logout") {
    discardDialogFocusReturn();
    sessionStorage.removeItem(sessionStorageKey);
    sessionStorage.removeItem(adminTokenStorageKey);
    ui.adminSession = false;
    ui.adminSnapshotReady = false;
    render();
    notify("Você saiu do painel.", "success");
    return;
  }
  if (action === "advance-order") {
    actionElement.disabled = true;
    try {
      await changeOrderStatus(actionElement.dataset.id, actionElement.dataset.status);
      await refreshData();
      notify("Status do pedido atualizado.", "success");
    } catch (error) {
      actionElement.disabled = false;
      notify(error.message, "error");
    }
    return;
  }
  if (action === "set-order-filter") {
    ui.orderFilter = actionElement.dataset.filter || "ACTIVE";
    render();
    return;
  }
  if (action === "set-dashboard-period") {
    const period = actionElement.dataset.period || "today";
    if (!dashboardPeriods.some((item) => item.id === period)) {
      return;
    }
    ui.dashboardPeriod = period;
    renderPreservingScroll(".dashboard-period-tabs");
    const activePeriod = appRoot.querySelector('[data-action="set-dashboard-period"][data-period="' + period + '"]');
    if (activePeriod) {
      activePeriod.focus({ preventScroll: true });
    }
    return;
  }
  if (action === "open-order-details") {
    dismissToast();
    rememberDialogTrigger(actionElement);
    ui.selectedOrderId = actionElement.dataset.id || null;
    ui.panel = "order-details";
    render();
    return;
  }
  if (action === "refresh-orders") {
    try {
      await refreshData();
      notify("Fila de pedidos atualizada.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
    return;
  }
  if (action === "open-new-product") {
    dismissToast();
    rememberDialogTrigger(actionElement);
    const firstCategory = ui.data.categories.find((category) => category.active);
    ui.productDraft = createProductDraft(firstCategory ? firstCategory.id : "");
    ui.panel = "new-product";
    render();
    return;
  }
  if (action === "open-new-table") {
    dismissToast();
    rememberDialogTrigger(actionElement);
    ui.panel = "new-table";
    render();
    return;
  }
  if (action === "copy-link") {
    const table = ui.data.tables.find((item) => item.id === actionElement.dataset.table);
    if (table) {
      await copyToClipboard(tableLink(table, ui.data.publicBaseUrl), "Link da mesa copiado.");
    }
    return;
  }
  if (action === "show-qr") {
    dismissToast();
    rememberDialogTrigger(actionElement);
    ui.panel = "qr";
    ui.qrTable = actionElement.dataset.table;
    ui.qrResult = null;
    render();
    try {
      ui.qrResult = await getTableQr(ui.qrTable);
      render();
    } catch (error) {
      notify(error.message, "error");
    }
  }
}

appRoot.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    return;
  }
  if (["INPUT", "SELECT", "TEXTAREA"].includes(actionElement.tagName)) {
    return;
  }
  if (actionElement.tagName === "A" && !actionElement.dataset.action) {
    return;
  }
  event.preventDefault();
  handleAction(actionElement);
});

appRoot.addEventListener("input", (event) => {
  const input = event.target;
  if (input.dataset.productField && ui.productDraft) {
    const field = input.dataset.productField;
    ui.productDraft[field] = input.type === "checkbox" ? input.checked : input.value;
    const preview = appRoot.querySelector("[data-product-image-preview]");
    if (preview) {
      const image = preview.querySelector("img");
      const fallback = preview.querySelector("span");
      if (field === "imageUrl" && image && fallback) {
        const hasImage = Boolean(input.value.trim());
        image.src = input.value.trim();
        image.hidden = !hasImage;
        fallback.hidden = hasImage;
      }
      if (field === "emoji" && fallback) {
        fallback.textContent = input.value || "🍽️";
      }
    }
    const previewName = appRoot.querySelector("[data-product-preview-name]");
    const previewMeta = appRoot.querySelector("[data-product-preview-meta]");
    if (field === "name" && previewName) {
      previewName.textContent = input.value || "Nome do produto";
    }
    if (["brand", "volume"].includes(field) && previewMeta) {
      previewMeta.textContent = [ui.productDraft.brand, ui.productDraft.volume].filter(Boolean).join(" · ") || "Marca e tamanho";
    }
    return;
  }
  if (input.dataset.action === "search-menu") {
    ui.search = input.value;
    const productGrid = appRoot.querySelector(".product-grid");
    if (productGrid && ui.data) {
      productGrid.innerHTML = renderProductGrid(ui.data, ui);
    }
    return;
  }
  if (input.dataset.action === "search-orders") {
    const value = input.value;
    ui.orderSearch = value;
    window.clearTimeout(orderSearchRenderTimer);
    if (event.isComposing) {
      return;
    }
    orderSearchRenderTimer = window.setTimeout(() => {
      render();
      const updatedInput = appRoot.querySelector('[data-action="search-orders"]');
      if (updatedInput) {
        updatedInput.focus({ preventScroll: true });
        updatedInput.setSelectionRange(value.length, value.length);
      }
    }, 180);
  }
});

appRoot.addEventListener("change", async (event) => {
  const element = event.target;
  if (element.dataset.productField && ui.productDraft) {
    ui.productDraft[element.dataset.productField] = element.type === "checkbox" ? element.checked : element.value;
    return;
  }
  if (element.dataset.action === "select-table") {
    setMenuTable(element.value);
    return;
  }
  if (element.dataset.action === "toggle-product") {
    const available = element.checked;
    element.disabled = true;
    try {
      await patchProduct(element.dataset.id, { available });
      await refreshData();
      notify(available ? "Produto disponível para venda." : "Produto marcado como indisponível.", "success");
    } catch (error) {
      element.disabled = false;
      element.checked = !available;
      notify(error.message, "error");
    }
  }
});

appRoot.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;

  if (form.id === "checkout-form") {
    const table = currentTable();
    const items = getCartItems(ui.data, ui.cart);
    const values = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await createOrder({
        tableToken: table.qrToken,
        customerName: values.get("customerName"),
        customerNote: values.get("customerNote"),
        items: items.map((item) => ({ productId: item.id, quantity: item.quantity }))
      });
      ui.paymentOrder = { ...response.order, accessToken: response.accessToken };
      saveTrackedOrder(pendingOrderStorageKey, ui.paymentOrder);
      ui.panel = "payment";
      render();
    } catch (error) {
      submitButton.disabled = false;
      notify(error.message, "error");
    }
    return;
  }

  if (form.id === "payment-form") {
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await approveOrder(ui.paymentOrder.id, ui.paymentOrder.accessToken);
      ui.lastOrder = { ...response.order, accessToken: ui.paymentOrder.accessToken };
      saveTrackedOrder(lastOrderStorageKey, ui.lastOrder);
      clearTrackedOrder(pendingOrderStorageKey);
      ui.paymentOrder = null;
      discardDialogFocusReturn();
      ui.panel = null;
      ui.cart = {};
      saveCart();
      await refreshData(false);
      render();
      notify("Pagamento aprovado. Pedido enviado ao bar.", "success");
    } catch (error) {
      submitButton.disabled = false;
      notify(error.message, "error");
    }
    return;
  }

  if (form.id === "admin-login-form") {
    const values = new FormData(form);
    try {
      const response = await loginAdmin(values.get("email"), values.get("password"));
      sessionStorage.setItem(adminTokenStorageKey, response.token);
      sessionStorage.setItem(sessionStorageKey, "active");
      ui.adminSession = true;
      ui.adminSection = "dashboard";
      window.scrollTo(0, 0);
      if (window.location.hash === "#/admin/dashboard") {
        await refreshData();
      } else {
        window.location.hash = "#/admin/dashboard";
      }
      notify("Bem-vindo ao painel do Bar do Nardo.", "success");
    } catch (error) {
      notify(error.message, "error");
    }
    return;
  }

  if (form.id === "new-product-form") {
    const values = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      await addProduct({
        name: values.get("name"),
        brand: values.get("brand"),
        description: values.get("description"),
        categoryId: values.get("categoryId"),
        priceCents: toCents(values.get("price")),
        volume: values.get("volume"),
        packaging: values.get("packaging"),
        sku: values.get("sku"),
        imageUrl: values.get("imageUrl"),
        imageAlt: values.get("imageAlt"),
        emoji: values.get("emoji"),
        badge: values.get("badge"),
        featured: form.elements.featured.checked,
        available: form.elements.available.checked
      });
      ui.productDraft = null;
      restoreDialogFocusOnMount = Boolean(dialogReturnTarget);
      ui.panel = null;
      await refreshData();
      notify("Produto adicionado ao cardápio.", "success");
    } catch (error) {
      submitButton.disabled = false;
      notify(error.message, "error");
    }
    return;
  }

  if (form.id === "new-table-form") {
    const values = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const response = await addTable({ label: values.get("label") });
      ui.panel = "qr";
      ui.qrTable = response.table.id;
      ui.qrResult = null;
      await refreshData(false);
      render();
      ui.qrResult = await getTableQr(response.table.id);
      render();
      notify("Mesa criada com QR Code exclusivo.", "success");
    } catch (error) {
      submitButton.disabled = false;
      notify(error.message, "error");
    }
  }
});

window.addEventListener("hashchange", () => {
  discardDialogFocusReturn();
  ui.panel = null;
  ui.productDraft = null;
  ui.qrResult = null;
  window.scrollTo(0, 0);
  refreshData().catch((error) => {
    notify(error.message, "error");
    render();
  });
});

window.addEventListener("keydown", (event) => {
  const dialog = appRoot.querySelector('[role="dialog"][aria-modal="true"]');
  if (event.key === "Tab" && dialog) {
    const focusable = focusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === first || !dialog.contains(activeElement))) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }
    if (!event.shiftKey && (activeElement === last || !dialog.contains(activeElement))) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
  }
  if (event.key === "Escape" && ui.panel && ui.panel !== "payment") {
    event.preventDefault();
    closePanel();
  }
});

window.setInterval(() => {
  if (ui.adminSession && isAdminRoute()) {
    refreshData(!ui.panel).catch(() => {});
    return;
  }
  if (!isAdminRoute()) {
    // Mantém cardápio e carrinho sincronizados com a disponibilidade definida no painel.
    // Com um painel aberto, atualiza os dados sem recriar campos nem perder a rolagem do usuário.
    refreshData(!ui.panel).catch(() => {});
  }
}, 15000);

window.addEventListener("bar-admin-session-expired", (event) => {
  expireAdminSession(event.detail && event.detail.token);
});

refreshData().catch((error) => {
  if (isAdminRoute() && error.status === 401) {
    return;
  }
  mountApp('<main class="fatal-state"><span>!</span><h1>Não foi possível abrir o sistema</h1><p>' +
    escapeHtml(error.message) + "</p><button class=\"button button-primary\" onclick=\"window.location.reload()\">Tentar novamente</button></main>");
});
