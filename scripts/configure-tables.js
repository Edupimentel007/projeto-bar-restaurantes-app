import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const dataDir = path.join(projectRoot, "data");
const backupDir = path.join(dataDir, "backups");
const dataFiles = ["store.json", "seed.json"];
const configuredAt = new Date().toISOString();
const backupTimestamp = configuredAt.replace(/[:.]/g, "-");

function tableNumber(value) {
  return String(value).padStart(2, "0");
}

function normalizedTables(data) {
  const currentTables = Array.isArray(data.tables) ? data.tables : [];
  const byId = new Map(currentTables.map((table) => [table.id, table]));
  const legacyTable = byId.get("varanda-01");

  return Array.from({ length: 20 }, (_, index) => {
    const number = tableNumber(index + 1);
    const id = "table-" + number;
    const previous = byId.get(id) || (number === "20" ? legacyTable : null) || {};

    return {
      ...previous,
      id,
      label: "Mesa " + number,
      qrToken: "m" + number,
      active: true,
      createdAt: previous.createdAt || configuredAt
    };
  });
}

function normalizedOrders(data) {
  const orders = Array.isArray(data.orders) ? data.orders : [];
  return orders.map((order) => {
    if (order.tableId !== "varanda-01" && order.tableLabel !== "Varanda 01") {
      return order;
    }
    return {
      ...order,
      tableId: "table-20",
      tableLabel: "Mesa 20"
    };
  });
}

function validate(data, filename) {
  if (data.tables.length !== 20) {
    throw new Error(filename + ": a configuração deve conter exatamente 20 mesas.");
  }

  const ids = new Set(data.tables.map((table) => table.id));
  const tokens = new Set(data.tables.map((table) => table.qrToken));
  if (ids.size !== 20 || tokens.size !== 20) {
    throw new Error(filename + ": IDs e tokens de QR Code devem ser únicos.");
  }

  data.tables.forEach((table, index) => {
    const number = tableNumber(index + 1);
    if (table.id !== "table-" + number || table.label !== "Mesa " + number || table.qrToken !== "m" + number) {
      throw new Error(filename + ": a sequência das mesas está incorreta na posição " + (index + 1) + ".");
    }
  });
}

fs.mkdirSync(backupDir, { recursive: true });

for (const filename of dataFiles) {
  const filePath = path.join(dataDir, filename);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const nextData = {
    ...data,
    tables: normalizedTables(data),
    orders: normalizedOrders(data)
  };
  validate(nextData, filename);

  const backupName = path.basename(filename, ".json") + "-before-tables-" + backupTimestamp + ".json";
  fs.copyFileSync(filePath, path.join(backupDir, backupName));

  const temporaryPath = filePath + ".tmp";
  fs.writeFileSync(temporaryPath, JSON.stringify(nextData, null, 2) + "\n", "utf8");
  fs.renameSync(temporaryPath, filePath);
  console.log(filename + ": Mesas 01 a 20 configuradas em ordem.");
}

console.log("A antiga Varanda 01 foi convertida em Mesa 20, preservando seus pedidos.");
console.log("Backups anteriores salvos em data/backups.");
