const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

// Firebase Realtime Database의 "devices" 레퍼런스를 가져옴
const deviceDB = admin.database().ref("devices");

// Device 모델 정의 (클래스 방식)
class Device {
  constructor(userId, deviceIp, deviceId, deviceName, deviceLocation) {
    this.userId = userId; // 사용자 ID
    this.deviceId = deviceId; // 기기 ID
    this.deviceName = deviceName; // 기기 이름
    this.deviceLocation = deviceLocation; // 기기 위치
    this.createdAt = admin.database.ServerValue.TIMESTAMP; // 생성 시간 (타임스탬프)
    this.deviceIp = deviceIp; // 기기의 IP 주소
  }
}

// 새로운 Device를 생성하는 API 엔드포인트
router.post("/", async (req, res) => {
  const { userId, deviceIp, deviceId, deviceName, deviceLocation } = req.body;

  // 필수 입력값이 누락된 경우 오류 반환
  if (!userId || !deviceIp || !deviceId || !deviceName || !deviceLocation) {
    return res.status(400).send("필수 입력값이 누락되었습니다.");
  }

  // 새로운 Device 객체 생성
  const newDevice = new Device(
    userId,
    deviceIp,
    deviceId,
    deviceName,
    deviceLocation
  );

  try {
    // Firebase Realtime Database에 새 기기 정보 저장
    const postRef = deviceDB.push();
    await postRef.set(newDevice);

    res.status(201).send({
      message: "기기가 성공적으로 등록되었습니다.",
      deviceId: postRef.key,
    });
  } catch (error) {
    console.error("기기 등록 중 오류 발생:", error);
    res.status(500).send("서버 내부 오류");
  }
});

module.exports = router;
