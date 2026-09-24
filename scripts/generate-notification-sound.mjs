import { mkdir, writeFile } from "node:fs/promises";

const sampleRate = 22050;
const duration = 0.32;
const samples = Math.floor(sampleRate * duration);
const dataLength = samples * 2;
const wav = Buffer.alloc(44 + dataLength);

wav.write("RIFF", 0);
wav.writeUInt32LE(36 + dataLength, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(dataLength, 40);

for (let index = 0; index < samples; index += 1) {
  const time = index / sampleRate;
  const envelope = Math.max(0, 1 - time / duration) ** 2;
  const tone = Math.sin(2 * Math.PI * 880 * time) * 0.55 + Math.sin(2 * Math.PI * 1320 * time) * 0.25;
  wav.writeInt16LE(Math.round(tone * envelope * 13000), 44 + index * 2);
}

await mkdir("public/sounds", { recursive: true });
await writeFile("public/sounds/new-message.wav", wav);
