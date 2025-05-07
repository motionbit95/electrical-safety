const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const https = require("https");
const fs = require("fs");
const axios = require("axios");

require("dotenv").config();

// 인증서와 개인 키 경로
const options = {
  key: fs.readFileSync("private-key.pem"),
  cert: fs.readFileSync("certificate.pem"),
  passphrase: "1q2w3e4r", // 위에서 설정한 비밀번호
};

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

const networkRouter = require("./routes/network");

app.use("/network", networkRouter);

let devices = []; // 토큰이 있는 장치 목록 저장

// 네트워크 스캔 API를 호출하고 장치 목록 업데이트
const updateDeviceList = async () => {
  try {
    const agent = new https.Agent({
      rejectUnauthorized: false, // 인증서 검증 비활성화
    });

    const response = await axios.get("https://localhost:443/network/scan", {
      httpsAgent: agent,
    });
    devices = response.data.devices;

    const timestamp = () => new Date().toLocaleString();

    console.log(
      `[${timestamp()}] ✅ 장치 목록 업데이트 - 총 ${devices.length}건`
    );
  } catch (error) {
    const timestamp = () => new Date().toLocaleString();
    console.error(
      `[${timestamp()}] ❌ 장치 스캔 API 호출 중 오류 발생: `,
      error.response.data.message
    );
  }
};

// const PORT = process.env.PORT || 8081;

// app.listen(PORT, () => {
//   console.log(`Server is running on port ${PORT}`);
//   updateDeviceList(); // 서버 시작 시 즉시 실행
//   setInterval(updateDeviceList, 5 * 60 * 1000); // 5분마다 실행
// });

// https 서버 실행
const port = 443; // https 포트
https.createServer(options, app).listen(port, "localhost", () => {
  console.log(`https 서버가 https://localhost:${port}에서 실행 중입니다.`);
  updateDeviceList(); // 서버 시작 시 즉시 실행
  setInterval(updateDeviceList, 5 * 60 * 1000); // 5분마다 실행
});
module.exports = app;
