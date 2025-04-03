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

// const PORT = process.env.PORT || 8080;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
// });

// https 서버 실행
// const port = 443; // https 포트
// https.createServer(options, app).listen(port, "localhost", () => {
//   console.log(`https 서버가 https://localhost:${port}에서 실행 중입니다.`);
// });
module.exports = app;
