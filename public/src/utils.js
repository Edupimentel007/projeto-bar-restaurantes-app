export const statusDetails = {
  PENDING_PAYMENT: { label: "Aguardando pagamento", tone: "neutral", next: null },
  NEW: { label: "Novo pedido", tone: "info", next: "PREPARING", action: "Iniciar preparo" },
  PREPARING: { label: "Em preparo", tone: "warning", next: "READY", action: "Marcar como pronto" },
  READY: { label: "Pronto para servir", tone: "success", next: "DELIVERED", action: "Confirmar entrega" },
  DELIVERED: { label: "Entregue", tone: "muted", next: null },
  CANCELLED: { label: "Cancelado", tone: "danger", next: null }
};

export function money(valueInCents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(valueInCents || 0) / 100);
}

export function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function shortTime(isoDate) {
  if (!isoDate) {
    return "--:--";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

export function fullDate(isoDate) {
  if (!isoDate) {
    return "Não informado";
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);

  return formatted.replace(",", " às");
}

export function currentDateInfo(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(safeDate);

  return {
    isoDate: dayKey(safeDate),
    label: formatted.charAt(0).toLocaleUpperCase("pt-BR") + formatted.slice(1)
  };
}

export const dashboardPeriods = [
  { id: "yesterday", label: "Ontem", badgeLabel: "Ontem", days: 1, offset: 1 },
  { id: "today", label: "Hoje", badgeLabel: "Hoje", days: 1, offset: 0 },
  { id: "7days", label: "7 dias", badgeLabel: "Últimos 7 dias", days: 7, offset: 0 },
  { id: "30days", label: "30 dias", badgeLabel: "Últimos 30 dias", days: 30, offset: 0 },
  { id: "90days", label: "90 dias", badgeLabel: "Últimos 90 dias", days: 90, offset: 0 }
];

export function statusPill(status) {
  const detail = statusDetails[status] || statusDetails.PENDING_PAYMENT;
  return '<span class="status-pill status-' + detail.tone + '">' + escapeHtml(detail.label) + "</span>";
}

export function categoryById(data, categoryId) {
  return data.categories.find((item) => item.id === categoryId);
}

export function orderItemCount(order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function isPaidOrder(order) {
  return order.paymentStatus === "APPROVED";
}

export function dashboardPeriodInfo(periodId = "today", now = new Date()) {
  const period = dashboardPeriods.find((item) => item.id === periodId) || dashboardPeriods[1];
  const today = dayKey(now) || dayKey(new Date());
  const endDate = shiftDayKey(today, -period.offset);
  const startDate = shiftDayKey(endDate, -(period.days - 1));
  const rangeLabel = period.days === 1
    ? formatCalendarDate(startDate, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    })
    : formatCalendarDate(startDate) + " a " + formatCalendarDate(endDate);

  return {
    ...period,
    startDate,
    endDate,
    rangeLabel: rangeLabel.charAt(0).toLocaleUpperCase("pt-BR") + rangeLabel.slice(1)
  };
}

export function salesSummary(orders, periodId = "today", now = new Date()) {
  const period = dashboardPeriodInfo(periodId, now);
  const paidOrders = orders.filter((order) => {
    const paidDay = dayKey(order.paidAt);
    return isPaidOrder(order) && order.status !== "CANCELLED" && Boolean(paidDay) &&
      paidDay >= period.startDate && paidDay <= period.endDate;
  }).sort((first, second) => {
    const firstDate = new Date(first.paidAt || first.createdAt).getTime() || 0;
    const secondDate = new Date(second.paidAt || second.createdAt).getTime() || 0;
    return secondDate - firstDate;
  });
  const revenue = paidOrders.reduce((total, order) => total + order.totalCents, 0);
  const itemTotals = new Map();

  paidOrders.forEach((order) => {
    order.items.forEach((item) => {
      const productKey = item.productId || item.productNameSnapshot;
      const previous = itemTotals.get(productKey) || {
        name: item.productNameSnapshot,
        quantity: 0
      };
      previous.quantity += item.quantity;
      itemTotals.set(productKey, previous);
    });
  });

  const topProducts = Array.from(itemTotals.values())
    .sort((first, second) => second.quantity - first.quantity);

  return {
    period,
    paidOrders,
    revenue,
    count: paidOrders.length,
    average: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
    topProducts
  };
}

export function toCents(value) {
  const raw = String(value || "").replace(/[^\d.,]/g, "");
  if (!raw) {
    return 0;
  }

  const lastComma = raw.lastIndexOf(",");
  const lastPeriod = raw.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastPeriod);
  if (decimalIndex === -1) {
    return Number(raw.replace(/\D/g, "")) * 100;
  }

  const decimalPart = raw.slice(decimalIndex + 1).replace(/[^\d]/g, "");
  if (decimalPart.length > 2) {
    return Number(raw.replace(/[^\d]/g, "")) * 100;
  }

  const wholePart = raw.slice(0, decimalIndex).replace(/[^\d]/g, "") || "0";
  return Number(wholePart) * 100 + Number(decimalPart.padEnd(2, "0"));
}

function dayKey(value) {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

function shiftDayKey(dateKey, amount) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return shifted.toISOString().slice(0, 10);
}

function formatCalendarDate(dateKey, options = {}) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options
  }).format(new Date(dateKey + "T12:00:00.000Z"));
}

export function makePixCode(order) {
  const marker = order.id.replace(/[^a-z0-9]/gi, "").slice(-12).toUpperCase();
  const pixReference = "BARDONARDO-" + marker;
  return "00020126580014BR.GOV.BCB.PIX01" + String(pixReference.length).padStart(2, "0") + pixReference + "520400005303986540" +
    String((order.totalCents / 100).toFixed(2)).replace(".", "") +
    "5802BR5912BAR DO NARDO6011NOVA ODESSA62070503***6304DEMO";
}

export function tableLink(table, publicBaseUrl) {
  const baseUrl = String(publicBaseUrl || window.location.origin).replace(/\/+$/, "");
  return baseUrl + "/?mesa=" + encodeURIComponent(table.qrToken);
}
