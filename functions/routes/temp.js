const express = require("express");
const router = express.Router();
const admin = require("firebase-admin");
const db = admin.database();

const dayjs = require("dayjs");
const isSameOrAfter = require("dayjs/plugin/isSameOrAfter");
const isSameOrBefore = require("dayjs/plugin/isSameOrBefore");
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

// 1. 특정 센서 ID의 모든 데이터를 가져오는 함수
router.get("/:sensorId", async (req, res) => {
  const { sensorId } = req.params;
  try {
    const ref = db.ref(`temperature/${sensorId}`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
    }

    res.json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. 특정 센서의 최신 데이터 가져오기
router.get("/:sensorId/latest", async (req, res) => {
  const { sensorId } = req.params;
  try {
    const ref = db.ref(`temperature/${sensorId}`);
    const snapshot = await ref.limitToLast(1).once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
    }

    const data = snapshot.val();
    const key = Object.keys(data)[0];
    const latestData = data[key];

    // push key를 결과에 포함 (예: id 프로퍼티)
    latestData.id = key;

    res.json(latestData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. 일간 평균 데이터 (전체 평균 및 시간별 평균)
router.get("/:sensorId/daily-average/:date", async (req, res) => {
  const { sensorId, date } = req.params; // date format: YYYY-MM-DD
  try {
    const ref = db.ref(`temperature/${sensorId}`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
    }

    const data = Object.values(snapshot.val()).filter((item) => {
      return (
        item.updateTime &&
        new Date(item.updateTime).toISOString().split("T")[0] === date
      );
    });

    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "해당 날짜의 데이터가 없습니다." });
    }

    const overallAvg =
      data.reduce((sum, d) => sum + d.tempVal, 0) / data.length;

    const hourlyAvg = {};
    for (let hour = 0; hour < 24; hour++) {
      const hourData = data.filter(
        (d) => new Date(d.updateTime).getHours() === hour
      );
      hourlyAvg[hour] = hourData.length
        ? hourData.reduce((sum, d) => sum + d.tempVal, 0) / hourData.length
        : 0;
    }

    res.json({ overallAvg, hourlyAvg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. 월간 평균 데이터
router.get("/:sensorId/monthly-average/:year/:month", async (req, res) => {
  const { sensorId, year, month } = req.params;
  try {
    const ref = db.ref(`temperature/${sensorId}`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
    }

    const data = Object.values(snapshot.val()).filter((item) => {
      if (!item.updateTime) return false;
      const itemDate = new Date(item.updateTime);
      return (
        itemDate.getFullYear() === parseInt(year) &&
        itemDate.getMonth() + 1 === parseInt(month)
      );
    });

    if (data.length === 0) {
      return res.status(404).json({ message: "해당 월의 데이터가 없습니다." });
    }

    const overallAvg =
      data.reduce((sum, d) => sum + d.tempVal, 0) / data.length;

    const weeklyAvg = {};
    for (let week = 1; week <= 4; week++) {
      const weekData = data.filter((item) => {
        const day = new Date(item.updateTime).getDate();
        return (week - 1) * 7 < day && day <= week * 7;
      });
      weeklyAvg[week] = weekData.length
        ? weekData.reduce((sum, d) => sum + d.tempVal, 0) / weekData.length
        : 0;
    }

    res.json({ overallAvg, weeklyAvg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. 연간 평균 데이터
router.get("/:sensorId/yearly-average/:year", async (req, res) => {
  const { sensorId, year } = req.params;
  try {
    const ref = db.ref(`temperature/${sensorId}`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
    }

    const data = Object.values(snapshot.val()).filter(
      (item) =>
        item.updateTime &&
        new Date(item.updateTime).getFullYear() === parseInt(year)
    );

    if (data.length === 0) {
      return res
        .status(404)
        .json({ message: "해당 연도의 데이터가 없습니다." });
    }

    const overallAvg =
      data.reduce((sum, d) => sum + d.tempVal, 0) / data.length;

    const monthlyAvg = {};
    for (let month = 1; month <= 12; month++) {
      const monthData = data.filter(
        (item) => new Date(item.updateTime).getMonth() + 1 === month
      );
      monthlyAvg[month] = monthData.length
        ? monthData.reduce((sum, d) => sum + d.tempVal, 0) / monthData.length
        : 0;
    }

    res.json({ overallAvg, monthlyAvg });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. 센서 키 등록
router.post("/users/:userId/sensors", async (req, res) => {
  const { userId } = req.params;
  const { sensorId } = req.body; // { "sensorId": "sensor123" }

  if (!sensorId) {
    return res.status(400).json({ message: "센서 ID를 입력해주세요." });
  }

  try {
    const ref = db.ref(`users/${userId}/sensors/${sensorId}`);
    await ref.set(true); // 센서 키 등록
    res.json({ message: "센서 키가 등록되었습니다.", sensorId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. 사용자 센서 키 목록 조회
router.get("/users/:userId/sensors", async (req, res) => {
  const { userId } = req.params;

  try {
    const ref = db.ref(`users/${userId}/sensors`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "등록된 센서가 없습니다." });
    }

    const sensors = Object.keys(snapshot.val()); // 센서 키 목록 추출
    res.json({ userId, sensors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. 사용자 센서 키 삭제
router.delete("/users/:userId/sensors/:sensorId", async (req, res) => {
  const { userId, sensorId } = req.params;

  try {
    const ref = db.ref(`users/${userId}/sensors/${sensorId}`);
    const snapshot = await ref.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "센서 키를 찾을 수 없습니다." });
    }

    await ref.remove(); // 센서 키 삭제
    res.json({ message: "센서 키가 삭제되었습니다.", sensorId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// router.get("/daily-average/:date", async (req, res) => {
//   const { date } = req.params; // date format: YYYY-MM-DD
//   try {
//     const ref = db.ref(`temperature`);
//     const snapshot = await ref.once("value");

//     if (!snapshot.exists()) {
//       return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
//     }

//     let allData = [];

//     // sensorId별 데이터 수집
//     Object.values(snapshot.val()).forEach((sensorData) => {
//       allData.push(
//         ...Object.values(sensorData).filter(
//           (item) =>
//             item.updateTime &&
//             new Date(item.updateTime).toISOString().split("T")[0] === date
//         )
//       );
//     });

//     if (allData.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "해당 날짜의 데이터가 없습니다." });
//     }

//     const overallAvg =
//       allData.reduce((sum, d) => sum + d.tempVal, 0) / allData.length;

//     const hourlyAvg = {};
//     for (let hour = 0; hour < 24; hour++) {
//       const hourData = allData.filter(
//         (d) => new Date(d.updateTime).getHours() === hour
//       );
//       hourlyAvg[hour] = hourData.length
//         ? hourData.reduce((sum, d) => sum + d.tempVal, 0) / hourData.length
//         : 0;
//     }

//     res.json({ overallAvg, hourlyAvg });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.get("/monthly-average/:year/:month", async (req, res) => {
//   const { year, month } = req.params;
//   try {
//     const ref = db.ref(`temperature`);
//     const snapshot = await ref.once("value");

//     if (!snapshot.exists()) {
//       return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
//     }

//     let sensorDataMap = {};
//     let allData = [];

//     Object.entries(snapshot.val()).forEach(([sensorId, sensorData]) => {
//       const filteredData = Object.values(sensorData).filter((item) => {
//         if (!item.updateTime) return false;
//         const itemDate = new Date(item.updateTime);
//         return (
//           itemDate.getFullYear() === parseInt(year) &&
//           itemDate.getMonth() + 1 === parseInt(month)
//         );
//       });

//       if (filteredData.length > 0) {
//         sensorDataMap[sensorId] = filteredData;
//         allData.push(...filteredData);
//       }
//     });

//     if (allData.length === 0) {
//       return res.status(404).json({ message: "해당 월의 데이터가 없습니다." });
//     }

//     const sensorAverages = {};
//     Object.entries(sensorDataMap).forEach(([sensorId, data]) => {
//       sensorAverages[sensorId] =
//         data.reduce((sum, d) => sum + d.tempVal, 0) / data.length;
//     });

//     const overallAvg =
//       allData.reduce((sum, d) => sum + d.tempVal, 0) / allData.length;

//     res.json({ overallAvg, sensorAverages });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// router.get("/yearly-average/:year", async (req, res) => {
//   const { year } = req.params;
//   try {
//     const ref = db.ref(`temperature`);
//     const snapshot = await ref.once("value");

//     if (!snapshot.exists()) {
//       return res.status(404).json({ message: "데이터를 찾을 수 없습니다." });
//     }

//     let sensorDataMap = {};
//     let allData = [];

//     Object.entries(snapshot.val()).forEach(([sensorId, sensorData]) => {
//       const filteredData = Object.values(sensorData).filter(
//         (item) =>
//           item.updateTime &&
//           new Date(item.updateTime).getFullYear() === parseInt(year)
//       );

//       if (filteredData.length > 0) {
//         sensorDataMap[sensorId] = filteredData;
//         allData.push(...filteredData);
//       }
//     });

//     if (allData.length === 0) {
//       return res
//         .status(404)
//         .json({ message: "해당 연도의 데이터가 없습니다." });
//     }

//     const sensorAverages = {};
//     Object.entries(sensorDataMap).forEach(([sensorId, data]) => {
//       sensorAverages[sensorId] =
//         data.reduce((sum, d) => sum + d.tempVal, 0) / data.length;
//     });

//     const overallAvg =
//       allData.reduce((sum, d) => sum + d.tempVal, 0) / allData.length;

//     res.json({ overallAvg, sensorAverages });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

module.exports = router;
