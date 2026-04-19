import type { OfflineMutation } from "@/lib/offlineTypes";

const DATABASE_NAME = "smart-queue-offline";
const DATABASE_VERSION = 1;
const META_STORE = "meta";
const OUTBOX_STORE = "outbox";

let databasePromise: Promise<IDBDatabase> | null = null;

type MetaRecord<T> = {
  key: string;
  value: T;
};

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }

  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: "key" });
        }
        if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
          database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to open offline database"));
    });
  }

  return databasePromise;
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, executor: (store: IDBObjectStore) => void | T | Promise<T>) {
  const database = await openDatabase();

  return await new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    Promise.resolve(executor(store))
      .then((value) => {
        transaction.oncomplete = () => resolve(value as T);
        transaction.onerror = () => reject(transaction.error ?? new Error(`IndexedDB transaction failed for ${storeName}`));
        transaction.onabort = () => reject(transaction.error ?? new Error(`IndexedDB transaction aborted for ${storeName}`));
      })
      .catch(reject);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function getMeta<T>(key: string) {
  try {
    return await withStore<T | undefined>(META_STORE, "readonly", async (store) => {
      const record = await requestToPromise(store.get(key) as IDBRequest<MetaRecord<T> | undefined>);
      return record?.value;
    });
  } catch {
    return undefined;
  }
}

export async function setMeta<T>(key: string, value: T) {
  try {
    await withStore<void>(META_STORE, "readwrite", (store) => {
      store.put({ key, value } satisfies MetaRecord<T>);
    });
  } catch {}
}

export async function getOutboxItems() {
  try {
    const items = await withStore<OfflineMutation[]>(OUTBOX_STORE, "readonly", async (store) => {
      return await requestToPromise(store.getAll() as IDBRequest<OfflineMutation[]>);
    });

    return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } catch {
    return [];
  }
}

export async function putOutboxItem(item: OfflineMutation) {
  try {
    await withStore<void>(OUTBOX_STORE, "readwrite", (store) => {
      store.put(item);
    });
  } catch {}
}

export async function removeOutboxItem(id: string) {
  try {
    await withStore<void>(OUTBOX_STORE, "readwrite", (store) => {
      store.delete(id);
    });
  } catch {}
}

export async function updateOutboxItem(id: string, updater: (item: OfflineMutation) => OfflineMutation) {
  try {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OUTBOX_STORE, "readwrite");
      const store = transaction.objectStore(OUTBOX_STORE);
      const getRequest = store.get(id) as IDBRequest<OfflineMutation | undefined>;

      getRequest.onsuccess = () => {
        const current = getRequest.result;
        if (current) {
          store.put(updater(current));
        }
      };
      getRequest.onerror = () => reject(getRequest.error ?? new Error("Failed to load outbox item"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Failed to update outbox item"));
    });
  } catch {}
}
