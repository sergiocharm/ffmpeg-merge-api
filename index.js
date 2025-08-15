import express from "express";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";
import ffmpegInstall from "@ffmpeg-installer/ffmpeg";
import { exec } from "child_process";

const streamPipeline = promisify(pipeline);
const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/healthz", (_, res) => res.send("ok"));

app.post("/merge", async (req, res) => {
  try {
    const { videoUrl, audioUrl, filename = "output.mp4" } = req.body || {};
    if (!videoUrl || !audioUrl) {
      return res.status(400).json({ error: "videoUrl and audioUrl are required" });
    }

    const id = uuidv4();
    const tmpDir = `/tmp/${id}`;
    fs.mkdirSync(tmpDir, { recursive: true });
    const videoPath = `${tmpDir}/video`;
    const audioPath = `${tmpDir}/audio`;
    const outputPath = `${tmpDir}/${filename}`;

    const download = async (url, dest) => {
      const resp = await fetch(url);
      if (!resp.ok || !resp.body) {
        throw new Error(`Download failed ${resp.status} ${resp.statusText}`);
      }
      const fileStream = fs.createWriteStream(dest);
      await streamPipeline(resp.body, fileStream);
    };

    await download(videoUrl, videoPath);
    await download(audioUrl, audioPath);

    const ffmpeg = `"${ffmpegInstall.path}"`;
    const cmd = `${ffmpeg} -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -shortest "${outputPath}"`;

    exec(cmd, (error, _stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return res.status(500).json({ error: "FFmpeg error", details: stderr });
      }
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const read = fs.createReadStream(outputPath);
      read.pipe(res);
      res.on("finish", () => fs.rmSync(tmpDir, { recursive: true, force: true }));
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`FFmpeg API listening on ${port}`));
