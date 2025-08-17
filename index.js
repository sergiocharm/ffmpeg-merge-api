import express from "express";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json({ limit: "100mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 📌 Твой список видео (сюда вставишь свои ссылки)
const VIDEO_POOL = [
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_daily-oral-care-mouthwash-and-toothbrushes-on-the-counter_58828799_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_confident-woman-joyfully-signing-papers-after-purchasing-her_66853137_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_beautiful-young-girl-sitting-on-a-chair-on-the-balcony-and_51429689_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_attractive-brunette-woman-eating-chocolate-before-massage-in_54830216_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_pretty-woman-in-white-bathrobe-relaxing-in-hotel-room-in_48646805_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_young-woman-in-yellow-shirt-enjoys-nature-while-checking-her_69118651_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_beautiful-woman-stands-in-front-of-mirror-after-face-wash_51897032_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_girl-dressed-in-white-fixes-her-hair-against-the-background_35301547_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_pretty-woman-in-white-bathrobe-relaxing-in-hotel-room-in_48646799_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_woman-finger-wish_59601982_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_a-woman-painting-in-art-class_13289092_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_woman-practicing-yoga-in-the-nature_13289151_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_close-up-of-female-hands-peels-boiled-egg-peeling-eggs-from_57823527_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_radiant-woman-using-towel-to-wipe-face-after-wash-skincare_51897023_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_close-up-of-a-young-woman-weighing-herself-on-a-scale-at_47851351_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_caucasian-female-lawyer-public-defender-writes-down_58737807_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_female-hand-touching-pink-tulips-heads-in-blooming-flower_55813297_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_phone-wet-hair-bed-loneliness-young-woman-using-smart-phone_60331662_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_joyful-young-woman-excitedly-making-an-online-purchase-with_66853146_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_pretty-woman-in-white-bathrobe-relaxing-in-hotel-room-in_48646798_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_skincare-routine-woman-cleansing-her-face-with-cleanser-in_51897031_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_young-woman-chooses-tries-natural-organic-essential-oils_53326216_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_pouring-tea-and-dried-oranges-into-a-glass_48021784_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_vertical-video-with-long-black-fragrant-reeds-one-at-a-time_26790402_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_window-cleaning-brush-making-glass-clean-house-worker_55603640_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_young-woman-puts-on-headband-in-mirror-before-evening_51897039_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_female-hands-making-chocolate-chip-cookies-raw-dough-bowls_57635450_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_woman-uses-gua-sha-for-facial-wrinkle-removal-in-front-of_51897041_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_elegant-female-legs-under-the-shower-streams-water-gently_51787939_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_a-young-woman-outdoors-in-a-modern-city-setting-young-woman_60330745_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_warming-patch-on-the-sciatic-nerve-heating-patch-sciatic_60331384_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_sifting-vibrant-green-matcha-powder-through-a-fine-mesh_68769364_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_beautiful-female-hands-female-hands-applying-cream-or_67703217_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_female-hand-pounding-spices_55029032_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_woman-jogging-on-the-street_16027179_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_lgbt-free-love-girlfriends-walk-in-the-city-park-stylish_55813054_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_woman-walking-on-the-night_56912743_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_cut-tomatoes-male-hand-cutting-the-tomatoes-counter_56946985_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_close-up-of-the-process-of-caring-for-the-nails-of-the-toes_60331890_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_businessman-hands-typing-on-laptop-computer-keyboard-close_49071239_compressed.mp4",
"https://1ogorod.ru/wp-content/uploads/2025/08/vecteezy_a-young-caucasian-woman-lies-down-on-the-couch-at-the_69229841_compressed.mp4"
];

// Функция скачивания файла
async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка скачивания ${url}`);
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

// Получаем длительность файла (в секундах)
function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

// Делаем рандомный выбор видео до нужной длительности
async function pickRandomVideos(minDuration) {
  let total = 0;
  let selected = [];

  while (total < minDuration) {
    const randomUrl = VIDEO_POOL[Math.floor(Math.random() * VIDEO_POOL.length)];
    const tempPath = path.resolve("uploads", `${uuidv4()}_temp.mp4`);
    await downloadFile(randomUrl, tempPath);
    const dur = await getDuration(tempPath);
    total += dur;
    selected.push(tempPath);
  }

  return selected;
}

// Преобразуем транскрипт OpenAI в SRT
function createSRT(transcript) {
  const lines = transcript.split("\n").filter(l => l.trim());
  let srt = "";
  let startTime = 0;
  const durationPerLine = 3;

  lines.forEach((line, i) => {
    const endTime = startTime + durationPerLine;
    const formatTime = t => {
      const h = String(Math.floor(t / 3600)).padStart(2, "0");
      const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
      const s = String(Math.floor(t % 60)).padStart(2, "0");
      const ms = "000";
      return `${h}:${m}:${s},${ms}`;
    };
    srt += `${i + 1}\n${formatTime(startTime)} --> ${formatTime(endTime)}\n${line}\n\n`;
    startTime = endTime;
  });

  return srt;
}

app.post("/merge", async (req, res) => {
  try {
    const { audioUrl } = req.body;
    if (!audioUrl) return res.status(400).send("Нужно указать audioUrl");

    fs.mkdirSync("uploads", { recursive: true });

    const audioPath = path.resolve("uploads", `${uuidv4()}_audio.mp3`);
    const finalVideoPath = path.resolve("uploads", `${uuidv4()}_final.mp4`);
    const concatListPath = path.resolve("uploads", `${uuidv4()}_list.txt`);
    const srtPath = path.resolve("uploads", `${uuidv4()}_subtitles.srt`);

    console.log("⬇️ Скачиваем аудио...");
    await downloadFile(audioUrl, audioPath);

    const audioDuration = await getDuration(audioPath);
    console.log("🎵 Длительность аудио:", audioDuration);

    console.log("🎥 Подбираем видео...");
    const videos = await pickRandomVideos(audioDuration + 5);

    console.log("🔗 Объединяем видео...");
    const listFile = videos.map(v => `file '${v}'`).join("\n");
    fs.writeFileSync(concatListPath, listFile);

    const mergedVideoPath = path.resolve("uploads", `${uuidv4()}_merged.mp4`);
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .outputOptions("-c copy")
        .save(mergedVideoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("⏳ Транскрибируем аудио...");
    const transcriptionResult = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "gpt-4o-mini-transcribe"
    });

    const srtContent = createSRT(transcriptionResult.text);
    fs.writeFileSync(srtPath, srtContent, "utf8");

    console.log("🎬 Объединяем финально: видео+аудио+субтитры...");
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(mergedVideoPath)
        .input(audioPath)
        .outputOptions(
          "-map 0:v:0",
          "-map 1:a:0",
          "-c:v libx264",
          "-c:a aac",
          "-shortest",
          `-vf subtitles=${srtPath}:force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFF&,OutlineColour=&H000000&,BorderStyle=1'`
        )
        .save(finalVideoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    console.log("✅ Готово! Отправляем видео.");
    res.download(finalVideoPath, "output_with_subs.mp4");
  } catch (err) {
    console.error("Ошибка:", err);
    res.status(500).send(err.message);
  }
});

app.listen(10000, () => console.log("🚀 Сервер запущен на порту 10000"));
