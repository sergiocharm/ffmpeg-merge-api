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

app.use(express.json({ limit: "200mb" })); // Увеличиваем лимит JSON

// Вспомогательная функция для скачивания файлов
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}`);
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
    const { video1Url, video2Url, audioUrl } = req.body;
    if (!video1Url || !video2Url || !audioUrl) {
      return res.status(400).send("video1Url, video2Url и audioUrl обязательны");
    }

    // Создаем папки если нет
    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

    const video1Path = path.join("uploads", `video1-${uuidv4()}.mp4`);
    const video2Path = path.join("uploads", `video2-${uuidv4()}.mp4`);
    const audioPath = path.join("uploads", `audio-${uuidv4()}.mp3`);

    // Скачиваем файлы
    await downloadFile(video1Url, video1Path);
    await downloadFile(video2Url, video2Path);
    await downloadFile(audioUrl, audioPath);

    const outputFileName = `merged-${uuidv4()}.mp4`;
    const outputPath = path.join("outputs", outputFileName);

    // Склеиваем видео и накладываем аудио
    ffmpeg()
      .input(video1Path)
      .input(video2Path)
      .input(audioPath)
      .complexFilter(["[0:v][1:v]concat=n=2:v=1:a=0[v]"])
      .outputOptions(["-map [v]", "-map 2:a"])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, outputFileName, () => {
          // Удаляем временные файлы
          [video1Path, video2Path, audioPath, outputPath].forEach(f => fs.unlinkSync(f));
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).send("Ошибка при обработке видео");
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
