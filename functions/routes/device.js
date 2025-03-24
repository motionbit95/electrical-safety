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
  constructor(sensorId, address, xCoord, yCoord, complexId, apartmentId) {
    this.complexId = complexId; // 단지 ID
    this.apartmentId = apartmentId; // 아파트 ID
    this.sensorId = sensorId; // 센서 ID
    this.address = address; // 주소
    this.xCoord = xCoord; // X좌표
    this.yCoord = yCoord; // Y좌표
    this.createdAt = admin.database.ServerValue.TIMESTAMP; // 생성 시간 (타임스탬프)
  }
}

// 새로운 Device를 생성하는 API 엔드포인트
router.post("/", async (req, res) => {
  const { sensorId, address, xCoord, yCoord, complexId, apartmentId } =
    req.body;

  // 필수 입력값이 누락된 경우 오류 반환
  if (
    !sensorId ||
    !address ||
    !xCoord ||
    !yCoord ||
    !complexId ||
    !apartmentId
  ) {
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
    const newDevice = new Device(
      sensorId,
      address,
      xCoord,
      yCoord,
      complexId,
      apartmentId
    );

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

module.exports = router;
