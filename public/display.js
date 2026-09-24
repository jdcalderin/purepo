(function () {
  "use strict";

  var messagesNode = document.getElementById("tvMessages");
  var collageNode = document.getElementById("tvCollage");
  var photoCountNode = document.getElementById("tvPhotoCount");
  var emptyCollageNode = document.getElementById("tvCollageEmpty");
  var messages = [];
  var lastPayload = "";
  var page = 0;
  var cacheKey = "mural-pau-last-messages-v1";
  var knownMessageIds = {};
  var receivedFirstResponse = false;
  var notificationSound = document.createElement("audio");
  notificationSound.src = "/sounds/new-message.wav";
  notificationSound.preload = "auto";
  var emojiIcons = {
    "❤": "heart", "❤️": "heart", "♥": "heart", "💕": "heart", "💖": "heart", "💗": "heart", "💓": "heart", "💝": "heart",
    "🎉": "party", "🥳": "party", "🎂": "cake", "✨": "sparkles", "⭐": "sparkles", "🌟": "sparkles",
    "😊": "smile", "🙂": "smile", "😀": "smile", "😃": "smile", "😄": "smile", "😁": "smile", "😂": "smile", "🤣": "smile",
    "😍": "love", "🥰": "love", "👏": "clap", "🙌": "clap", "🔥": "fire"
  };
  var emojiPattern = /(❤️|❤|♥|💕|💖|💗|💓|💝|🎉|🥳|🎂|✨|⭐|🌟|😊|🙂|😀|😃|😄|😁|😂|🤣|😍|🥰|👏|🙌|🔥)/g;

  function rememberMessages(items) {
    var i;
    for (i = 0; i < items.length; i += 1) knownMessageIds[items[i].id] = true;
  }

  function playNotification() {
    var attempt;
    try {
      notificationSound.currentTime = 0;
      attempt = notificationSound.play();
      if (attempt && attempt.catch) attempt.catch(function () {});
    } catch (ignore) {
      // Algunos televisores bloquean audio automático; el mural continúa funcionando.
    }
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function text(node, value) {
    node.appendChild(document.createTextNode(value));
  }

  function richText(node, value) {
    var source = String(value);
    var cursor = 0;
    source.replace(emojiPattern, function (match, index) {
      var image;
      if (index > cursor) text(node, source.slice(cursor, index));
      image = document.createElement("img");
      image.className = "emoji-icon";
      image.src = "/images/emojis/" + emojiIcons[match] + ".svg";
      image.alt = match;
      image.setAttribute("aria-label", match);
      node.appendChild(image);
      cursor = index + match.length;
      return match;
    });
    if (cursor < source.length) text(node, source.slice(cursor));
  }

  function addMessage(item) {
    var card = document.createElement("article");
    var body = document.createElement("p");
    var author = document.createElement("strong");
    card.className = "tv-message";
    text(body, "“");
    richText(body, item.message);
    text(body, "”");
    text(author, "— ");
    richText(author, item.author);
    card.appendChild(body);
    card.appendChild(author);
    messagesNode.appendChild(card);
  }

  function addPhoto(item) {
    var frame = document.createElement("div");
    var image = document.createElement("img");
    frame.className = "tv-collage-item";
    image.src = item.photoUrl;
    image.alt = "Recuerdo compartido por " + item.author;
    image.setAttribute("loading", "eager");
    frame.appendChild(image);
    collageNode.appendChild(frame);
  }

  function render() {
    var photos = [];
    var i;
    var start;
    var visible;

    clear(messagesNode);
    clear(collageNode);

    for (i = 0; i < messages.length; i += 1) {
      if (messages[i].photoUrl) photos.push(messages[i]);
    }

    clear(photoCountNode);
    text(photoCountNode, photos.length + (photos.length === 1 ? " foto" : " fotos"));
    emptyCollageNode.style.display = photos.length ? "none" : "grid";

    if (!messages.length) {
      var empty = document.createElement("p");
      empty.className = "tv-empty";
      text(empty, "El primer mensaje puede ser el tuyo ✦");
      messagesNode.appendChild(empty);
    } else {
      start = (page * 3) % messages.length;
      visible = Math.min(3, messages.length);
      for (i = 0; i < visible; i += 1) addMessage(messages[(start + i) % messages.length]);
    }

    if (photos.length) {
      start = (page * 6) % photos.length;
      visible = Math.min(6, photos.length);
      for (i = 0; i < visible; i += 1) addPhoto(photos[(start + i) % photos.length]);
    }
  }

  function restoreSavedMural() {
    var saved;
    try {
      saved = window.localStorage.getItem(cacheKey);
      if (!saved) return;
      messages = JSON.parse(saved);
      if (Object.prototype.toString.call(messages) !== "[object Array]") {
        messages = [];
        return;
      }
      lastPayload = saved;
      rememberMessages(messages);
      render();
    } catch (ignore) {
      messages = [];
    }
  }

  function saveMural(payload) {
    try {
      window.localStorage.setItem(cacheKey, payload);
    } catch (ignore) {
      // El mural sigue funcionando incluso si el TV no permite almacenamiento local.
    }
  }

  function loadMessages() {
    var request = new XMLHttpRequest();
    request.open("GET", "/api/messages?updated=" + new Date().getTime(), true);
    request.setRequestHeader("Cache-Control", "no-cache");
    request.onreadystatechange = function () {
      var payload;
      if (request.readyState !== 4 || request.status !== 200) return;
      try {
        payload = request.responseText;
        if (payload !== lastPayload) {
          var received = JSON.parse(payload);
          // Si hay una respuesta temporalmente vacía, no borra el mural ya visible.
          var hasNewMessage = false;
          var i;
          if (!received.length && messages.length) return;
          for (i = 0; i < received.length; i += 1) {
            if (!knownMessageIds[received[i].id]) hasNewMessage = true;
          }
          messages = received;
          lastPayload = payload;
          rememberMessages(received);
          saveMural(payload);
          render();
          if (receivedFirstResponse && hasNewMessage) playNotification();
          receivedFirstResponse = true;
        }
      } catch (ignore) {
        // Conserva lo ya mostrado si una respuesta no se puede interpretar.
      }
    };
    request.send(null);
  }

  // Muestra el último mural inmediatamente y luego lo sincroniza en segundo plano.
  restoreSavedMural();
  loadMessages();
  window.setInterval(function () {
    loadMessages();
    if (messages.length) {
      page += 1;
      render();
    }
  }, 8000);
}());
