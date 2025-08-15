import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка multer для загрузки файлов
const upload = multer({ dest: "uploads/" });

// Маршрут для склейки двух видео и наложения аудио
app.post("/merge", upload.fields([
  { name: "video1", maxCount: 1 },
  { name: "video2", maxCount: 1 },
  { name: "audio", maxCount: 1 }
]), async (req, res) => {
  try {
    const video1 = req.files["video1"][0].path;
    const video2 = req.files["video2"][0].path;
    const audio = req.files["audio"][0].path;

    const outputFileName = `output-${uuidv4()}.mp4`;
    const outputPath = path.join("outputs", outputFileName);

    // Создаем папку outputs если нет
    if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

    // Склеиваем видео и накладываем аудио
    ffmpeg()
      .input(video1)
      .input(video2)
      .input(audio)
      .complexFilter([
        "[0:v][1:v]concat=n=2:v=1:a=0[v]"
      ])
      .outputOptions(["-map [v]", "-map 2:a"])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, outputFileName, () => {
          // удаляем временные файлы после отправки
          [video1, video2, audio, outputPath].forEach(f => fs.unlinkSync(f));
        });
      })
      .on("error", (err) => {
        console.error(err);
        res.status(500).send("Ошибка при обработке видео");
      });

  } catch (err) {
    console.error(err);
    res.status(500).send("Ошибка сервера");
  }
});

app.get("/", (req, res) => {
  res.send("FFmpeg Merge API is running!");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
