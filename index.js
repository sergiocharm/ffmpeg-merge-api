import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200mb" }));

// Функция для скачивания файлов по URL
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}, status ${res.status}`);
  const fileStream = fs.createWriteStream(dest);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
  return dest;
}

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).send("videoUrl и audioUrl обязательны");
    }

    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

    const videoPath = path.join("uploads", `video-${uuidv4()}.mp4`);
    const audioPath = path.join("uploads", `audio-${uuidv4()}.wav`);
    const outputFileName = `merged-${uuidv4()}.mp4`;
    const outputPath = path.join("outputs", outputFileName);

    // Скачиваем файлы
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    // Склеиваем видео с аудио
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions(["-c:v copy", "-c:a aac", "-shortest"])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, outputFileName, () => {
          [videoPath, audioPath, outputPath].forEach(f => fs.unlinkSync(f));
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).send("Ошибка при обработке видео: " + err.message);
      });

  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка сервера: " + err.message);
  }
});

app.get("/", (req, res) => {
  res.send("FFmpeg Merge API is running!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
