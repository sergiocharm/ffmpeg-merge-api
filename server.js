import express from "express";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Новый список видео
const videoList = [
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_8005.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_8003.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_8002.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7996.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7729.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7727.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7720.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7700.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7699.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7651.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7645.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7567.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7564.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7556.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7545.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7439.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7428.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7423.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7422.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7420.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_7409.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_6324.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_5580.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_img_5206.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_3.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_2.mp4",
  "https://1ogorod.ru/wp-content/uploads/2025/10/final_mute_short_1.mp4"
];

let currentVideoIndex = 0;

// Экранирование текста для ffmpeg
function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,');
}

// Получить следующее видео (циклично)
function getNextVideo() {
  const video = videoList[currentVideoIndex];
  currentVideoIndex = (currentVideoIndex + 1) % videoList.length;
  return video;
}

// Очистка старых файлов
function cleanupFiles(...files) {
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (e) {
      console.error(`Не удалось удалить ${file}:`, e.message);
    }
  });
}

app.post("/merge", async (req, res) => {
  const startTime = Date.now();
  let videoFile, finalFile;

  try {
    const { text1, text2 } = req.body;
    
    if (!text1 || !text2) {
      return res.status(400).json({ error: "text1 и text2 обязательны" });
    }

    console.log(`[${new Date().toISOString()}] Новый запрос: text1="${text1}", text2="${text2}"`);

    const tmpDir = "/tmp/uploads";
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const videoUrl = getNextVideo();
    videoFile = path.join(tmpDir, `${uuidv4()}.mp4`);
    finalFile = path.join(tmpDir, `${uuidv4()}_final.mp4`);

    console.log(`[${Date.now() - startTime}ms] Скачивание: ${videoUrl}`);

    // 1. Скачиваем видео с таймаутом
    await execPromise(`curl -s -L --max-time 30 "${videoUrl}" -o ${videoFile}`);
    
    if (!fs.existsSync(videoFile) || fs.statSync(videoFile).size === 0) {
      throw new Error("Файл не скачался");
    }

    console.log(`[${Date.now() - startTime}ms] Скачано: ${fs.statSync(videoFile).size} bytes`);

    // 2. Экранируем тексты
    const safeText1 = escapeText(text1);
    const safeText2 = escapeText(text2);

    // 3. Упрощённая команда ffmpeg (без сложных фильтров)
    const ffmpegCmd = `ffmpeg -y -i ${videoFile} -t 10 \
-vf "drawtext=text='${safeText1}':fontsize=36:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=12:x=(w-text_w)/2:y=70,\
drawtext=text='${safeText2}':fontsize=36:fontcolor=yellow:x=(w-text_w)/2:y=130:enable='gte(t,3)'" \
-c:a copy -preset ultrafast ${finalFile}`;

    console.log(`[${Date.now() - startTime}ms] Запуск ffmpeg...`);

    // 4. Обработка с таймаутом 50 секунд
    const { stderr } = await execPromise(ffmpegCmd, { 
      maxBuffer: 10 * 1024 * 1024,
      timeout: 50000 
    });

    if (!fs.existsSync(finalFile) || fs.statSync(finalFile).size === 0) {
      console.error("ffmpeg stderr:", stderr);
      throw new Error("ffmpeg не создал выходной файл");
    }

    console.log(`[${Date.now() - startTime}ms] Готово: ${fs.statSync(finalFile).size} bytes`);

    // 5. Отправляем результат
    res.download(finalFile, "video_with_text.mp4", (err) => {
      if (err) {
        console.error("Ошибка отправки:", err);
      }
      console.log(`[${Date.now() - startTime}ms] Отправлено. Очистка...`);
      cleanupFiles(videoFile, finalFile);
    });

  } catch (e) {
    console.error(`[${Date.now() - startTime}ms] ОШИБКА:`, e.message);
    cleanupFiles(videoFile, finalFile);
    
    res.status(500).json({ 
      error: e.message,
      details: e.toString(),
      time: `${Date.now() - startTime}ms`
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    videos: videoList.length,
    current: currentVideoIndex,
    uptime: process.uptime()
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy" });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📹 Videos loaded: ${videoList.length}`);
});
