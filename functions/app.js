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
});

const app = express();
app.use(cors());
app.use(express.json());

// 📌 Swagger UI 설정 ("/docs" 경로에서 문서 확인 가능)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 📌 라우터 설정
const authRoutes = require("./routes/auth");
const postRoutes = require("./routes/post");
const deviceRoutes = require("./routes/device");
const complexRoutes = require("./routes/complex");
const sensorRoutes = require("./routes/sensor");
const eventRoutes = require("./routes/event");

app.use("/device", deviceRoutes);
app.use("/", postRoutes);
app.use("/auth", authRoutes);
app.use("/", complexRoutes);
app.use("/sensor", sensorRoutes);
app.use("/", eventRoutes);

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// https 서버 실행
// const port = 443; // https 포트
// https.createServer(options, app).listen(port, "localhost", () => {
//   console.log(`https 서버가 https://localhost:${port}에서 실행 중입니다.`);
// });
module.exports = app;
