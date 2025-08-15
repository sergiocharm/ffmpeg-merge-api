import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { exec } from "child_process";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "50mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // ключ берём из переменных окружения Render
});

// Функция для скачивания файла по URL
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка скачивания ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

// Транскрибируем аудио в SRT
async function transcribeAudioToSRT(audioPath, srtPath) {
  console.log("⏳ Транскрибируем аудио...");
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "gpt-4o-mini-transcribe",
    response_format: "srt"
  });
  fs.writeFileSync(srtPath, transcription);
  console.log("✅ Субтитры созданы:", srtPath);
}

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).send("Укажите videoUrl и audioUrl");
    }

    fs.mkdirSync("uploads", { recursive: true });

    const videoPath = path.join("uploads", "video.mp4");
    const audioPath = path.join("uploads", "audio.wav");
    const mergedPath = path.join("uploads", "merged.mp4");
    const srtPath = path.join("uploads", "subtitles.srt");
    const finalPath = path.join("uploads", "final_with_subs.mp4");

    // 1. Скачиваем видео и аудио
    console.log("⬇️ Скачиваем файлы...");
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    // 2. Склеиваем видео и аудио
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

    // 3. Транскрибируем аудио
    await transcribeAudioToSRT(audioPath, srtPath);

    // 4. Вшиваем субтитры (burn-in)
    console.log("💬 Вшиваем субтитры...");
    await new Promise((resolve, reject) => {
      ffmpeg(mergedPath)
        .outputOptions(
          "-vf",
          `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF&'`
        )
        .videoCodec("libx264")
        .audioCodec("aac")
        .save(finalPath)
        .on("start", cmd => console.log("FFmpeg команда:", cmd))
        .on("stderr", line => console.log("FFmpeg лог:", line))
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("✅ Готово!");
    res.download(finalPath, "output_with_subs.mp4");
  } catch (err) {
    console.error("Ошибка:", err);
    res.status(500).send(err.message);
  }
});

app.listen(10000, () => console.log("🚀 Сервер запущен на порту 10000"));
