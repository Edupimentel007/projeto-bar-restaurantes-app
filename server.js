import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import { readStore, storeBackend, updateStore } from "./lib/store.js";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(currentFile);
const publicDir = path.join(projectRoot, "public");
const localEnvironmentPath = path.join(projectRoot, ".env");

if (!process.env.VERCEL && fs.existsSync(localEnvironmentPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(localEnvironmentPath);
}

const port = Number(process.env.PORT || 3333);
const configuredPublicBaseUrl = String(process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
const adminEmail = String(process.env.ADMIN_EMAIL || "").trim();
const adminPassword = String(process.env.ADMIN_PASSWORD || "");
const adminSessionSecret = String(process.env.ADMIN_SESSION_SECRET || "");

if (!adminEmail || adminPassword.length < 12 || adminSessionSecret.length < 32) {
  throw new Error(
    "Configure ADMIN_EMAIL, ADMIN_PASSWORD (12+ caracteres) e ADMIN_SESSION_SECRET (32+ caracteres)."
  );
}

function privateNetworkPriority(address) {
  if (/^192\.168\./.test(address)) {
    return 0;
  }
  if (/^10\./.test(address)) {
    return 1;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(address)) {
    return 2;
  }
  return 3;
}

function detectNetworkBaseUrl() {
  const candidates = Object.values(os.networkInterfaces())
    .flat()
    .filter((address) => {
      return address && address.family === "IPv4" && !address.internal &&
        privateNetworkPriority(address.address) < 3;
    })
    .sort((first, second) => privateNetworkPriority(first.address) - privateNetworkPriority(second.address));
  const address = candidates[0] && candidates[0].address;
  return address ? "http://" + address + ":" + port : "http://localhost:" + port;
}

const detectedPublicBaseUrl = detectNetworkBaseUrl();

function publicBaseUrlFor(request) {
  if (configuredPublicBaseUrl) {
    return configuredPublicBaseUrl;
  }

  const host = String(request.headers.host || "").trim();
  const localHost = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?$/i.test(host);
  if (host && !localHost) {
    const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProtocol === "https" ? "https" : "http";
    return protocol + "://" + host.replace(/\/+$/, "");
  }

  return detectedPublicBaseUrl;
}

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

const orderTransitions = {
  NEW: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: []
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function sendAppManifest(response, url) {
  const isAdmin = url.searchParams.get("context") === "admin";
  const requestedTableToken = String(url.searchParams.get("mesa") || "").trim().slice(0, 120);
  let tableToken = "";
  let tableLabel = "";

  if (!isAdmin && requestedTableToken) {
    const store = await readStore();
    const table = store.tables.find((item) => item.qrToken === requestedTableToken && item.active);
    if (table) {
      tableToken = table.qrToken;
      tableLabel = table.label;
    }
  }

  const encodedTableToken = encodeURIComponent(tableToken);
  const startUrl = isAdmin ? "/admin" : tableToken ? "/?mesa=" + encodedTableToken : "/";
  const appName = isAdmin
    ? "Bar do Nardo — Administração"
    : tableLabel ? "Bar do Nardo — " + tableLabel : "Bar do Nardo — Cardápio";

  const manifest = {
    name: appName,
    short_name: tableLabel ? "Nardo · " + tableLabel : isAdmin ? "Nardo Admin" : "Bar do Nardo",
    description: isAdmin
      ? "Painel operacional do Bar do Nardo."
      : "Cardápio digital e pedidos por mesa do Bar do Nardo.",
    lang: "pt-BR",
    id: startUrl,
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fffbe9",
    theme_color: "#43520c",
    categories: isAdmin ? ["business", "productivity"] : ["food", "lifestyle"],
    icons: [
      {
        src: "/assets/bar-do-nardo-logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/assets/bar-do-nardo-logo.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };

  response.writeHead(200, {
    "Content-Type": mimeTypes[".webmanifest"],
    "Cache-Control": "no-store",
    "Vary": "Accept-Encoding"
  });
  response.end(JSON.stringify(manifest));
}

function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({
    subject: adminEmail.toLowerCase(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 8,
    nonce: crypto.randomBytes(12).toString("base64url")
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSessionSecret)
    .update(payload)
    .digest("base64url");
  return payload + "." + signature;
}

function validAdminSession(token) {
  const [payload, providedSignature, ...extraParts] = String(token || "").split(".");
  if (!payload || !providedSignature || extraParts.length) {
    return false;
  }

  const expectedSignature = crypto.createHmac("sha256", adminSessionSecret)
    .update(payload)
    .digest("base64url");
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.subject === adminEmail.toLowerCase() &&
      Number.isFinite(session.expiresAt) && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(request, response) {
  const authorization = String(request.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!validAdminSession(token)) {
    sendError(response, 401, "Acesso administrativo não autorizado.");
    return false;
  }
  return true;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1_000_000) {
        reject(new Error("O conteúdo enviado é muito grande."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch {
        reject(new Error("JSON inválido."));
      }
    });

    request.on("error", reject);
  });
}

function createOrder(store, body) {
  const table = store.tables.find((item) => item.qrToken === body.tableToken && item.active);
  if (!table) {
    throw new Error("Mesa inválida ou indisponível.");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new Error("Adicione ao menos um item ao pedido.");
  }

  const quantities = new Map();
  for (const item of body.items) {
    const quantity = Number(item.quantity);
    if (!item.productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new Error("Há uma quantidade de item inválida.");
    }
    const accumulatedQuantity = (quantities.get(item.productId) || 0) + quantity;
    if (accumulatedQuantity > 20) {
      throw new Error("A quantidade máxima por produto é 20.");
    }
    quantities.set(item.productId, accumulatedQuantity);
  }

  const items = [];
  let totalCents = 0;

  for (const [productId, quantity] of quantities) {
    const product = store.products.find((item) => item.id === productId && item.active);
    if (!product || product.available === false) {
      throw new Error("Um dos produtos ficou indisponível. Atualize o carrinho.");
    }

    const lineTotalCents = product.priceCents * quantity;
    totalCents += lineTotalCents;
    items.push({
      id: "item-" + crypto.randomUUID(),
      productId: product.id,
      productNameSnapshot: product.name,
      unitPriceCentsSnapshot: product.priceCents,
      quantity,
      lineTotalCents,
      note: ""
    });
  }

  store.meta.nextOrderNumber += 1;
  const now = new Date().toISOString();
  const order = {
    id: "order-" + crypto.randomUUID(),
    publicCode: "PED-" + String(store.meta.nextOrderNumber).padStart(4, "0"),
    tableId: table.id,
    tableLabel: table.label,
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    paymentMethod: "PIX",
    customerAccessToken: crypto.randomBytes(24).toString("base64url"),
    customerName: String(body.customerName || "").trim().slice(0, 80),
    customerNote: String(body.customerNote || "").trim().slice(0, 280),
    items,
    subtotalCents: totalCents,
    totalCents,
    createdAt: now,
    paidAt: null,
    updatedAt: now
  };

  store.orders.unshift(order);
  return order;
}

function publicOrder(order) {
  return {
    id: order.id,
    publicCode: order.publicCode,
    tableId: order.tableId,
    tableLabel: order.tableLabel,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: order.items,
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    updatedAt: order.updatedAt
  };
}

function approvePayment(store, orderId, accessToken) {
  const order = store.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Pedido não encontrado.");
  }
  if (!accessToken || accessToken !== order.customerAccessToken) {
    throw new Error("Não foi possível validar este pagamento.");
  }
  if (order.paymentStatus === "APPROVED") {
    return order;
  }
  if (order.status !== "PENDING_PAYMENT") {
    throw new Error("Este pedido não pode mais receber pagamento.");
  }

  const now = new Date().toISOString();
  order.paymentStatus = "APPROVED";
  order.status = "NEW";
  order.paidAt = now;
  order.updatedAt = now;
  return order;
}

function updateOrderStatus(store, orderId, nextStatus) {
  const order = store.orders.find((item) => item.id === orderId);
  if (!order) {
    throw new Error("Pedido não encontrado.");
  }

  const allowed = orderTransitions[order.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error("Transição de status não permitida.");
  }

  order.status = nextStatus;
  order.updatedAt = new Date().toISOString();
  return order;
}

function productText(value, maximumLength) {
  return String(value || "").trim().slice(0, maximumLength);
}

function normalizeProductImageUrl(value) {
  const imageUrl = productText(value, 500);
  if (!imageUrl) {
    return "";
  }
  const isSafeLocalAsset = imageUrl.startsWith("/assets/") &&
    !imageUrl.includes("..") && !imageUrl.includes("\\");
  const isSecureRemoteAsset = /^https:\/\/[^\s]+$/i.test(imageUrl);
  if (!isSafeLocalAsset && !isSecureRemoteAsset) {
    throw new Error("Use uma imagem HTTPS ou um arquivo local dentro de /assets/.");
  }
  return imageUrl;
}

function updateProduct(store, productId, body) {
  const product = store.products.find((item) => item.id === productId);
  if (!product) {
    throw new Error("Produto não encontrado.");
  }

  if (typeof body.available === "boolean") {
    product.available = body.available;
  }
  if (typeof body.name === "string" && body.name.trim()) {
    product.name = body.name.trim().slice(0, 80);
  }
  if (typeof body.description === "string") {
    product.description = body.description.trim().slice(0, 180);
  }
  if (Number.isSafeInteger(body.priceCents) && body.priceCents > 0 && body.priceCents <= 10_000_000) {
    product.priceCents = body.priceCents;
  }
  if (typeof body.categoryId === "string" && store.categories.some((item) => item.id === body.categoryId)) {
    product.categoryId = body.categoryId;
  }
  if (typeof body.brand === "string") {
    product.brand = productText(body.brand, 60);
  }
  if (typeof body.volume === "string") {
    product.volume = productText(body.volume, 30);
  }
  if (typeof body.packaging === "string") {
    product.packaging = productText(body.packaging, 40);
  }
  if (typeof body.sku === "string") {
    product.sku = productText(body.sku, 40);
  }
  if (typeof body.badge === "string") {
    product.badge = productText(body.badge, 32);
  }
  if (typeof body.imageUrl === "string") {
    product.imageUrl = normalizeProductImageUrl(body.imageUrl);
  }
  if (typeof body.imageAlt === "string") {
    product.imageAlt = productText(body.imageAlt, 120);
  }
  if (typeof body.emoji === "string") {
    product.emoji = productText(body.emoji, 8) || "🍽️";
  }
  if (typeof body.featured === "boolean") {
    product.featured = body.featured;
  }
  product.updatedAt = new Date().toISOString();
  return product;
}

function addProduct(store, body) {
  const category = store.categories.find((item) => item.id === body.categoryId && item.active);
  const priceCents = Number(body.priceCents);
  const name = productText(body.name, 80);
  const sku = productText(body.sku, 40);
  if (!category || !name || !Number.isSafeInteger(priceCents) || priceCents < 100 || priceCents > 10_000_000) {
    throw new Error("Preencha nome, categoria e preço válido.");
  }
  if (sku && store.products.some((item) => String(item.sku || "").toLocaleLowerCase("pt-BR") === sku.toLocaleLowerCase("pt-BR"))) {
    throw new Error("Já existe um produto com este código interno.");
  }

  const now = new Date().toISOString();
  const product = {
    id: "product-" + crypto.randomUUID(),
    categoryId: category.id,
    name,
    brand: productText(body.brand, 60),
    description: productText(body.description, 180),
    volume: productText(body.volume, 30),
    packaging: productText(body.packaging, 40),
    sku,
    priceCents,
    imageUrl: normalizeProductImageUrl(body.imageUrl),
    imageAlt: productText(body.imageAlt, 120) || name,
    emoji: productText(body.emoji, 8) || "🍽️",
    badge: productText(body.badge, 32),
    available: typeof body.available === "boolean" ? body.available : true,
    active: true,
    featured: Boolean(body.featured),
    createdAt: now,
    updatedAt: now
  };
  store.products.push(product);
  return product;
}

function addTable(store, body) {
  const label = String(body.label || "").trim().slice(0, 40);
  if (!label) {
    throw new Error("Informe a identificação da mesa.");
  }
  if (store.tables.some((item) => item.label.toLowerCase() === label.toLowerCase())) {
    throw new Error("Já existe uma mesa com essa identificação.");
  }

  const id = "table-" + crypto.randomUUID();
  const table = {
    id,
    label,
    qrToken: crypto.randomBytes(18).toString("base64url"),
    active: true,
    createdAt: new Date().toISOString()
  };
  store.tables.push(table);
  return table;
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;
  const method = request.method || "GET";

  if (method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { ok: true, storage: storeBackend() });
    return;
  }

  if (method === "POST" && pathname === "/api/admin/login") {
    try {
      const body = await readJsonBody(request);
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (email !== adminEmail.toLowerCase() || password !== adminPassword) {
        sendError(response, 401, "E-mail ou senha inválidos.");
        return;
      }
      sendJson(response, 200, {
        token: createAdminSession(),
        expiresInSeconds: 60 * 60 * 8
      });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  const menuMatch = pathname.match(/^\/api\/menu\/([^/]+)$/);
  if (method === "GET" && menuMatch) {
    const store = await readStore();
    const table = store.tables.find((item) => item.qrToken === menuMatch[1] && item.active);
    if (!table) {
      sendError(response, 404, "Mesa não encontrada.");
      return;
    }
    sendJson(response, 200, {
      bar: store.bar,
      categories: store.categories,
      products: store.products.filter((product) => product.active && product.available !== false),
      tables: [{
        id: table.id,
        label: table.label,
        qrToken: table.qrToken,
        active: true
      }],
      orders: []
    });
    return;
  }

  if (method === "GET" && pathname === "/api/state") {
    if (!requireAdmin(request, response)) {
      return;
    }
    sendJson(response, 200, {
      ...await readStore(),
      publicBaseUrl: publicBaseUrlFor(request)
    });
    return;
  }

  if (method === "POST" && pathname === "/api/orders") {
    try {
      const body = await readJsonBody(request);
      const result = await updateStore((store) => {
        const order = createOrder(store, body);
        return {
          order: publicOrder(order),
          accessToken: order.customerAccessToken
        };
      });
      sendJson(response, 201, result);
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  const paymentMatch = pathname.match(/^\/api\/orders\/([^/]+)\/pay$/);
  if (method === "POST" && paymentMatch) {
    try {
      const body = await readJsonBody(request);
      const order = await updateStore((store) => {
        return approvePayment(store, paymentMatch[1], body.accessToken);
      });
      sendJson(response, 200, { order: publicOrder(order) });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  const trackingMatch = pathname.match(/^\/api\/orders\/([^/]+)\/tracking\/([^/]+)$/);
  if (method === "GET" && trackingMatch) {
    const store = await readStore();
    const order = store.orders.find((item) => {
      return item.id === trackingMatch[1] && item.customerAccessToken === trackingMatch[2];
    });
    if (!order) {
      sendError(response, 404, "Pedido não encontrado.");
      return;
    }
    sendJson(response, 200, { order: publicOrder(order) });
    return;
  }

  const statusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (method === "PATCH" && statusMatch) {
    if (!requireAdmin(request, response)) {
      return;
    }
    try {
      const body = await readJsonBody(request);
      const order = await updateStore((store) => {
        return updateOrderStatus(store, statusMatch[1], body.status);
      });
      sendJson(response, 200, { order });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (method === "PATCH" && productMatch) {
    if (!requireAdmin(request, response)) {
      return;
    }
    try {
      const body = await readJsonBody(request);
      const product = await updateStore((store) => {
        return updateProduct(store, productMatch[1], body);
      });
      sendJson(response, 200, { product });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  const qrMatch = pathname.match(/^\/api\/tables\/([^/]+)\/qr$/);
  if (method === "GET" && qrMatch) {
    if (!requireAdmin(request, response)) {
      return;
    }
    const store = await readStore();
    const table = store.tables.find((item) => item.id === qrMatch[1] && item.active);
    if (!table) {
      sendError(response, 404, "Mesa não encontrada.");
      return;
    }

    const menuUrl = publicBaseUrlFor(request) + "/?mesa=" + encodeURIComponent(table.qrToken);
    try {
      const dataUrl = await QRCode.toDataURL(menuUrl, {
        width: 720,
        margin: 4,
        errorCorrectionLevel: "H",
        color: {
          dark: "#1f2937",
          light: "#ffffff"
        }
      });
      sendJson(response, 200, { dataUrl, menuUrl });
    } catch {
      sendError(response, 500, "Não foi possível gerar o QR Code.");
    }
    return;
  }

  if (method === "POST" && pathname === "/api/products") {
    if (!requireAdmin(request, response)) {
      return;
    }
    try {
      const body = await readJsonBody(request);
      const product = await updateStore((store) => addProduct(store, body));
      sendJson(response, 201, { product });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  if (method === "POST" && pathname === "/api/tables") {
    if (!requireAdmin(request, response)) {
      return;
    }
    try {
      const body = await readJsonBody(request);
      const table = await updateStore((store) => addTable(store, body));
      sendJson(response, 201, { table });
    } catch (error) {
      sendError(response, 400, error.message);
    }
    return;
  }

  sendError(response, 404, "Rota da API não encontrada.");
}

function serveStatic(request, response, url) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  } catch {
    sendError(response, 400, "Endereço inválido.");
    return;
  }

  const filePath = path.resolve(publicDir, "." + relativePath);
  if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
    sendError(response, 403, "Acesso negado.");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const fallback = path.join(publicDir, "index.html");
    response.writeHead(200, { "Content-Type": mimeTypes[".html"], "Cache-Control": "no-store" });
    fs.createReadStream(fallback).pipe(response);
    return;
  }

  const extension = path.extname(filePath).toLowerCase();
  const noCache = [".html", ".js", ".css"].includes(extension);
  response.writeHead(200, {
    "Content-Type": mimeTypes[extension] || "application/octet-stream",
    "Cache-Control": noCache ? "no-store" : "public, max-age=3600"
  });
  fs.createReadStream(filePath).pipe(response);
}

const server = http.createServer(async (request, response) => {
  try {
    const host = request.headers.host || "localhost:" + port;
    const url = new URL(request.url || "/", "http://" + host);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    if (url.pathname === "/manifest.webmanifest") {
      await sendAppManifest(response, url);
      return;
    }

    serveStatic(request, response, url);
  } catch (error) {
    console.error("Erro ao atender requisição:", error);
    if (!response.headersSent) {
      sendError(response, 500, "Não foi possível concluir esta operação agora.");
    } else if (!response.writableEnded) {
      response.end();
    }
  }
});

server.listen(port, () => {
  console.log("QR Codes para celulares: " + (configuredPublicBaseUrl || detectedPublicBaseUrl));
  console.log("Bar do Nardo disponível em http://localhost:" + port);
  console.log("Armazenamento: " + storeBackend());
});
