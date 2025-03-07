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

  // Firebase에서 deviceId가 이미 존재하는지 확인
  try {
    const deviceRef = deviceDB.child(deviceId); // deviceId를 키로 하는 레퍼런스 생성
    const snapshot = await deviceRef.once("value"); // 해당 deviceId의 데이터가 존재하는지 조회

    if (snapshot.exists()) {
      // deviceId가 이미 존재하면 오류 반환
      return res.status(400).send("이미 존재하는 기기 ID입니다.");
    }

    // 새로운 Device 객체 생성
    const newDevice = new Device(
      userId,
      deviceIp,
      deviceId,
      deviceName,
      deviceLocation
    );

    // Firebase Realtime Database에 deviceId를 키로 사용하여 새 기기 정보 저장
    await deviceRef.set(newDevice);

    // 기기 등록 성공 응답
    res.status(201).send({
      message: "기기가 성공적으로 등록되었습니다.",
      deviceId: deviceRef.key, // deviceRef.key는 deviceId가 됩니다.
    });
  } catch (error) {
    console.error("기기 등록 중 오류 발생:", error);
    // 서버 내부 오류 발생 시 응답
    res.status(500).send("서버 내부 오류");
  }
});

// 특정 기기 삭제
router.delete("/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;

  try {
    const deviceRef = deviceDB.child(deviceId);
    await deviceRef.remove();
    res.status(200).send({ message: "기기가 성공적으로 삭제됨." });
  } catch (error) {
    console.error("기기 삭제 중 오류 발생:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 전체 device 목록 조회
router.get("/", async (req, res) => {
  try {
    // Firebase Realtime Database에서 모든 device 정보를 가져오기
    const snapshot = await deviceDB.once("value");

    // 데이터가 없으면 빈 객체 반환
    if (!snapshot.exists()) {
      return res.status(200).send({ message: "등록된 기기가 없습니다." });
    }

    // Firebase 데이터는 객체 형태로 반환되므로 배열로 변환
    const devices = snapshot.val();
    const deviceList = Object.keys(devices).map((key) => ({
      deviceId: key, // deviceId는 Firebase 데이터의 키로 사용됨
      ...devices[key],
    }));

    res.status(200).send({
      message: "기기 목록 조회 성공",
      devices: deviceList,
    });
  } catch (error) {
    console.error("기기 목록 조회 중 오류 발생:", error);
    res.status(500).send("서버 내부 오류");
  }
});

module.exports = router;
