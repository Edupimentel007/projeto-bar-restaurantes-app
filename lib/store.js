import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

const currentFile = fileURLToPath(import.meta.url);
const projectRoot = path.dirname(path.dirname(currentFile));
const localStorePath = path.join(projectRoot, "data", "store.json");
const seedStorePath = path.join(projectRoot, "data", "seed.json");
const blobPath = process.env.BAR_STORE_BLOB_PATH || "bar-do-nardo/store.json";
const usesBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const maximumWriteAttempts = 6;
let localUpdateQueue = Promise.resolve();

if (process.env.VERCEL && !usesBlobStorage) {
  throw new Error("BLOB_READ_WRITE_TOKEN precisa estar configurado na Vercel.");
}

function parseStore(rawStore) {
  const store = JSON.parse(rawStore);
  if (!store || typeof store !== "object" || !Array.isArray(store.products) ||
    !Array.isArray(store.tables) || !Array.isArray(store.orders) || !store.meta) {
    throw new Error("O armazenamento do bar está em um formato inválido.");
  }
  return store;
}

function readSeedStore() {
  return parseStore(fs.readFileSync(seedStorePath, "utf8"));
}

function serializeStore(store) {
  return JSON.stringify(store, null, 2) + "\n";
}

function readLocalStore() {
  if (!fs.existsSync(localStorePath)) {
    const initialStore = readSeedStore();
    writeLocalStore(initialStore);
    return initialStore;
  }
  return parseStore(fs.readFileSync(localStorePath, "utf8"));
}

function writeLocalStore(store) {
  const temporaryPath = localStorePath + ".tmp";
  fs.writeFileSync(temporaryPath, serializeStore(store), "utf8");
  fs.renameSync(temporaryPath, localStorePath);
}

async function blobResultToSnapshot(result) {
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  const rawStore = await new Response(result.stream).text();
  return {
    store: parseStore(rawStore),
    // O GET privado pode devolver um ETag fraco (W/"..."). O ifMatch do Blob
    // exige a forma forte equivalente para a escrita condicional.
    etag: String(result.blob.etag || "").replace(/^W\//, "")
  };
}

async function getBlobSnapshot() {
  const result = await get(blobPath, {
    access: "private",
    useCache: false
  });
  return blobResultToSnapshot(result);
}

async function initializeBlobStore() {
  const initialStore = readSeedStore();
  try {
    const blob = await put(blobPath, serializeStore(initialStore), {
      access: "private",
      contentType: "application/json",
      cacheControlMaxAge: 60
    });
    return { store: initialStore, etag: blob.etag };
  } catch (error) {
    const existingSnapshot = await getBlobSnapshot();
    if (existingSnapshot) {
      return existingSnapshot;
    }
    throw error;
  }
}

async function readBlobSnapshot() {
  return await getBlobSnapshot() || initializeBlobStore();
}

function retryDelay(attempt) {
  return new Promise((resolve) => {
    const jitter = Math.floor(Math.random() * 35);
    setTimeout(resolve, 30 * (attempt + 1) + jitter);
  });
}

function isConditionalWriteConflict(error) {
  if (error instanceof BlobPreconditionFailedError) {
    return true;
  }
  const message = String(error && error.message || "");
  return /etag mismatch|conditional request cannot succeed|conflicting operation/i.test(message);
}

async function updateBlobStore(mutator) {
  for (let attempt = 0; attempt < maximumWriteAttempts; attempt += 1) {
    const snapshot = await readBlobSnapshot();
    const result = await mutator(snapshot.store);
    try {
      await put(blobPath, serializeStore(snapshot.store), {
        access: "private",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: true,
        ifMatch: snapshot.etag
      });
      return result;
    } catch (error) {
      if (!isConditionalWriteConflict(error) || attempt === maximumWriteAttempts - 1) {
        throw error;
      }
      await retryDelay(attempt);
    }
  }
  throw new Error("Não foi possível atualizar o armazenamento do bar.");
}

export async function readStore() {
  if (!usesBlobStorage) {
    return readLocalStore();
  }
  return (await readBlobSnapshot()).store;
}

export function updateStore(mutator) {
  if (usesBlobStorage) {
    return updateBlobStore(mutator);
  }

  const operation = localUpdateQueue.then(async () => {
    const store = readLocalStore();
    const result = await mutator(store);
    writeLocalStore(store);
    return result;
  });
  localUpdateQueue = operation.catch(() => undefined);
  return operation;
}

export function storeBackend() {
  return usesBlobStorage ? "vercel-blob" : "local-file";
}
