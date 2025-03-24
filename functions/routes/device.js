const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();
const https = require("https");
const fs = require("fs");

// Firebase Realtime Database의 "devices" 레퍼런스를 가져옴
const deviceDB = admin.database().ref("devices");

// Device 모델 정의 (클래스 방식)
class Device {
  constructor(sensorId, address, xCoord, yCoord) {
    this.sensorId = sensorId; // 센서 ID
    this.address = address; // 주소
    this.xCoord = xCoord; // X좌표
    this.yCoord = yCoord; // Y좌표
    this.createdAt = admin.database.ServerValue.TIMESTAMP; // 생성 시간 (타임스탬프)
  }
}

// 새로운 Device를 생성하는 API 엔드포인트
router.post("/", async (req, res) => {
  const { sensorId, address, xCoord, yCoord } = req.body;

  // 필수 입력값이 누락된 경우 오류 반환
  if (!sensorId || !address || !xCoord || !yCoord) {
    return res.status(400).send("필수 입력값이 누락되었습니다.");
  }

  // Firebase에서 sensorId가 이미 존재하는지 확인
  try {
    const deviceRef = deviceDB.child(sensorId); // sensorId를 키로 하는 레퍼런스 생성
    const snapshot = await deviceRef.once("value"); // 해당 sensorId의 데이터가 존재하는지 조회

    if (snapshot.exists()) {
      // sensorId가 이미 존재하면 오류 반환
      return res.status(400).send("이미 존재하는 센서 ID입니다.");
    }

    // 새로운 Device 객체 생성
    const newDevice = new Device(sensorId, address, xCoord, yCoord);

    // Firebase Realtime Database에 sensorId를 키로 사용하여 새 기기 정보 저장
    await deviceRef.set(newDevice);

    // 기기 등록 성공 응답
    res.status(201).send({
      message: "센서가 성공적으로 등록되었습니다.",
      sensorId: deviceRef.key, // deviceRef.key는 sensorId가 됩니다.
    });
  } catch (error) {
    console.error("센서 등록 중 오류 발생:", error);
    // 서버 내부 오류 발생 시 응답
    res.status(500).send("서버 내부 오류");
  }
});

// 특정 센서 삭제
router.delete("/:sensorId", async (req, res) => {
  const sensorId = req.params.sensorId;

  try {
    const deviceRef = deviceDB.child(sensorId);
    await deviceRef.remove();
    res.status(200).send({ message: "센서가 성공적으로 삭제됨." });
  } catch (error) {
    console.error("센서 삭제 중 오류 발생:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 전체 센서 목록 조회
router.get("/", async (req, res) => {
  try {
    // Firebase Realtime Database에서 모든 센서 정보를 가져오기
    const snapshot = await deviceDB.once("value");

    // 데이터가 없으면 빈 객체 반환
    if (!snapshot.exists()) {
      return res.status(200).send({ message: "등록된 센서가 없습니다." });
    }

    // Firebase 데이터는 객체 형태로 반환되므로 배열로 변환
    const devices = snapshot.val();
    const deviceList = Object.keys(devices).map((key) => ({
      sensorId: key, // sensorId는 Firebase 데이터의 키로 사용됨
      ...devices[key],
    }));

    res.status(200).send({
      message: "센서 목록 조회 성공",
      devices: deviceList,
    });
  } catch (error) {
    console.error("센서 목록 조회 중 오류 발생:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// async function getDeviceToken(deviceIp, username, password) {
//   const url = `https://${deviceIp}/restv1/token`;

//   // HTTPS 인증서 검증 해결: 신뢰할 수 있는 CA 인증서 로드
//   const caCert = fs.readFileSync("ca-cert.pem");
//   const agent = new https.Agent({
//     ca: caCert,
//     rejectUnauthorized: false,
//   });

//   try {
//     // 🔹 서버에서 Digest 인증 관련 정보 요청 (nonce 값 포함)
//     const authResponse = await axios.post(
//       url,
//       {},
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//         httpsAgent: agent, // 인증서 적용
//       }
//     );
//   } catch (error) {
//     // 처음 요청 후 여기로 들어온다.
//     console.error("Error making initial request:", error);
//     let authHeader = error.response.headers["www-authenticate"];
//     if (!authHeader) {
//       console.error("WWW-Authenticate header not found in response");
//       return null;
//     }
//     const digestInfo = extractDigestInfo(authHeader);

//     try {
//       const agent = new https.Agent({ rejectUnauthorized: false }); // 인증서 무시 (테스트 환경)

//       // HA1 계산: username:realm:password
//       const ha1 = crypto
//         .createHash("md5")
//         .update(`${username}:${digestInfo.realm}:${password}`)
//         .digest("hex");

//       // HA2 계산: method:URI (전체 URL이 아니라 경로만)
//       const uri = new URL(url).pathname;
//       const ha2 = crypto.createHash("md5").update(`POST:${uri}`).digest("hex");

//       // cnonce (클라이언트 nonce) 생성
//       const cnonce = crypto.randomBytes(16).toString("hex");

//       // response 해시 계산
//       const response = crypto
//         .createHash("md5")
//         .update(
//           `${ha1}:${digestInfo.nonce}:00000001:${cnonce}:${digestInfo.qop}:${ha2}`
//         )
//         .digest("hex");

//       // Authorization 헤더 생성
//       const authHeaderValue = `Digest username="${username}", realm="${digestInfo.realm}", nonce="${digestInfo.nonce}", uri="${uri}", response="${response}", algorithm=MD5, qop=auth, nc=00000001, cnonce="${cnonce}", opaque="${digestInfo.opaque}"`;

//       // 인증 요청
//       const authResponse = await axios.post(
//         url,
//         {},
//         {
//           headers: {
//             "Content-Type": "application/json",
//             Authorization: authHeaderValue,
//           },
//           httpsAgent: agent, // 인증서 적용
//         }
//       );

//       console.log("인증 성공:", authResponse.data);
//       return authResponse.data;
//     } catch (error) {
//       console.error("인증 중 오류:", error.response?.data || error.message);
//       return null;
//     }
//   }
// }

// // Digest 인증 관련 정보 추출 함수
// function extractDigestInfo(authHeader) {
//   const matchNonce = authHeader.match(/nonce="([^"]+)"/);
//   const matchRealm = authHeader.match(/realm="([^"]+)"/);
//   const matchQop = authHeader.match(/qop="([^"]+)"/);
//   const matchOpaque = authHeader.match(/opaque="([^"]+)"/);

//   return {
//     nonce: matchNonce ? matchNonce[1] : null,
//     realm: matchRealm ? matchRealm[1] : null,
//     qop: matchQop ? matchQop[1] : "auth",
//     opaque: matchOpaque ? matchOpaque[1] : null,
//   };
// }

// // Digest 인증 헤더 생성 (MD5 기반)
// function createDigestAuthHeader(
//   username,
//   password,
//   realm,
//   method,
//   url,
//   nonce,
//   qop,
//   opaque,
//   nc = "00000001", // nonce count 기본값 설정
//   cnonce = crypto.randomBytes(10).toString("hex") // cnonce 기본값 설정
// ) {
//   // HA1 계산
//   const ha1 = crypto
//     .createHash("md5")
//     .update(`${username}:${realm}:${password}`)
//     .digest("hex");

//   // HA2 계산
//   const ha2 = crypto.createHash("md5").update(`${method}:${url}`).digest("hex");

//   // response 계산
//   const response = crypto
//     .createHash("md5")
//     .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
//     .digest("hex");

//   // Digest 인증 헤더 생성
//   return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${url}", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", opaque="${opaque}"`;
// }

// // 특정 기기의 토큰을 받아오는 라우터 엔드포인트
// router.post("/get-token", async (req, res) => {
//   const { deviceId, connectedPcIp } = req.body;

//   console.log("Connected PC IP:", connectedPcIp);

//   // deviceId가 요청 본문에 없으면 오류 반환
//   if (!deviceId) {
//     return res.status(400).send("기기 ID가 필요합니다.");
//   }

//   try {
//     // Firebase Realtime Database에서 deviceId를 기준으로 기기 정보 조회
//     // const deviceRef = deviceDB.child(deviceId); // deviceId를 키로 사용하는 레퍼런스
//     // const snapshot = await deviceRef.once("value"); // 해당 deviceId의 데이터를 가져옴
//     // // 기기 정보가 존재하지 않으면 오류 반환
//     // if (!snapshot.exists()) {
//     //   return res.status(404).send("해당 기기를 찾을 수 없습니다.");
//     // }
//     // const deviceData = snapshot.val();
//     // // getDeviceToken 함수 호출 후 token을 응답에 포함
//     // await getDeviceToken(deviceData.deviceIp, "admin", "13579Qwert!").then(
//     //   (data) => {
//     //     res.status(200).json({
//     //       message: "기기 정보 조회 성공",
//     //       deviceData: {
//     //         ...deviceData,
//     //         tokenData: data,
//     //       },
//     //     });
//     //   }
//     // );

//     const response = await axios.post(
//       `http://${connectedPcIp}:8080/device/proxy`,
//       {
//         deviceId,
//       }
//     );

//     if (response.status === 200) {
//       res.status(200).json({
//         message: "기기 정보 조회 성공",
//         deviceData: response.data,
//       });
//     }
//   } catch (error) {
//     console.error("기기 정보 조회 중 오류 발생:", error);
//     res.status(500).send("서버 오류: 기기 정보 조회 실패");
//   }
// });

// router.post("/proxy", async (req, res) => {
//   const { deviceId } = req.body;

//   // deviceId가 요청 본문에 있는지 확인
//   if (!deviceId) {
//     return res.status(400).send("기기 ID가 필요합니다.");
//   }

//   try {
//     // Firebase Realtime Database에서 deviceId를 기준으로 기기 정보 조회
//     const deviceRef = deviceDB.child(deviceId);
//     const snapshot = await deviceRef.once("value");

//     // 기기 정보가 존재하지 않는지 확인
//     if (!snapshot.exists()) {
//       return res.status(404).send("해당 기기를 찾을 수 없습니다.");
//     }

//     const deviceData = snapshot.val();

//     // getDeviceToken 함수를 호출하여 token을 응답에 포함
//     await getDeviceToken(deviceData.deviceIp, "admin", "13579Qwert!").then(
//       (data) => {
//         res.status(200).json({
//           message: "기기 정보 조회 성공",
//           deviceData: {
//             ...deviceData,
//             tokenData: data,
//           },
//         });
//       }
//     );
//   } catch (error) {
//     console.error("기기 정보 조회 중 오류 발생:", error);
//     res.status(500).send("서버 오류: 기기 정보 조회 실패");
//   }
// });

module.exports = router;
