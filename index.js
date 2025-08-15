import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { exec } from "child_process";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // ОБЯЗАТЕЛЬНО задать ключ
});

async function downloadFile(url, filename) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(filename, Buffer.from(buffer));
}

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

    const videoPath = path.join("video.mp4");
    const audioPath = path.join("audio.wav");
    const mergedPath = path.join("merged.mp4");
    const srtPath = path.join("subtitles.srt");
    const finalPath = path.join("final_with_subs.mp4");

    // 1. Скачиваем
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    // 2. Мёрджим видео и аудио
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(["-c:v copy", "-c:a aac", "-shortest"])
        .save(mergedPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // 3. Транскрибируем в .srt
    await transcribeAudioToSRT(audioPath, srtPath);

    // 4. Накладываем субтитры на видео
    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -i ${mergedPath} -vf subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFFFF&' -c:a copy ${finalPath}`,
        (err) => (err ? reject(err) : resolve())
      );
    });

    // 5. Отправляем результат
    res.sendFile(path.resolve(finalPath));

  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка: " + err.message);
  }
});

app.listen(10000, () => {
  console.log("✅ Сервер запущен на порту 10000");
});
