const express = require("express");
const os = require("os");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const crypto = require("crypto");
const { exec } = require("child_process");
const admin = require("firebase-admin");

const router = express.Router();

const db = admin.database();

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

// 장치 토큰 요청 함수
async function getDeviceToken(deviceIp, username, password) {
  const url = `https://${deviceIp}/restv1/token`;

  const caCert = fs.readFileSync("ca-cert.pem");
  const agent = new https.Agent({
    ca: caCert,
    rejectUnauthorized: false,
  });

  try {
    await axios.post(
      url,
      {},
      { headers: { "Content-Type": "application/json" }, httpsAgent: agent }
    );
  } catch (error) {
    const authHeader = error.response?.headers["www-authenticate"];
    if (!authHeader) {
      console.error(`❌ [${deviceIp}] 'www-authenticate' 헤더가 없습니다.`);
      return null;
    }

    const digestInfo = extractDigestInfo(authHeader);
    const uri = new URL(url).pathname;

    try {
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
            "Content-Type": "application/json",
            Authorization: authHeaderValue,
          },
          httpsAgent: agent,
        }
      );

      return authResponse.data; // 토큰 데이터 반환
    } catch (err) {
      console.error(`❌ [${deviceIp}] 인증 오류:`, err.message);
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
    }

    console.log("데이터 저장 성공");
  } catch (error) {
    console.error("데이터 저장 중 오류 발생:", error);
  }
}

// 15초마다 장치 요청 함수
function startDevicePolling(devices, username, password) {
  devices.forEach(({ ip, tokenData }) => {
    const accessToken = tokenData.data.accessToken;
    if (!accessToken) {
      console.error(`❌ [${ip}] accessToken이 없습니다.`);
      return;
    }

    const agent = new https.Agent({ rejectUnauthorized: false });

    setInterval(async () => {
      const url = `https://${ip}/restv1/device/wts`;
      const uri = new URL(url).pathname;

      try {
        await axios.get(url, { httpsAgent: agent }); // 인증 헤더 요청
      } catch (error) {
        const authHeader = error.response?.headers["www-authenticate"];
        if (!authHeader) {
          console.error(`❌ [${ip}] 'www-authenticate' 헤더 없음.`);
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

          console.log(`✅ [${ip}] 응답:`, authResponse.data);

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
          console.error(`❌ [${ip}] 요청 오류:`, err.message);
        }
      }
    }, 15000);
  });
}

// 네트워크 스캔 API
router.get("/scan", async (req, res) => {
  const { username = "admin", password = "13579Qwert!" } = req.query;
  try {
    const devices = await scanNetwork(username, password);
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
