import express from "express";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import OpenAI from "openai";

ffmpeg.setFfmpegPath(ffmpegPath.path);

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "200mb" }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Скачать файл по URL
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

// Генерация SRT субтитров
function generateSRT(transcriptions) {
  let srt = "";
  transcriptions.forEach((t, i) => {
    const start = new Date(t.start * 1000).toISOString().substr(11, 12).replace('.', ',');
    const end = new Date(t.end * 1000).toISOString().substr(11, 12).replace('.', ',');
    srt += `${i + 1}\n${start} --> ${end}\n${t.text}\n\n`;
  });
  return srt;
}

app.post("/merge-with-subtitles", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) return res.status(400).send("videoUrl и audioUrl обязательны");

    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    if (!fs.existsSync("outputs")) fs.mkdirSync("outputs");

    const videoPath = path.join("uploads", `video-${uuidv4()}.mp4`);
    const audioPath = path.join("uploads", `audio-${uuidv4()}.wav`);
    const outputPath = path.join("outputs", `merged-subtitles-${uuidv4()}.mp4`);
    const srtPath = path.join("uploads", `subtitles-${uuidv4()}.srt`);

    // 1. Скачиваем видео и аудио
    await downloadFile(videoUrl, videoPath);
    await downloadFile(audioUrl, audioPath);

    // 2. Транскрипция аудио через Whisper
    const transcriptionResp = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1"
    });

    // Простая разбивка на SRT (можно доработать для таймингов)
    const srtContent = `1
00:00:00,000 --> 00:10:00,000
${transcriptionResp.text}\n`;

    fs.writeFileSync(srtPath, srtContent);

    // 3. Наложение аудио на видео + субтитры
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .outputOptions([
        "-c:v libx264",
        "-c:a aac",
        "-shortest",
        "-vf subtitles=" + srtPath.replace(/\\/g, "/")  // путь для Windows/Unix
      ])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, path.basename(outputPath), () => {
          [videoPath, audioPath, outputPath, srtPath].forEach(f => fs.unlinkSync(f));
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

app.get("/", (req, res) => res.send("FFmpeg Merge + Subtitles API running"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
