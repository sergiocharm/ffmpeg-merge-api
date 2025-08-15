const express = require("express");
const multer = require("multer");
const fetch = require("node-fetch");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const { Configuration, OpenAIApi } = require("openai");

const app = express();
app.use(express.json({ limit: "50mb" }));

const upload = multer({ dest: "uploads/" });

// OpenAI API
const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

// Скачать файл по URL
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка скачивания ${url}`);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
}

// Транскрибировать аудио в SRT
async function transcribeToSRT(audioPath, srtPath) {
  const resp = await openai.audio.transcriptions.create({
    model: "gpt-4o-mini-transcribe",
    file: fs.createReadStream(audioPath),
    response_format: "srt"
  });
  fs.writeFileSync(srtPath, resp, "utf8");
}

// /merge — объединяет видео + аудио + субтитры
app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).send("Нужно указать videoUrl и audioUrl");
    }

    fs.mkdirSync("uploads", { recursive: true });

    const videoPath = `uploads/video.mp4`;
    const audioPath = `uploads/audio.wav`;
    const mergedPath = `uploads/merged.mp4`;
    const srtPath = `uploads/subtitles.srt`;
    const outputPath = `uploads/output_with_subs.mp4`;

    console.log("⬇️ Скачиваем файлы...");
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    console.log("🎬 Объединяем видео и аудио...");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions("-c:v copy", "-c:a aac")
        .save(mergedPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("📝 Делаем транскрипцию...");
    await transcribeToSRT(audioPath, srtPath);

    console.log("💬 Вшиваем субтитры...");
    await new Promise((resolve, reject) => {
      ffmpeg(mergedPath)
        .outputOptions(
          "-vf",
          `subtitles=${srtPath}:force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00FFFF&'`
        )
        .videoCodec("libx264")
        .audioCodec("aac")
        .save(outputPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("✅ Готово!");
    res.download(outputPath, "output_with_subs.mp4");

  } catch (err) {
    console.error("Ошибка:", err);
    res.status(500).send(err.message);
  }
});

app.listen(10000, () => console.log("🚀 Сервер запущен на порту 10000"));
