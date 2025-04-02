const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
const cameraDB = admin.database().ref("cameras");

class Camera {
  constructor(imageUrl, name, ip) {
    this.imageUrl = imageUrl || "";
    this.name = name;
    this.ip = ip;
  }
}

// 모든 카메라 목록 조회
router.get("/", async (req, res) => {
  try {
    const snapshot = await cameraDB.once("value");
    const cameras = snapshot.val();
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 새로운 카메라 추가
router.post("/", async (req, res) => {
  try {
    const { imageUrl, name, ip } = req.body;
    if (!name || !ip) {
      return res
        .status(400)
        .json({ error: "카메라 이름과 IP를 모두 입력하세요." });
    }
    const newCamera = new Camera(imageUrl, name, ip);
    await cameraDB.push(newCamera);
    res.status(201).json(newCamera);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 카메라 정보 수정
router.put("/:id", async (req, res) => {
  try {
    const cameraId = req.params.id;
    const { imageUrl, name, ip } = req.body;
    if (!name || !ip) {
      return res
        .status(400)
        .json({ error: "카메라 이름과 IP를 모두 입력하세요." });
    }
    const updatedCamera = new Camera(imageUrl, name, ip);
    await cameraDB.child(cameraId).update(updatedCamera);
    res.status(200).json(updatedCamera);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 카메라 삭제
router.delete("/:id", async (req, res) => {
  try {
    const cameraId = req.params.id;
    await cameraDB.child(cameraId).remove();
    res.status(200).json({ message: "카메라가 성공적으로 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 카메라 정보 조회
router.get("/:id", async (req, res) => {
  try {
    const cameraId = req.params.id;
    const snapshot = await cameraDB.child(cameraId).once("value");
    if (!snapshot.exists()) {
      return res.status(404).json({ message: "카메라를 찾을 수 없습니다." });
    }
    res.status(200).json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
