const MAX_PHOTO_SIZE = 8 * 1024 * 1024;
const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function withoutCache(response) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readMessages(env) {
  return (await env.MESSAGES.get("messages", "json")) || [];
}

async function handleCreateMessage(request, env) {
  const form = await request.formData();
  const author = String(form.get("author") || "").trim();
  const messageText = String(form.get("message") || "").trim();
  const photo = form.get("photo");

  if (!author || !messageText || author.length > 50 || messageText.length > 600) {
    return json({ error: "Completa tu nombre y un mensaje de hasta 600 caracteres." }, 400);
  }

  let photoUrl = null;
  if (photo && typeof photo !== "string" && photo.size > 0) {
    const extension = IMAGE_EXTENSIONS[photo.type];
    if (!extension) return json({ error: "La foto debe ser JPG, PNG, WebP o GIF." }, 400);
    if (photo.size > MAX_PHOTO_SIZE) return json({ error: "La foto supera el límite de 8 MB." }, 413);

    const key = `images/${crypto.randomUUID()}.${extension}`;
    await env.PHOTOS.put(key, photo.stream(), {
      httpMetadata: { contentType: photo.type },
      customMetadata: { author, uploadedAt: new Date().toISOString() }
    });
    photoUrl = `/api/photos/${key}`;
  }

  const message = {
    id: crypto.randomUUID(),
    author,
    message: messageText,
    photoUrl,
    createdAt: new Date().toISOString()
  };

  const messages = await readMessages(env);
  messages.unshift(message);
  await env.MESSAGES.put("messages", JSON.stringify(messages));
  return json(message, 201);
}

async function handlePhoto(request, env, pathname) {
  const key = decodeURIComponent(pathname.slice("/api/photos/".length));
  if (!key.startsWith("images/") || key.includes("..")) return json({ error: "Foto no encontrada." }, 404);

  const object = await env.PHOTOS.get(key);
  if (!object) return json({ error: "Foto no encontrada." }, 404);

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/messages") {
        if (request.method === "GET") return json(await readMessages(env));
        if (request.method === "POST") return handleCreateMessage(request, env);
        return json({ error: "Método no permitido." }, 405);
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/photos/")) {
        return handlePhoto(request, env, url.pathname);
      }
      // Los televisores WebOS suelen conservar el HTML y JavaScript aun al recargar.
      // Forzamos una versión fresca para que el mural siempre consulte los recuerdos nuevos.
      return withoutCache(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error("Mural request failed", error);
      return json({ error: "No pudimos guardar el recuerdo. Intenta de nuevo." }, 500);
    }
  }
};
