import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import path from "path";

const app = express();
app.use(express.json());

app.get("/healthz", (req, res) => res.send("ok"));

app.post("/image-to-video", async (req, res) => {
  try {
    const { imageUrl, audioUrl } = req.body;
    if (!imageUrl || !audioUrl) {
      return res.status(400).send("❌ imageUrl and audioUrl are required");
    }

    const id = uuidv4();
    const tmpDir = "/tmp";
    const imagePath = path.join(tmpDir, `${id}-image`);
    const audioPath = path.join(tmpDir, `${id}-audio.mp3`);
    const outputPath = path.join(tmpDir, `${id}-output.mp4`);

    // Скачиваем изображение
    await new Promise((resolve, reject) => {
      fetch(imageUrl).then(resp => {
        const fileStream = fs.createWriteStream(imagePath);
        resp.body.pipe(fileStream);
        resp.body.on("error", reject);
        fileStream.on("finish", resolve);
      }).catch(reject);
    });

    // Скачиваем аудио
    await new Promise((resolve, reject) => {
      fetch(audioUrl).then(resp => {
        const fileStream = fs.createWriteStream(audioPath);
        resp.body.pipe(fileStream);
        resp.body.on("error", reject);
        fileStream.on("finish", resolve);
      }).catch(reject);
    });

    // Генерируем видео из картинки и аудио
    const ffmpegCmd = `ffmpeg -y -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -c:a aac -b:a 192k -shortest "${outputPath}"`;
    
    exec(ffmpegCmd, (error, stdout, stderr) => {
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
app.listen(PORT, () => console.log(`🚀 Image-to-video server running on port ${PORT}`));
