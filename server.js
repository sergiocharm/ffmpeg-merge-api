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
  return String(text)
    .replace(/\\/g, '\\\\\\\\')   // обратные слэши
    .replace(/'/g, "\\\\'")       // одинарные кавычки
    .replace(/:/g, '\\:')         // двоеточия
    .replace(/,/g, '\\,');        // запятые
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
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) {
      console.error(`Не удалось удалить ${file}:`, e.message);
    }
  });
}

app.post("/merge", async (req, res) => {
  const startTime = Date.now();
  let videoFile, finalFile;

  try {
    const { text1, text2, videoUrl } = req.body || {};
    if (!text1 || !text2) {
      return res.status(400).json({ error: "text1 и text2 обязательны" });
    }

    console.log(`[${new Date().toISOString()}] Новый запрос: text1="${text1}", text2="${text2}"`);

    const tmpDir = "/tmp/uploads";
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const chosenUrl = videoUrl || getNextVideo();
    videoFile = path.join(tmpDir, `${uuidv4()}.mp4`);
    finalFile = path.join(tmpDir, `${uuidv4()}_final.mp4`);

    console.log(`[${Date.now() - startTime}ms] Скачивание: ${chosenUrl}`);

    // 1) Скачиваем видео (таймаут curl 30с)
    await execPromise(`curl -s -L --max-time 30 "${chosenUrl}" -o "${videoFile}"`);
    if (!fs.existsSync(videoFile) || fs.statSync(videoFile).size === 0) {
      throw new Error("Файл не скачался");
    }
    console.log(`[${Date.now() - startTime}ms] Скачано: ${fs.statSync(videoFile).size} bytes`);

    // 2) Проверяем шрифт Montserrat
    const fontPath = path.resolve("", "Montserrat-Regular.ttf");
    if (!fs.existsSync(fontPath)) {
      return res.status(500).json({ error: "Нет шрифта fonts/Montserrat-Regular.ttf" });
    }

    // 3) Экранируем тексты
    const safeText1 = escapeText(text1);
    const safeText2 = escapeText(text2);

    // 4) Продвинутый filter_complex: размытие области + полупрозрачный бокс + тексты
    // Геометрия:
    //   - панель шириной 90% кадра, высотой 160px, отступ сверху 80px;
    //   - Text1 белый сразу; Text2 жёлтый с 3-й секунды;
    //   - аудио копируем из источника; на всякий случай ограничиваем длительность -t 10.
    const filter = [
      "[0:v]trim=0:10,setsar=1,format=yuv420p,split=2[base][b];",
      "[b]boxblur=luma_radius=20:luma_power=1[bblur];",
      "[bblur]crop=w=iw*0.9:h=160:x=iw*0.05:y=80[panel];",
      "[base][panel]overlay=x=(W-w)/2:y=80[o1];",
      "[o1]drawbox=x=(w*0.05):y=80:w=(w*0.9):h=160:color=black@0.45:t=fill[o2];",
      `[o2]drawtext=fontfile='${fontPath}':text='${safeText1}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=100:enable='between(t,0,10)'[t1];`,
      `[t1]drawtext=fontfile='${fontPath}':text='${safeText2}':fontcolor=yellow:fontsize=38:x=(w-text_w)/2:y=145:enable='between(t,3,10)'[vout]`
    ].join(" ");

    const ffmpegCmd = `ffmpeg -y -t 10 -i "${videoFile}" -filter_complex "${filter}" ` +
                      `-map "[vout]" -map 0:a? -c:v libx264 -crf 18 -preset veryfast -c:a copy -shortest -movflags +faststart "${finalFile}"`;

    console.log(`[${Date.now() - startTime}ms] Запуск ffmpeg...`);
    const { stderr } = await execPromise(ffmpegCmd, {
      maxBuffer: 20 * 1024 * 1024,
      timeout: 60000
    });

    if (!fs.existsSync(finalFile) || fs.statSync(finalFile).size === 0) {
      console.error("ffmpeg stderr:", stderr);
      throw new Error("ffmpeg не создал выходной файл");
    }

    console.log(`[${Date.now() - startTime}ms] Готово: ${fs.statSync(finalFile).size} bytes`);

    // 5) Отдаём файл
    res.download(finalFile, "video_with_text.mp4", (err) => {
      if (err) console.error("Ошибка отправки:", err);
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
