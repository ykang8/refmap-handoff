// Uploaded audio lives in the browser's IndexedDB (no server), keyed by reference id.
// localStorage only holds the file's metadata on the reference.

const dbName = 'refmap-audio';
const storeName = 'files';

export const maxAudioBytes = 150 * 1024 * 1024;
const audioExtensions = ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'webm', 'aif', 'aiff'];

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { dbPromise = undefined; reject(request.error ?? new Error('IndexedDB unavailable')); };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error ?? request.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction aborted'));
  });
}

export const putAudio = (referenceId: string, file: Blob) => run('readwrite', (store) => store.put(file, referenceId)).then(() => undefined);
export const getAudio = (referenceId: string) => run<Blob | undefined>('readonly', (store) => store.get(referenceId));
export const clearAudio = () => run('readwrite', (store) => store.clear()).then(() => undefined);

/** Best-effort cleanup; a failure only leaves an orphaned file behind. */
export function deleteAudio(referenceIds: string[]) {
  if (!referenceIds.length) return Promise.resolve();
  return openDb().then((db) => new Promise<void>((resolve) => {
    const transaction = db.transaction(storeName, 'readwrite');
    referenceIds.forEach((referenceId) => transaction.objectStore(storeName).delete(referenceId));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  })).catch(() => undefined);
}

/** Returns an error message, or null when the browser should be able to play the file. */
export function validateAudioFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const looksLikeAudio = file.type.startsWith('audio/') || audioExtensions.includes(extension);
  if (!looksLikeAudio) return 'Choose an audio file (MP3, WAV, M4A, AAC, OGG, or FLAC).';
  if (file.type && !document.createElement('audio').canPlayType(file.type)) return 'This browser can’t play that format. Try MP3, WAV, or M4A.';
  if (file.size > maxAudioBytes) return `That file is ${formatBytes(file.size)}. The limit is ${formatBytes(maxAudioBytes)}.`;
  return null;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
