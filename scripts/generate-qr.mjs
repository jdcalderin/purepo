import QRCode from "qrcode";

await QRCode.toFile("public/images/pau-qr.png", "https://purepo.jdcalderin.workers.dev/?modo=participar", {
  width: 960,
  margin: 2,
  errorCorrectionLevel: "M",
  color: { dark: "#32134B", light: "#FFFFFF" }
});
