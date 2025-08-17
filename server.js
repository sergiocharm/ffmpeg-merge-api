import express from "express";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json({ limit: "100mb" }));

const PORT = process.env.PORT || 3000;

// Список видео
const videoList = [
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

// Рандомный выбор видео
function pickVideos(targetDuration, count = 5) {
  const pool = [...videoList];
  const picked = [];

  while (picked.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return picked;
}

app.post("/merge", async (req, res) => {
  try {
    const { audioUrl } = req.body;
    if (!audioUrl) return res.status(400).json({ error: "audioUrl обязателен" });

    fs.mkdirSync("/tmp/uploads", { recursive: true });

    const audioFile = path.join("/tmp/uploads", `${uuidv4()}.mp3`);
    const listFile = path.join("/tmp/uploads", `${uuidv4()}.txt`);
    const tempConcat = path.join("/tmp/uploads", `${uuidv4()}_video.mp4`);
    const finalFile = path.join("/tmp/uploads", `${uuidv4()}_final.mp4`);

    // 1. Скачиваем аудио
    await new Promise((resolve, reject) => {
      exec(`curl -s -L "${audioUrl}" -o ${audioFile}`, (err) => {
        if (err) reject("Не удалось скачать аудио");
        else resolve();
      });
    });

    // 2. Узнаем длительность аудио
    const audioDuration = await new Promise((resolve, reject) => {
      exec(`ffprobe -i ${audioFile} -show_entries format=duration -v quiet -of csv="p=0"`, (err, stdout) => {
        if (err) reject("ffprobe ошибка");
        else resolve(Math.ceil(parseFloat(stdout)));
      });
    });

    // 3. Подбираем видео (рандом 5 роликов)
    const selectedVideos = pickVideos(audioDuration);
    const downloadedVideos = [];

    // 4. Скачиваем выбранные видео
    for (const url of selectedVideos) {
      const filePath = path.join("/tmp/uploads", `${uuidv4()}.mp4`);
      await new Promise((resolve, reject) => {
        exec(`curl -s -L "${url}" -o ${filePath}`, (err) => {
          if (err) reject(`Не удалось скачать видео ${url}`);
          else resolve();
        });
      });
      downloadedVideos.push(filePath);
    }

    // 5. Создаём список для ffmpeg concat
    fs.writeFileSync(listFile, downloadedVideos.map(f => `file '${f}'`).join("\n"));

    // 6. Склеиваем видео
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -y -f concat -safe 0 -i ${listFile} -c copy ${tempConcat}`, (err) => {
        if (err) reject("Ошибка concat видео");
        else resolve();
      });
    });

    // 7. Накладываем аудио
    await new Promise((resolve, reject) => {
      exec(`ffmpeg -y -i ${tempConcat} -i ${audioFile} -c:v copy -c:a aac -shortest ${finalFile}`, (err) => {
        if (err) reject("Ошибка финального рендера");
        else resolve();
      });
    });

    res.download(finalFile, "video_with_audio.mp4");

  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
