const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const { OpenAI } = require("openai");

const app = express();
app.use(express.json());

// Инициализация OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function downloadFile(url, outputPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка скачивания ${url}`);
  const fileStream = fs.createWriteStream(outputPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

// Функция транскрибации
async function transcribeAudio(audioPath) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model: "gpt-4o-mini-transcribe", // можно whisper-1
    response_format: "srt"
  });
  return transcription;
}

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;

    // Скачиваем файлы
    const videoPath = path.join(__dirname, "video.mp4");
    const audioPath = path.join(__dirname, "audio.wav");
    const mergedPath = path.join(__dirname, "merged.mp4");
    const srtPath = path.join(__dirname, "subs.srt");

    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    // Транскрибация аудио
    console.log("Транскрибируем...");
    const srtContent = await transcribeAudio(audioPath);
    fs.writeFileSync(srtPath, srtContent, "utf-8");

    // Накладываем аудио на видео
    const tempPath = path.join(__dirname, "temp.mp4");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions("-map 0:v", "-map 1:a", "-c:v libx264", "-c:a aac")
        .save(tempPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Накладываем субтитры с красивым стилем
    const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; // на Render обычно есть
    await new Promise((resolve, reject) => {
      ffmpeg(tempPath)
        .outputOptions(`-vf subtitles=${srtPath}:force_style='FontName=DejaVu Sans,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0'`)
        .videoCodec("libx264")
        .audioCodec("aac")
        .save(mergedPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // Отправляем файл
    res.download(mergedPath, "final.mp4", () => {
      [videoPath, audioPath, tempPath, mergedPath, srtPath].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка обработки: " + err.message);
  }
});

app.listen(10000, () => console.log("Сервер запущен на порту 10000"));
