# Mural de cumpleaños de Pau

Un tablero dinámico en Node.js donde los invitados pueden dejar mensajes, subir fotos y ver cómo crece un collage compartido. Los mensajes se guardan en `data/messages.json` y las fotos en `data/uploads/`.

## Ejecutar

```bash
npm start
```

No necesita instalar paquetes externos: funciona únicamente con las herramientas incluidas en Node.js.

Abre `http://localhost:3000` en el televisor. Esa vista no muestra el formulario y mantiene visible un QR que dirige a `http://localhost:3000/participar`.

Para que otras personas conectadas a la misma red entren desde sus celulares, abre el mural del televisor usando la dirección IP local del computador con el puerto `3000`. Así, el QR se genera con esa misma dirección y puede abrirse desde los celulares.

## Personalización

El nombre y los textos principales están en `public/config.json`. La foto principal está en `public/images/pau.jpeg`.

## Almacenamiento

- Mensajes y metadatos: `data/messages.json`
- Fotografías: `data/uploads/`
- Tamaño máximo por foto: 8 MB
- Formatos permitidos: JPG, PNG, WebP y GIF

La carpeta de fotos está excluida de Git para no publicar recuerdos privados por accidente. Antes de llevar el proyecto a producción conviene migrar ambos tipos de datos a un almacenamiento persistente externo.
