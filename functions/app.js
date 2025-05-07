const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { swaggerDocument } = require("./config/swagger");
const admin = require("firebase-admin");

require("dotenv").config();

const serviceAccount = {
  projectId: process.env.GOOGLE_PROJECT_ID,
  privateKey: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
};
// Firebase 초기화
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://electrical-safety-4c9bd-default-rtdb.firebaseio.com",
  storageBucket: "electrical-safety-4c9bd.firebasestorage.app", // Firebase Storage 버킷 추가
});

const app = express();
app.use(cors());
app.use(express.json());

// 📌 Swagger UI 설정 ("/docs" 경로에서 문서 확인 가능)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const { upload, uploadImageToFirebase } = require("./routes/util");

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
    }

    const imageUrl = await uploadImageToFirebase(req.file);

    console.log("이미지 url : ", imageUrl);
    res.status(200).json({ url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let tempData = {
  daily: {}, // 날짜별 임시 저장
  monthly: {}, // 월별 임시 저장
  yearly: {}, // 연도별 임시 저장
};

// 일정 시간 간격으로 평균값을 계산하도록 설정
const calculateAverages = async () => {
  console.log("📊 평균 계산 시작");

  const nowUTC = new Date();

  // 한국 시간 기준 포맷터
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const nowString = formatter.format(nowUTC).replace("T", " ").replace(",", "");
  const minuteAgo = new Date(nowUTC.getTime() - 60 * 1000);
  const minuteAgoString = formatter
    .format(minuteAgo)
    .replace("T", " ")
    .replace(",", "");

  console.log("✅ now (KST):", nowString);
  console.log("✅ 1분 전 (KST):", minuteAgoString);

  const sensorsSnapshot = await admin.database().ref("sensors").once("value");
  const sensorIds = Object.keys(sensorsSnapshot.val() || {});
  const allData = [];

  // 1분 내 데이터 수집
  for (const sensorId of sensorIds) {
    const snapshot = await admin
      .database()
      .ref(`temperature/${sensorId}`)
      .orderByChild("updateTime")
      .startAt(minuteAgoString)
      .endAt(nowString)
      .once("value");

    if (snapshot.exists()) {
      allData.push(...Object.values(snapshot.val()));
    }
  }

  console.log(allData);

  if (allData.length === 0) {
    console.log("📭 수집된 데이터 없음");
    return;
  }

  // groupBy 기준 생성
  const groupedByDayHour = {}; // dailyAverage
  const groupedByMonthWeek = {}; // monthlyAverage
  const groupedByYearMonth = {}; // yearlyAverage

  for (const entry of allData) {
    const { tempVal, updateTime } = entry;
    const [date, time] = updateTime.split(" "); // "YYYY-MM-DD", "HH:mm:ss"

    const [year, month, day] = date.split("-");
    const hour = parseInt(time.slice(0, 2), 10);
    const threeHourSlot = Math.floor(hour / 3) * 3; // ✅ 반올림 ❌ → 내림 ⭕

    const hourKey = String(threeHourSlot).padStart(2, "0");
    // const hourRange = `${String(threeHourSlot).padStart(2, "0")}-${String(
    //   threeHourSlot + 2
    // ).padStart(2, "0")}`;

    const weekKey = getWeekOfMonth(new Date(updateTime)); // 'W1' ~ 'W5'

    const dailyKey = `${date}/${hourKey}`; // → 예: 2025-05-07/12
    const monthlyKey = `${year}-${month}/${weekKey}`; // monthlyAverage/2025-05/W2
    const yearlyKey = `${year}/${month}`; // yearlyAverage/2025/05

    if (!groupedByDayHour[dailyKey]) groupedByDayHour[dailyKey] = [];
    if (!groupedByMonthWeek[monthlyKey]) groupedByMonthWeek[monthlyKey] = [];
    if (!groupedByYearMonth[yearlyKey]) groupedByYearMonth[yearlyKey] = [];

    groupedByDayHour[dailyKey].push(tempVal);
    groupedByMonthWeek[monthlyKey].push(tempVal);
    groupedByYearMonth[yearlyKey].push(tempVal);
  }

  const saveAverages = async (pathPrefix, dataMap) => {
    for (const key in dataMap) {
      const values = dataMap[key];
      const total = values.reduce((sum, v) => sum + v, 0);
      const count = values.length;

      // ✅ Firebase에서 기존 누적값 불러오기
      const existingSnapshot = await admin
        .database()
        .ref(`${pathPrefix}/${key}`)
        .once("value");
      const existing = existingSnapshot.val() || {
        total: 0,
        count: 0,
        average: 0,
      };

      const newTotal = existing.total + total;
      const newCount = existing.count + count;
      const newAverage = newTotal / newCount;

      // ✅ DB에 누적값 저장
      await admin.database().ref(`${pathPrefix}/${key}`).set({
        total: newTotal,
        count: newCount,
        average: newAverage,
      });

      console.log(
        `✅ [${pathPrefix}/${key}] avg=${newAverage}, count=${newCount}`
      );
    }
  };

  // 평균 계산 본문에서 누적 저장 함수 호출 방식 수정
  await saveAverages("dailyAverage", groupedByDayHour, tempData.daily);
  await saveAverages("monthlyAverage", groupedByMonthWeek, tempData.monthly);
  await saveAverages("yearlyAverage", groupedByYearMonth, tempData.yearly);
};

// 주차 계산 함수 (W1 ~ W5)
function getWeekOfMonth(date) {
  const day = date.getDate();
  const week = Math.ceil(day / 7);
  return `W${week}`;
}

// 📌 라우터 설정
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/post");
const deviceRoutes = require("./routes/device");
const complexRoutes = require("./routes/complex");
const tempRoutes = require("./routes/temp");
const eventRoutes = require("./routes/event");
const cameraRoutes = require("./routes/camera");
const sensorRoutes = require("./routes/sensor");

app.use("/device", deviceRoutes);
app.use("/", postRoutes);
app.use("/auth", authRoutes);
app.use("/", complexRoutes);
app.use("/temp", tempRoutes);
app.use("/", eventRoutes);
app.use("/camera", cameraRoutes);
app.use("/sensor", sensorRoutes);

setInterval(calculateAverages, 60 * 1000); // 1분마다 계산

// temp

// const PORT = process.env.PORT || 8080;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
//   // 일정 시간마다 평균값을 계산하도록 주기적으로 실행
//   setInterval(calculateAverages, 60 * 1000); // 1분마다 계산
// });

// https 서버 실행
// const port = 443; // https 포트
// https.createServer(options, app).listen(port, "localhost", () => {
//   console.log(`https 서버가 https://localhost:${port}에서 실행 중입니다.`);
// });
module.exports = app;
