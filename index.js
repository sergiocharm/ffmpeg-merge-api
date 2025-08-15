import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const app = express();
app.use(express.json());

// Health check
app.get("/healthz", (req, res) => res.send("ok"));

app.post("/merge", async (req, res) => {
  try {
    // Если тело приходит строкой, парсим его
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    const { imageUrl, audioUrl } = body;
    if (!imageUrl || !audioUrl) {
      return res.status(400).send("❌ imageUrl and audioUrl are required");
    }

    const id = uuidv4();
    const tmpDir = "/tmp";
    const imagePath = path.join(tmpDir, `${id}-image.png`);
    const audioPath = path.join(tmpDir, `${id}-audio.mp3`);
    const outputPath = path.join(tmpDir, `${id}-output.mp4`);

    // Функция для скачивания файла через stream с redirect
    async function downloadFile(url, destPath) {
      const resp = await fetch(url, { redirect: "follow" });
      if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
      await new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(destPath);
        resp.body.pipe(fileStream);
        resp.body.on("error", reject);
        fileStream.on("finish", resolve);
      });
      const size = fs.statSync(destPath).size;
      if (size === 0) throw new Error(`Downloaded file is empty: ${destPath}`);
    }

    // Скачиваем изображение и аудио
    await downloadFile(imageUrl, imagePath);
    await downloadFile(audioUrl, audioPath);

    // Генерируем видео из картинки и аудио
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -c:a aac -b:a 192k -shortest "${outputPath}"`;

    exec(ffmpegCmd, (error, stdout, stderr) => {
      // очищаем исходники
      fs.unlink(imagePath, () => {});
      fs.unlink(audioPath, () => {});

      if (error) {
        console.error("FFmpeg error:", stderr);
        return res.status(500).send("FFmpeg error: " + error.message);
      }

      res.sendFile(outputPath, (err) => {
        fs.unlink(outputPath, () => {});
        if (err) console.error(err);
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error: " + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Image+MP3 to video server running on port ${PORT}`));
