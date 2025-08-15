import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json({ limit: "100mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Функция скачивания файла
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка скачивания ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

// Преобразуем транскрипт OpenAI в SRT с таймингами
function createSRT(transcript) {
  // OpenAI возвращает уже SRT, но если нет — простой пример
  // Разделяем по строкам и делаем фиктивные тайминги
  const lines = transcript.split("\n").filter(l => l.trim());
  let srt = "";
  let startTime = 0;
  const durationPerLine = 3; // 3 секунды на строку (можно регулировать)

  lines.forEach((line, i) => {
    const endTime = startTime + durationPerLine;
    const formatTime = t => {
      const h = String(Math.floor(t / 3600)).padStart(2, "0");
      const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
      const s = String(Math.floor(t % 60)).padStart(2, "0");
      const ms = String(Math.floor((t % 1) * 1000)).padStart(3, "0");
      return `${h}:${m}:${s},${ms}`;
    };
    srt += `${i + 1}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${line}\n\n`;
    startTime = endTime;
  });

  return srt;
}

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) return res.status(400).send("Нужно указать videoUrl и audioUrl");

    fs.mkdirSync("uploads", { recursive: true });

    const videoPath = path.resolve("uploads", `${uuidv4()}_video.mp4`);
    const audioPath = path.resolve("uploads", `${uuidv4()}_audio.wav`);
    const mergedPath = path.resolve("uploads", `${uuidv4()}_merged.mp4`);
    const srtPath = path.resolve("uploads", `${uuidv4()}_subtitles.srt`);
    const finalPath = path.resolve("uploads", `${uuidv4()}_final.mp4`);

    console.log("⬇️ Скачиваем видео и аудио...");
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    console.log("🎬 Объединяем видео и аудио...");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(["-c:v copy", "-c:a aac"])
        .save(mergedPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("⏳ Транскрибируем аудио...");
    const transcriptionResult = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "gpt-4o-mini-transcribe"
    });

    const srtContent = createSRT(transcriptionResult.text);
    fs.writeFileSync(srtPath, srtContent, "utf8");
    console.log("✅ SRT создан:", srtPath);

    console.log("💬 Вшиваем субтитры в видео...");
    await new Promise((resolve, reject) => {
      ffmpeg(mergedPath)
        .outputOptions(
          "-vf",
          `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=1'`
        )
        .videoCodec("libx264")
        .audioCodec("aac")
        .save(finalPath)
        .on("start", cmd => console.log("FFmpeg команда:", cmd))
        .on("stderr", line => console.log("FFmpeg лог:", line))
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("✅ Готово! Отправляем видео с субтитрами.");
    res.download(finalPath, "output_with_subs.mp4");
  } catch (err) {
    console.error("Ошибка:", err);
    res.status(500).send(err.message);
  }
});

app.listen(10000, () => console.log("🚀 Сервер запущен на порту 10000"));
