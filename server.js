import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_FILE = path.join(ROOT, "data", "messages.json");
const UPLOAD_DIR = path.join(ROOT, "data", "uploads");
const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_SIZE = 8 * 1024 * 1024 + 128 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

const IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

await fs.mkdir(UPLOAD_DIR, { recursive: true });
let writeQueue = Promise.resolve();

async function readMessages() {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function publicMessage(message) {
  return {
    id: message.id,
    author: message.author,
    message: message.message,
    photoUrl: message.photoUrl,
    createdAt: message.createdAt
  };
}

function saveMessage(message) {
  writeQueue = writeQueue.then(async () => {
    const messages = await readMessages();
    messages.unshift(message);
    const temporaryFile = `${DATA_FILE}.tmp`;
    await fs.writeFile(temporaryFile, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
    await fs.rename(temporaryFile, DATA_FILE);
  });
  return writeQueue;
}

function json(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        const error = new Error("La foto supera el límite de 8 MB.");
        error.status = 413;
        reject(error);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function splitBuffer(buffer, separator) {
  const parts = [];
  let start = 0;
  let index;
  while ((index = buffer.indexOf(separator, start)) !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
  }
  parts.push(buffer.subarray(start));
  return parts;
}

function parseMultipart(body, boundary) {
  const separator = Buffer.from(`--${boundary}`);
  const fields = {};
  let photo = null;

  for (let part of splitBuffer(body, separator).slice(1, -1)) {
    if (part.subarray(0, 2).equals(Buffer.from("\r\n"))) part = part.subarray(2);
    if (part.subarray(-2).equals(Buffer.from("\r\n"))) part = part.subarray(0, -2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;

    const headers = part.subarray(0, headerEnd).toString("utf8");
    const value = part.subarray(headerEnd + 4);
    const name = headers.match(/name="([^"]+)"/i)?.[1];
    const filename = headers.match(/filename="([^"]*)"/i)?.[1];
    const contentType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase();
    if (!name) continue;

    if (filename && name === "photo") photo = { buffer: value, contentType };
    else fields[name] = value.toString("utf8");
  }
  return { fields, photo };
}

function hasValidSignature(buffer, mime) {
  if (mime === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (mime === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

async function createMessage(request, response) {
  const contentType = request.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.slice(1).find(Boolean)?.trim();
  if (!boundary) return json(response, 400, { error: "El formulario no llegó correctamente." });

  const { fields, photo } = parseMultipart(await collectBody(request), boundary);
  const author = String(fields.author || "").trim();
  const messageText = String(fields.message || "").trim();
  const originId = String(fields.originId || "").trim();
  if (!author || !messageText || author.length > 50 || messageText.length > 600) {
    return json(response, 400, { error: "Completa tu nombre y un mensaje de hasta 600 caracteres." });
  }
  if (originId && !/^[a-z0-9][a-z0-9-]{7,79}$/i.test(originId)) {
    return json(response, 400, { error: "No pudimos validar el origen del mensaje. Intenta de nuevo." });
  }

  let photoFilename = null;
  if (photo?.buffer?.length) {
    const extension = IMAGE_EXTENSIONS.get(photo.contentType);
    if (!extension || !hasValidSignature(photo.buffer, photo.contentType)) {
      return json(response, 400, { error: "La foto debe ser JPG, PNG, WebP o GIF." });
    }
    if (photo.buffer.length > 8 * 1024 * 1024) {
      return json(response, 413, { error: "La foto supera el límite de 8 MB." });
    }
    photoFilename = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    await fs.writeFile(path.join(UPLOAD_DIR, photoFilename), photo.buffer);
  }

  const message = {
    id: crypto.randomUUID(),
    author,
    message: messageText,
    photoUrl: photoFilename ? `/uploads/${photoFilename}` : null,
    // Identificador aleatorio del navegador; no contiene teléfono ni nombre del equipo.
    originId: originId || null,
    createdAt: new Date().toISOString()
  };

  try {
    await saveMessage(message);
    json(response, 201, publicMessage(message));
  } catch (error) {
    if (photoFilename) await fs.unlink(path.join(UPLOAD_DIR, photoFilename)).catch(() => {});
    throw error;
  }
}

async function serveFile(response, pathname) {
  const isUpload = pathname.startsWith("/uploads/");
  const root = isUpload ? UPLOAD_DIR : PUBLIC_DIR;
  const isAppRoute = pathname === "/" || pathname === "/participar" || pathname === "/participar/";
  const relativePath = isUpload ? pathname.slice("/uploads/".length) : isAppRoute ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    return json(response, 403, { error: "Ruta no permitida." });
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": isUpload ? "public, max-age=3600" : "no-cache"
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return json(response, 404, { error: "No encontrado." });
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    if (request.method === "GET" && pathname === "/api/messages") return json(response, 200, (await readMessages()).map(publicMessage));
    if (request.method === "POST" && pathname === "/api/messages") return await createMessage(request, response);
    if (request.method === "GET") return await serveFile(response, pathname);
    json(response, 405, { error: "Método no permitido." });
  } catch (error) {
    console.error(error);
    if (!response.headersSent) json(response, error.status || 500, { error: error.status ? error.message : "No pudimos guardar el recuerdo. Intenta de nuevo." });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mural de Pau disponible en http://localhost:${PORT}`);
});
