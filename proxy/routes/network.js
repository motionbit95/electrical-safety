const express = require("express");
const os = require("os");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const crypto = require("crypto");
const { exec } = require("child_process");
const admin = require("firebase-admin");
const { timeStamp } = require("console");

const router = express.Router();

const db = admin.database();

const groupDB = admin.database().ref("groups");
const cameraDB = admin.database().ref("cameras");

// Digest 인증 헤더 생성 함수
function createDigestHeader(username, password, digestInfo, method, uri) {
  const ha1 = crypto
    .createHash("md5")
    .update(`${username}:${digestInfo.realm}:${password}`)
    .digest("hex");

  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");

  const cnonce = crypto.randomBytes(16).toString("hex");
  const nc = "00000001"; // nonce count (필요 시 증가 가능)

  const responseHash = crypto
    .createHash("md5")
    .update(
      `${ha1}:${digestInfo.nonce}:${nc}:${cnonce}:${digestInfo.qop}:${ha2}`
    )
    .digest("hex");

  return `Digest username="${username}", realm="${digestInfo.realm}", nonce="${digestInfo.nonce}", uri="${uri}", response="${responseHash}", qop=${digestInfo.qop}, nc=${nc}, cnonce="${cnonce}", opaque="${digestInfo.opaque}"`;
}

// WWW-Authenticate 헤더에서 Digest 정보 추출 함수
function extractDigestInfo(authHeader) {
  const matchNonce = authHeader.match(/nonce="([^"]+)"/);
  const matchRealm = authHeader.match(/realm="([^"]+)"/);
  const matchQop = authHeader.match(/qop="([^"]+)"/);
  const matchOpaque = authHeader.match(/opaque="([^"]+)"/);

  return {
    nonce: matchNonce ? matchNonce[1] : null,
    realm: matchRealm ? matchRealm[1] : null,
    qop: matchQop ? matchQop[1] : "auth",
    opaque: matchOpaque ? matchOpaque[1] : null,
  };
}

// 사설 IP 확인
function isPrivateIp(ip) {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    (ip.startsWith("172.") &&
      (() => {
        const second = parseInt(ip.split(".")[1], 10);
        return second >= 16 && second <= 31;
      })())
  );
}

// Digest 인증 토큰 요청
async function getDeviceToken(deviceIp, username, password) {
  const isPrivate = isPrivateIp(deviceIp);
  const protocol = isPrivate ? "https" : "http";
  const url = `${protocol}://${deviceIp}/restv1/token`;
  const headers = { "Content-Type": "application/json" };
  const timestamp = () => new Date().toLocaleString();

  // HTTPS Agent 설정 (내부망인 경우에만)
  let httpsAgent = undefined;
  if (isPrivate) {
    const caCert = fs.readFileSync("ca-cert.pem");

    httpsAgent = new https.Agent({
      ca: caCert,
      rejectUnauthorized: false, // 필요 시 true로 변경
    });
  }

  try {
    // 1차 요청으로 Digest 인증 유도 (401 예상)
    await axios.post(url, {}, { headers, httpsAgent, timeout: 5000 });

    console.error(`[${timestamp()}] [${deviceIp}] ❌ 예기치 않은 200 OK`);
    return null;
  } catch (error) {
    const authHeader = error.response?.headers?.["www-authenticate"];
    const errMsg = error.message || "알 수 없는 오류";

    if (!authHeader) {
      console.error(`[${timestamp()}] [${deviceIp}] ❌ 인증 헤더 없음`);
      console.error(`[${deviceIp}] 상세 오류: ${errMsg}`);
      return null;
    }

    try {
      const digestInfo = extractDigestInfo(authHeader);
      const uri = new URL(url).pathname;

      const authHeaderValue = createDigestHeader(
        username,
        password,
        digestInfo,
        "POST",
        uri
      );

      const authResponse = await axios.post(
        url,
        {},
        {
          headers: {
            ...headers,
            Authorization: authHeaderValue,
          },
          httpsAgent,
          timeout: 5000,
        }
      );

      console.log(`[${timestamp()}] ✅ 토큰 획득 성공 [${deviceIp}] `);
      return authResponse.data;
    } catch (authErr) {
      console.error(
        `[${timestamp()}] ❌ [${deviceIp}] Digest 인증 실패: ${authErr.message}`
      );
      return null;
    }
  }
}

// 네트워크 스캔 함수 (토큰이 있는 장치만 반환)
async function scanNetwork(username, password) {
  return new Promise((resolve, reject) => {
    exec("arp -a | grep -v '(incomplete)'", async (error, stdout, stderr) => {
      if (error) return reject(`Error: ${error.message}`);
      if (stderr) return reject(`stderr: ${stderr}`);

      const ipPattern = /\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/g;
      const devices = [];
      const pingPromises = [];

      let match;
      while ((match = ipPattern.exec(stdout)) !== null) {
        const ip = match[1];

        pingPromises.push(
          getDeviceToken(ip, username, password)
            .then((tokenData) => {
              if (tokenData) devices.push({ ip, tokenData });
            })
            .catch((err) =>
              console.error(`❌ [${ip}] 토큰 확인 오류:`, err.message)
            )
        );
      }

      await Promise.all(pingPromises);
      resolve(devices);
    });
  });
}

// Firebase Realtime Database에서 토큰이 존재하는 카메라만 필터링
async function scanCameras(username, password) {
    const timestamp = () => new Date().toLocaleString();

  console.log(`[${timestamp()}] ✅ 카메라 스캔 시작`);

  const cameraRef = db.ref("cameras");

  return new Promise((resolve, reject) => {
    cameraRef.once(
      "value",
      async (snapshot) => {
        const data = snapshot.val();
        const cameras = [];
        const pingPromises = [];

        if (data) {
          Object.entries(data).forEach(([key, camera]) => {
            const { imageUrl, ip, name } = camera;

            pingPromises.push(
              getDeviceToken(ip, username, password)
                .then((tokenData) => {
                  if (tokenData) {
                    cameras.push({ imageUrl, ip, name, tokenData });
                  }
                })
                .catch((err) => {
                  console.error(`❌ [${ip}] 토큰 확인 오류:`, err.message);
                })
            );
          });
        }

        await Promise.all(pingPromises);
        resolve(cameras);
      },
      (error) => {
        console.error("카메라 스캔 실패:", error);
        reject(error);
      }
    );
  });
}

async function saveTemperatureData(temperatureData) {
  try {
    const tempRef = db.ref("temperature");

    for (const entry of temperatureData.data) {
      const { devAddr, tempVal, updateTime } = entry;
      const deviceRef = tempRef.child(devAddr);

      await deviceRef.push({
        devAddr: devAddr,
        tempVal: tempVal,
        updateTime: updateTime,
      });

      saveEvent(devAddr, tempVal);
    }

    // console.log("데이터 저장 성공");
  } catch (error) {
    console.error("데이터 저장 중 오류 발생:", error);
  }
}

// 이벤트 기록 함수
async function saveEvent(devAddr, tempVal) {
  try {
    const deviceRef = db.ref(`sensors/${devAddr}`);
    const snapshot = await deviceRef.once("value");

    const deviceData = snapshot.val();

    const timestamp = () => new Date().toLocaleString();

    if (!deviceData || !deviceData.groupId) {
      //console.warn(`[${timestamp()}] ❌ [${devAddr}] 센서 정보 불러오기 실패`);
      return;
    }

    const groupDB = db.ref(`groups`);
    const groupSnap = await groupDB.child(deviceData.groupId).once("value");

    if (!groupSnap.exists()) {
      console.warn(`[${timestamp()}] ❌ 그룹 데이터 없음 (groupId: ${deviceData.groupId})`);
      return;
    }

    if (!groupSnap.val().temp) {
      console.log(`[${timestamp()}] ❌ 그룹 데이터에 최고 온도가 없음`);
      return;
    }

    if (parseFloat(groupSnap.val().temp) < parseFloat(tempVal)) {
      // 이벤트 기록
      const eventRef = db.ref("event");
      await eventRef.push({
        devAddr,
        tempVal,
        groupId: deviceData.groupId,
        timestamp: new Date().toISOString(),
      });

      // console.log({
      //   devAddr,
      //   tempVal,
      //   groupId: deviceData.groupId,
      //   timestamp: new Date().toISOString(),
      // });
      console.log(`[${timestamp()}] ❌ [${devAddr}] 위험 온도 : ${tempVal}`);
      return;
    } else {
      console.log(`[${timestamp()}] ✅ [${devAddr}] 정상 온도 : ${tempVal}`);
      return;
    }
  } catch (error) {
    console.error("이벤트 기록 중 오류 발생:", error);
  }
}

// 15초마다 장치 요청 함수
function startDevicePolling(devices, username, password) {
  const timestamp = () => new Date().toLocaleString();
  
  devices.forEach(({ ip, tokenData }) => {
    const accessToken = tokenData.data.accessToken;
    if (!accessToken) {
      console.error(`[${timestamp()}] ❌ [${ip}] accessToken이 없습니다.`);
      return;
    }

    const agent = new https.Agent({ rejectUnauthorized: false });

    setInterval(async () => {
      const isPrivate = isPrivateIp(ip);
      const protocol = isPrivate ? "https" : "http";
      const url = `${protocol}://${ip}/restv1/device/wts`;
      const uri = new URL(url).pathname;

      try {
        await axios.get(url, { httpsAgent: agent }); // 인증 헤더 요청
      } catch (error) {
        const authHeader = error.response?.headers["www-authenticate"];
        if (!authHeader) {
          console.error(`[${timestamp()}] [${ip}] 'www-authenticate' 헤더 없음.`);
          return;
        }

        const digestInfo = extractDigestInfo(authHeader);

        try {
          const authHeaderValue = createDigestHeader(
            username,
            password,
            digestInfo,
            "GET",
            uri
          );

          const authResponse = await axios.get(url, {
            headers: {
              Authorization: authHeaderValue,
              accessToken: accessToken,
            },
            httpsAgent: agent,
          });

          // console.log(`✅ [${ip}] 응답:`, authResponse.data);

          const updateTime = new Date();
          const formattedTime =
            updateTime.getFullYear() +
            "-" +
            String(updateTime.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(updateTime.getDate()).padStart(2, "0") +
            " " +
            String(updateTime.getHours()).padStart(2, "0") +
            ":" +
            String(updateTime.getMinutes()).padStart(2, "0") +
            ":" +
            String(updateTime.getSeconds()).padStart(2, "0");

          saveTemperatureData(authResponse.data);
        } catch (err) {
          console.error(`[${timestamp()}] ❌ [${ip}] 요청 오류:`, err.message);
        }
      }
    }, 15000);
  });
}

// 네트워크 스캔 API
router.get("/scan", async (req, res) => {
  const { username = "admin", password = "13579Qwert!" } = req.query;
  try {
    const devices = await scanCameras(username, password);
    startDevicePolling(devices, username, password);

    res.status(200).json({
      message: "✅ 네트워크 스캔 완료 (토큰 있는 장치만 포함)",
      devices,
    });
  } catch (error) {
    res.status(500).json({
      message: "❌ 네트워크 스캔 오류",
      error,
    });
  }
});

module.exports = router;
