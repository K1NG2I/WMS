export const PDF_CACHE_KEY = "wms:pdfcache";

// Keep cache small enough to fit localStorage (~5 MB) even with base64 blobs.
export const MAX_CACHE = 10;

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read PDF blob"));
    reader.readAsDataURL(blob);
  });
}

export function loadPdfCache() {
  try {
    const raw = localStorage.getItem(PDF_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPdfCache(entries) {
  try {
    localStorage.setItem(PDF_CACHE_KEY, JSON.stringify(entries.slice(0, MAX_CACHE)));
  } catch {
    // Quota exceeded — keep newest entries only so caching never breaks downloads.
  }
}

export function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}