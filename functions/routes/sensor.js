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
    let { limit, page } = req.query;
    limit = limit ? parseInt(limit) : undefined;
    page = page ? parseInt(page) : undefined;

    const snapshot = await db.ref("sensors").once("value");
    const sensors = snapshot.val();

    if (!sensors) {
      return res.status(200).json({ message: "등록된 센서가 없습니다." });
    }

    const sensorList = [];

    for (const sensorId in sensors) {
      const sensor = sensors[sensorId];

      // 최신 온도 데이터 가져오기
      const tempSnapshot = await db
        .ref(`temperature/${sensorId}`)
        .limitToLast(1)
        .once("value");

      let latestTemperature = null;

      if (tempSnapshot.exists()) {
        const data = tempSnapshot.val();
        const key = Object.keys(data)[0];
        latestTemperature = {
          id: key,
          ...data[key],
        };
      }

      sensorList.push({
        id: sensorId,
        groupId: sensor.groupId,
        sensorName: sensor.sensorName,
        imageUrl: sensor.imageUrl,
        latestTemperature, // ✅ 최신 온도 포함
      });
    }

    const totalSensors = sensorList.length;

    if (!limit || !page) {
      return res.status(200).json({
        message: "센서 목록 조회 성공",
        totalSensors,
        sensors: sensorList,
      });
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSensors = sensorList.slice(startIndex, endIndex);

    res.status(200).json({
      message: "센서 목록 조회 성공",
      totalSensors,
      totalPages: Math.ceil(totalSensors / limit),
      currentPage: page,
      limit,
      sensors: paginatedSensors,
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
