const form = document.querySelector("#messageForm");
const authorInput = document.querySelector("#author");
const messageInput = document.querySelector("#message");
const photoInput = document.querySelector("#photo");
const photoPreview = document.querySelector("#photoPreview");
const photoLabel = document.querySelector("#photoLabel");
const charCount = document.querySelector("#charCount");
const status = document.querySelector("#formStatus");
const messageWall = document.querySelector("#messages");
const messageTemplate = document.querySelector("#messageTemplate");
const emptyMessages = document.querySelector("#emptyMessages");
const emptyCollage = document.querySelector("#emptyCollage");
const collage = document.querySelector("#collage");
const messageCount = document.querySelector("#messageCount");
const tvMessages = document.querySelector("#tvMessages");
const tvCollage = document.querySelector("#tvCollage");
const tvCollageEmpty = document.querySelector("#tvCollageEmpty");
const tvPhotoCount = document.querySelector("#tvPhotoCount");
const qrDialog = document.querySelector("#qrDialog");
const qrImage = document.querySelector("#qrImage");
const lightbox = document.querySelector("#lightbox");
let lastPayload = "";
let currentMessages = [];
let tvPage = 0;
const isGuestView = document.documentElement.dataset.view === "guest";
let participationUrl = "https://purepo.jdcalderin.workers.dev/?modo=participar";

if (isGuestView) document.title = "Deja un mensaje para Pau";

function setQrSources() {
  const source = "/images/pau-qr.png";
  const displayQrImage = document.querySelector("#displayQrImage");
  const displayQr = document.querySelector(".display-qr");
  displayQrImage.onload = () => displayQr.classList.remove("qr-unavailable");
  displayQrImage.onerror = () => displayQr.classList.add("qr-unavailable");
  displayQrImage.src = source;
  const qrLink = document.querySelector("#displayQrLink");
  qrLink.href = participationUrl;
  qrLink.textContent = new URL(participationUrl).hostname;
  qrImage.src = source;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function renderMessages(messages) {
  currentMessages = messages;
  messageWall.replaceChildren();
  collage.replaceChildren();
  messageCount.textContent = String(messages.length);
  emptyMessages.hidden = messages.length > 0;

  for (const item of messages) {
    const fragment = messageTemplate.content.cloneNode(true);
    fragment.querySelector(".card-message").textContent = item.message;
    fragment.querySelector(".card-author").textContent = item.author;
    fragment.querySelector(".card-avatar").textContent = initials(item.author);
    const time = fragment.querySelector("time");
    time.dateTime = item.createdAt;
    time.textContent = formatDate(item.createdAt);
    messageWall.append(fragment);

    if (item.photoUrl) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "collage-item";
      button.setAttribute("aria-label", `Ver foto compartida por ${item.author}`);
      const image = document.createElement("img");
      image.src = item.photoUrl;
      image.alt = `Recuerdo compartido por ${item.author}`;
      image.loading = "lazy";
      button.append(image);
      button.addEventListener("click", () => openLightbox(item));
      collage.append(button);
    }
  }

  renderTvStage(messages);

  emptyCollage.hidden = messages.some((item) => item.photoUrl);
}

function renderTvStage(messages) {
  tvMessages.replaceChildren();
  tvCollage.replaceChildren();
  const photos = messages.filter((item) => item.photoUrl);
  tvPhotoCount.textContent = `${photos.length} ${photos.length === 1 ? "foto" : "fotos"}`;
  tvCollageEmpty.hidden = photos.length > 0;

  if (messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tv-empty";
    empty.textContent = "El primer mensaje puede ser el tuyo ✦";
    tvMessages.append(empty);
  } else {
    const start = (tvPage * 3) % messages.length;
    const visibleMessages = Array.from({ length: Math.min(3, messages.length) }, (_, index) => messages[(start + index) % messages.length]);
    for (const item of visibleMessages) {
      const card = document.createElement("article");
      card.className = "tv-message";
      const text = document.createElement("p");
      text.textContent = `“${item.message}”`;
      const author = document.createElement("strong");
      author.textContent = `— ${item.author}`;
      card.append(text, author);
      tvMessages.append(card);
    }
  }

  if (photos.length) {
    const start = (tvPage * 6) % photos.length;
    const visiblePhotos = Array.from({ length: Math.min(6, photos.length) }, (_, index) => photos[(start + index) % photos.length]);
    for (const item of visiblePhotos) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tv-collage-item";
      button.setAttribute("aria-label", `Ver foto compartida por ${item.author}`);
      const image = document.createElement("img");
      image.src = item.photoUrl;
      image.alt = `Recuerdo compartido por ${item.author}`;
      button.append(image);
      button.addEventListener("click", () => openLightbox(item));
      tvCollage.append(button);
    }
  }
}

async function loadMessages({ quiet = false } = {}) {
  try {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el mural.");
    const messages = await response.json();
    const payload = JSON.stringify(messages);
    if (payload !== lastPayload) {
      renderMessages(messages);
      lastPayload = payload;
    }
  } catch (error) {
    if (!quiet) {
      emptyMessages.hidden = false;
      emptyMessages.querySelector("h3").textContent = "No pudimos abrir el mural";
      emptyMessages.querySelector("p").textContent = "Actualiza la página para intentarlo otra vez.";
    }
  }
}

function openLightbox(item) {
  document.querySelector("#lightboxImage").src = item.photoUrl;
  document.querySelector("#lightboxImage").alt = `Recuerdo compartido por ${item.author}`;
  document.querySelector("#lightboxCaption").textContent = `Compartida por ${item.author}`;
  lightbox.showModal();
}

messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length} / 600`;
});

photoInput.addEventListener("change", () => {
  const [file] = photoInput.files;
  if (!file) {
    photoPreview.hidden = true;
    photoLabel.textContent = "Sumar una foto";
    return;
  }
  photoLabel.textContent = file.name.length > 24 ? `${file.name.slice(0, 21)}…` : file.name;
  photoPreview.style.backgroundImage = `url(${URL.createObjectURL(file)})`;
  photoPreview.hidden = false;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = form.querySelector(".send-button");
  submitButton.disabled = true;
  status.className = "form-status";
  status.textContent = "Guardando tu recuerdo…";

  try {
    const response = await fetch("/api/messages", { method: "POST", body: new FormData(form) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No pudimos guardar tu mensaje. Revisa tu conexión e inténtalo otra vez.");
    form.reset();
    charCount.textContent = "0 / 600";
    photoPreview.hidden = true;
    photoLabel.textContent = "Sumar una foto";
    status.textContent = "¡Listo! Tu cariño ya hace parte del mural ♥";
    document.body.classList.remove("celebrating");
    void document.body.offsetWidth;
    document.body.classList.add("celebrating");
    await loadMessages();
    setTimeout(() => document.querySelector("#mural").scrollIntoView({ behavior: "smooth" }), 450);
  } catch (error) {
    status.className = "form-status error";
    status.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector("#openQr").addEventListener("click", () => {
  qrDialog.showModal();
});
document.querySelector("#closeQr").addEventListener("click", () => qrDialog.close());
document.querySelector("#closeLightbox").addEventListener("click", () => lightbox.close());
document.querySelector("#copyLink").addEventListener("click", async (event) => {
  await navigator.clipboard.writeText(location.href);
  event.currentTarget.textContent = "Enlace copiado ✓";
  setTimeout(() => { event.currentTarget.textContent = "Copiar enlace"; }, 1800);
});

for (const dialog of [qrDialog, lightbox]) {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

document.body.addEventListener("animationend", (event) => {
  if (event.animationName === "celebration-flash") document.body.classList.remove("celebrating");
});

async function loadConfig() {
  try {
    const config = await fetch("/config.json").then((response) => response.json());
    document.querySelector("#birthdayName").textContent = config.name;
    document.querySelector("#eyebrow").textContent = config.eyebrow;
    document.querySelector("#description").textContent = config.description;
    document.querySelector("#heroImage").src = config.heroImage;
    document.querySelector("#tvHeroImage").src = config.heroImage;
    document.querySelector("#tvBirthdayName").textContent = config.name;
    if (config.publicUrl) participationUrl = new URL("?modo=participar", config.publicUrl).href;
  } catch {
    // The embedded defaults keep the page usable if configuration is unavailable.
  }
  setQrSources();
}

await Promise.all([loadConfig(), loadMessages()]);
setInterval(() => {
  loadMessages({ quiet: true });
  if (!isGuestView && currentMessages.length) {
    tvPage += 1;
    renderTvStage(currentMessages);
  }
}, 8000);
