import { IDB_NAME, IDB_STORE, IDB_VERSION } from '@/shared/constants';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run a readwrite transaction, resolve on tx.oncomplete */
async function writeTx(record: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

/** Run a readonly get, resolve with the raw record */
async function readTx(id: string): Promise<any> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const request = store.get(id);
    request.onsuccess = () => { db.close(); resolve(request.result); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

export interface OnnxModelRecord {
  data: ArrayBuffer;
  externalData?: ArrayBuffer;
  externalDataPath?: string;
}

/** Save model binary to IndexedDB */
export function saveModelBinary(
  id: string,
  data: ArrayBuffer,
  externalData?: ArrayBuffer,
  externalDataPath?: string,
): Promise<void> {
  return writeTx({ id, data, externalData, externalDataPath });
}

/** Load full ONNX model record (including external data) from IndexedDB */
export async function loadOnnxModelRecord(id: string): Promise<OnnxModelRecord | null> {
  const result = await readTx(id);
  if (!result?.data) return null;
  return { data: result.data, externalData: result.externalData, externalDataPath: result.externalDataPath };
}

export interface TfjsModelData {
  modelJson: string;
  weightsBin: ArrayBuffer;
}

export function saveTfjsModel(id: string, modelJson: string, weightsBin: ArrayBuffer): Promise<void> {
  return writeTx({ id, modelJson, weightsBin });
}

export async function loadTfjsModel(id: string): Promise<TfjsModelData | null> {
  const result = await readTx(id);
  if (!result?.modelJson) return null;
  return { modelJson: result.modelJson, weightsBin: result.weightsBin };
}

export async function deleteModelBinary(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
