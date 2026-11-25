// Content sniffing for uploads. A declared MIME type or file extension is never trusted on its own.

export const SIGNATURES = {
  "application/pdf": (b) => b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-",
  "image/png": (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/jpeg": (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"
};

export function matchesSignature(buffer, mediaType) {
  const check = SIGNATURES[String(mediaType || "").toLowerCase()];
  return Boolean(check && check(buffer));
}

// Returns an error message, or null when the buffer really is one of the allowed types.
export function validateUpload(buffer, mediaType, allowedTypes, maxBytes) {
  if (!allowedTypes.includes(String(mediaType || "").toLowerCase())) return "Unsupported file type.";
  if (buffer.length === 0) return "The file is empty.";
  if (buffer.length > maxBytes) return `The file is larger than ${Math.round(maxBytes / (1024 * 1024))} MB.`;
  if (!matchesSignature(buffer, mediaType)) return "The file content does not match its type.";
  return null;
}

// Storage-safe file name: no directories, no leading dots, limited charset and length.
export function safeFileName(name, fallback = "file") {
  const base = String(name || "").split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "").slice(-100);
  return base || fallback;
}
