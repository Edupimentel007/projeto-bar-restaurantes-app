async function request(url, options) {
  const requestOptions = options || {};
  const admin = Boolean(requestOptions.admin);
  let adminToken = "";
  const headers = {
    "Content-Type": "application/json",
    ...(requestOptions.headers || {})
  };
  if (admin) {
    adminToken = sessionStorage.getItem("brique-bar-admin-token-v1") || "";
    if (adminToken) {
      headers.Authorization = "Bearer " + adminToken;
    }
  }

  const response = await fetch(url, {
    ...requestOptions,
    headers
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const sessionExpired = admin && response.status === 401;
    const error = new Error(sessionExpired
      ? "Sua sessão expirou. Entre novamente."
      : payload.error || "Não foi possível concluir esta ação.");
    error.status = response.status;
    if (sessionExpired) {
      window.dispatchEvent(new CustomEvent("bar-admin-session-expired", {
        detail: { token: adminToken }
      }));
    }
    throw error;
  }
  return payload;
}

export function getState() {
  return request("/api/state", { admin: true });
}

export function getMenu(tableToken) {
  return request("/api/menu/" + encodeURIComponent(tableToken));
}

export function loginAdmin(email, password) {
  return request("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function createOrder(payload) {
  return request("/api/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function approveOrder(orderId, accessToken) {
  return request("/api/orders/" + encodeURIComponent(orderId) + "/pay", {
    method: "POST",
    body: JSON.stringify({ method: "PIX", accessToken })
  });
}

export function getOrderTracking(orderId, accessToken) {
  return request("/api/orders/" + encodeURIComponent(orderId) + "/tracking/" + encodeURIComponent(accessToken));
}

export function changeOrderStatus(orderId, status) {
  return request("/api/orders/" + encodeURIComponent(orderId) + "/status", {
    method: "PATCH",
    admin: true,
    body: JSON.stringify({ status })
  });
}

export function patchProduct(productId, payload) {
  return request("/api/products/" + encodeURIComponent(productId), {
    method: "PATCH",
    admin: true,
    body: JSON.stringify(payload)
  });
}

export function addProduct(payload) {
  return request("/api/products", {
    method: "POST",
    admin: true,
    body: JSON.stringify(payload)
  });
}

export function addTable(payload) {
  return request("/api/tables", {
    method: "POST",
    admin: true,
    body: JSON.stringify(payload)
  });
}

export function getTableQr(tableId) {
  return request("/api/tables/" + encodeURIComponent(tableId) + "/qr", { admin: true });
}
