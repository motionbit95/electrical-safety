const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
// Realtime Database 레퍼런스
const db = admin.database();

class Sensor {
  constructor(imageUrl, sensorId, groupId, sensorName) {
    this.imageUrl = imageUrl;
    this.sensorId = sensorId;
    this.groupId = groupId;
    this.sensorName = sensorName;
  }
}

router.get("/", async (req, res) => {
  try {
    // 페이지네이션 파라미터 처리
    let { limit, page } = req.query;
    limit = limit ? parseInt(limit) : undefined; // limit 값이 없으면 undefined
    page = page ? parseInt(page) : undefined; // page 값이 없으면 undefined

    // Firebase에서 모든 센서 조회
    const snapshot = await db.ref("sensors").once("value");
    const sensors = snapshot.val();

    if (!sensors) {
      return res.status(200).json({ message: "등록된 센서가 없습니다." });
    }

    // 센서 데이터를 배열로 변환
    const sensorList = [];
    for (const sensorId in sensors) {
      const sensor = sensors[sensorId];
      sensorList.push(
        new Sensor(sensor.imageUrl, sensorId, sensor.groupId, sensor.sensorName)
      );
    }

    const totalSensors = sensorList.length;

    // 페이지네이션이 없으면 전체 데이터 반환
    if (!limit || !page) {
      return res.status(200).json({
        message: "센서 목록 조회 성공",
        totalSensors, // 전체 센서 개수
        sensors: sensorList, // 전체 데이터 반환
      });
    }

    // 페이지네이션 적용 (배열 자르기)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSensors = sensorList.slice(startIndex, endIndex);

    // 응답 반환
    res.status(200).json({
      message: "센서 목록 조회 성공",
      totalSensors, // 전체 센서 개수
      totalPages: Math.ceil(totalSensors / limit), // 총 페이지 수
      currentPage: page,
      limit,
      sensors: paginatedSensors, // 페이지 적용된 데이터만 전송
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:sensorId", async (req, res) => {
  const { sensorId } = req.params;
  try {
    const snapshot = await db.ref(`sensors/${sensorId}`).once("value");
    const sensor = snapshot.val();
    res.json(sensor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req, res) => {
  const { sensorId, groupId, sensorName, imageUrl } = req.body;
  try {
    await db.ref(`sensors/${sensorId}`).set({ imageUrl, groupId, sensorName });
    res.json({ message: "센서가 등록되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:sensorId", async (req, res) => {
  const { sensorId } = req.params;
  const { groupId, sensorName, imageUrl } = req.body;
  try {
    await db
      .ref(`sensors/${sensorId}`)
      .update({ imageUrl, groupId, sensorName });
    res.json({ message: "센서가 수정되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:sensorId", async (req, res) => {
  const { sensorId } = req.params;
  try {
    await db.ref(`sensors/${sensorId}`).remove();
    res.json({ message: "센서가 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/search/:sensorName", async (req, res) => {
  const { sensorName } = req.params;
  try {
    const snapshot = await db.ref("sensors").once("value");
    const sensors = snapshot.val();
    const sensorList = [];

    for (const sensorId in sensors) {
      const sensor = sensors[sensorId];
      if (sensor.sensorName.includes(sensorName)) {
        sensorList.push(
          new Sensor(
            sensor.imageUrl,
            sensorId,
            sensor.groupId,
            sensor.sensorName
          )
        );
      }
    }

    res.json(sensorList);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
