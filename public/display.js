(function () {
  "use strict";

  var messagesNode = document.getElementById("tvMessages");
  var collageNode = document.getElementById("tvCollage");
  var photoCountNode = document.getElementById("tvPhotoCount");
  var emptyCollageNode = document.getElementById("tvCollageEmpty");
  var messages = [];
  var lastPayload = "";
  var page = 0;

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function text(node, value) {
    node.appendChild(document.createTextNode(value));
  }

  function addMessage(item) {
    var card = document.createElement("article");
    var body = document.createElement("p");
    var author = document.createElement("strong");
    card.className = "tv-message";
    text(body, "“" + item.message + "”");
    text(author, "— " + item.author);
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
          messages = JSON.parse(payload);
          lastPayload = payload;
          render();
        }
      } catch (ignore) {
        // Conserva lo ya mostrado si una respuesta no se puede interpretar.
      }
    };
    request.send(null);
  }

  loadMessages();
  window.setInterval(function () {
    loadMessages();
    if (messages.length) {
      page += 1;
      render();
    }
  }, 8000);
}());
