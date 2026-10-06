import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(currentFile), "..");
const dataDir = path.join(projectRoot, "data");
const source = path.join(dataDir, "seed.json");
const target = path.join(dataDir, "store.json");
const backupDir = path.join(dataDir, "backups");

let backupPath = "";
if (fs.existsSync(target)) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  backupPath = path.join(backupDir, "store-" + timestamp + ".json");
  fs.copyFileSync(target, backupPath);
}
fs.copyFileSync(source, target);
console.log("Dados de demonstração restaurados em data/store.json.");
if (backupPath) {
  console.log("Backup anterior salvo em " + path.relative(projectRoot, backupPath) + ".");
}
