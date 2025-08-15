import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "50mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // берём из переменных окружения Render
});

// Функция для скачивания файла
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
  fs.writeFileSync(srtPath, transcription, "utf8");
  console.log("✅ Субтитры созданы:", srtPath);
}

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).send("Нужно указать videoUrl и audioUrl");
    }

    fs.mkdirSync("uploads", { recursive: true });

    const videoPath = path.resolve("uploads", "video.mp4");
    const audioPath = path.resolve("uploads", "audio.wav");
    const mergedPath = path.resolve("uploads", "merged.mp4");
    const srtPath = path.resolve("uploads", "subtitles.srt");
    const finalPath = path.resolve("uploads", "final_with_subs.mp4");

    console.log("⬇️ Скачиваем файлы...");
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

    // Транскрибируем аудио
    await transcribeAudioToSRT(audioPath, srtPath);

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
