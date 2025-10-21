import express from "express";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

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

// Проверка ffmpeg/ffprobe
function checkFFmpeg() {
  return new Promise((resolve, reject) => {
    exec("ffmpeg -version", (err) => {
      if (err) return reject("ffmpeg не найден");
      exec("ffprobe -version", (err2) => {
        if (err2) return reject("ffprobe не найден");
        resolve();
      });
    });
  });
}

// Экранирование текста для ffmpeg
function escapeText(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,');
}

// Получить следующее видео (циклично)
function getNextVideo() {
  const video = videoList[currentVideoIndex];
  currentVideoIndex = (currentVideoIndex + 1) % videoList.length;
  return video;
}

app.post("/merge", async (req, res) => {
  try {
    const { text1, text2 } = req.body;
    
    if (!text1 || !text2) {
      return res.status(400).json({ error: "text1 и text2 обязательны" });
    }

    fs.mkdirSync("/tmp/uploads", { recursive: true });

    const videoUrl = getNextVideo();
    const videoFile = path.join("/tmp/uploads", `${uuidv4()}.mp4`);
    const finalFile = path.join("/tmp/uploads", `${uuidv4()}_final.mp4`);

    console.log(`Выбрано видео: ${videoUrl}`);

    // 1. Скачиваем видео
    await new Promise((resolve, reject) => {
      exec(`curl -s -L "${videoUrl}" -o ${videoFile}`, (err) => {
        if (err) reject("Не удалось скачать видео");
        else resolve();
      });
    });

    // 2. Экранируем тексты
    const safeText1 = escapeText(text1);
    const safeText2 = escapeText(text2);

    // 3. Создаём фильтр для текстов
    // text1: белый на размытом чёрном фоне, сверху, с начала видео
    // text2: жёлтый, под text1, появляется с 3-й секунды
    const fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"; // Montserrat может не быть, используем DejaVu как fallback
    
    const filterComplex = `
[0:v]trim=duration=10,setpts=PTS-STARTPTS[trimmed];
[trimmed]drawtext=text='${safeText1}':fontfile=${fontPath}:fontsize=38:fontcolor=white:
box=1:boxcolor=black@0.6:boxborderw=15:
x=(w-text_w)/2:y=80:
enable='between(t,0,10)'[text1];
[text1]drawtext=text='${safeText2}':fontfile=${fontPath}:fontsize=38:fontcolor=yellow:
x=(w-text_w)/2:y=140:
enable='between(t,3,10)'[output]
`.replace(/\n/g, '');

    // 4. Применяем обрезку до 10 сек и накладываем текст
    await new Promise((resolve, reject) => {
      const cmd = `ffmpeg -y -i ${videoFile} -filter_complex "${filterComplex}" -map "[output]" -map 0:a? -t 10 -c:a copy ${finalFile}`;
      
      console.log("Команда ffmpeg:", cmd);
      
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          console.error("Ошибка ffmpeg:", stderr);
          reject("Ошибка наложения текста");
        } else {
          resolve();
        }
      });
    });

    // 5. Отправляем результат
    res.download(finalFile, "video_with_text.mp4", (err) => {
      // Очистка временных файлов
      try {
        fs.unlinkSync(videoFile);
        fs.unlinkSync(finalFile);
      } catch (e) {
        console.error("Ошибка удаления файлов:", e);
      }
    });

  } catch (e) {
    console.error("Ошибка обработки:", e);
    res.status(500).json({ error: e.toString() });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "OK", 
    videosTotal: videoList.length,
    currentIndex: currentVideoIndex 
  });
});

// Старт сервера после проверки ffmpeg
checkFFmpeg()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📹 Loaded ${videoList.length} videos`);
    });
  })
  .catch(err => {
    console.error("❌ Ошибка: ", err);
    process.exit(1);
  });
