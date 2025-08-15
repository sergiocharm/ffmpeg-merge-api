import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const app = express();
app.use(express.json());

// Проверка сервера
app.get("/healthz", (req, res) => res.send("ok"));

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl } = req.body;
    if (!videoUrl || !audioUrl) {
      return res.status(400).send("❌ videoUrl and audioUrl are required");
    }

    const id = uuidv4();
    const tmpDir = "/tmp";
    const videoPath = path.join(tmpDir, `${id}-video`);
    const audioPath = path.join(tmpDir, `${id}-audio`);
    const outputPath = path.join(tmpDir, `${id}-output.mp4`);

    // Скачиваем видео через stream
    await new Promise((resolve, reject) => {
      fetch(videoUrl).then(resp => {
        const fileStream = fs.createWriteStream(videoPath);
        resp.body.pipe(fileStream);
        resp.body.on("error", reject);
        fileStream.on("finish", resolve);
      }).catch(reject);
    });

    // Скачиваем аудио через stream
    await new Promise((resolve, reject) => {
      fetch(audioUrl).then(resp => {
        const fileStream = fs.createWriteStream(audioPath);
        resp.body.pipe(fileStream);
        resp.body.on("error", reject);
        fileStream.on("finish", resolve);
      }).catch(reject);
    });

    // Склеиваем через FFmpeg (перекодируем на надежный mp4)
    const ffmpegCmd = `ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v libx264 -c:a aac -shortest "${outputPath}"`;
    exec(ffmpegCmd, (err
