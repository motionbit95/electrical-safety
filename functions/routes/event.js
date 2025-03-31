const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
// Realtime Database 레퍼런스
const eventDB = admin.database().ref("event");

// Event 모델 정의
class Event {
  constructor(devAddr, tempVal, apartmentId, timestamp) {
    this.devAddr = devAddr;
    this.tempVal = tempVal;
    this.apartmentId = apartmentId;
    this.timestamp = timestamp;
  }
}

// 데이터 생성 (Create)
router.post("/event", async (req, res) => {
  try {
    const { devAddr, tempVal, apartmentId, timestamp } = req.body;
    const newEvent = new Event(devAddr, tempVal, apartmentId, timestamp);

    // 이벤트 데이터 Firebase에 추가
    await eventDB.push(newEvent);
    res.status(201).send({ message: "이벤트 생성 완료", event: newEvent });
  } catch (error) {
    console.error("이벤트 생성 중 오류 발생:", error);
    res.status(500).send("서버 오류");
  }
});

// 데이터 읽기 (Read) - 전체 데이터 조회
router.get("/events", async (req, res) => {
  try {
    const snapshot = await eventDB.once("value");
    const events = snapshot.val();

    if (!events) {
      return res.status(404).send({ message: "데이터 없음" });
    }

    res.status(200).send({ message: "이벤트 목록 조회 성공", events });
  } catch (error) {
    console.error("이벤트 조회 중 오류 발생:", error);
    res.status(500).send("서버 오류");
  }
});

// 데이터 수정 (Update)
router.put("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { devAddr, tempVal, apartmentId, timestamp } = req.body;

    const updatedEvent = { devAddr, tempVal, apartmentId, timestamp };
    await eventDB.child(eventId).update(updatedEvent);

    res.status(200).send({ message: "이벤트 수정 완료", updatedEvent });
  } catch (error) {
    console.error("이벤트 수정 중 오류 발생:", error);
    res.status(500).send("서버 오류");
  }
});

// 데이터 삭제 (Delete)
router.delete("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    await eventDB.child(eventId).remove();

    res.status(200).send({ message: "이벤트 삭제 완료" });
  } catch (error) {
    console.error("이벤트 삭제 중 오류 발생:", error);
    res.status(500).send("서버 오류");
  }
});

// 온도 데이터 개수 및 최고 온도 추출 (전체, 연간, 월간, 주간) - 변화율 계산 추가
router.get("/events/stats", async (req, res) => {
  try {
    const snapshot = await eventDB.once("value");
    const events = snapshot.val();
    const stats = {
      totalCount: 0,
      yearlyCount: 0,
      monthlyCount: 0,
      weeklyCount: 0,
      maxTemp: -Infinity,
      totalCountChange: 0,
      yearlyCountChange: 0,
      monthlyCountChange: 0,
      weeklyCountChange: 0,
      maxTempChange: 0,
    };

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentWeek = getWeekNumber(currentDate);

    // 지난 기간 통계 추출
    const lastYearStats = await getStatsForPreviousPeriod(
      currentYear - 1,
      "year"
    );
    const lastMonthStats = await getStatsForPreviousPeriod(
      currentMonth - 1,
      "month"
    );
    const lastWeekStats = await getStatsForPreviousPeriod(
      currentWeek - 1,
      "week"
    );

    // 이벤트 데이터 필터링
    for (const eventId in events) {
      const event = events[eventId];
      const eventTimestamp = new Date(event.timestamp);
      const eventYear = eventTimestamp.getFullYear();
      const eventMonth = eventTimestamp.getMonth();
      const eventWeek = getWeekNumber(eventTimestamp);

      // 전체 데이터 개수
      stats.totalCount++;

      // 연간 데이터 개수
      if (eventYear === currentYear) stats.yearlyCount++;

      // 월간 데이터 개수
      if (eventMonth === currentMonth) stats.monthlyCount++;

      // 주간 데이터 개수
      if (eventWeek === currentWeek) stats.weeklyCount++;

      // 최고 온도 추출
      if (event.tempVal > stats.maxTemp) {
        stats.maxTemp = event.tempVal;
      }
    }

    // 변화율 계산 (현재 - 지난 / 지난) * 100
    stats.totalCountChange = calculatePercentageChange(
      stats.totalCount,
      lastYearStats.totalCount
    );
    stats.yearlyCountChange = calculatePercentageChange(
      stats.yearlyCount,
      lastYearStats.yearlyCount
    );
    stats.monthlyCountChange = calculatePercentageChange(
      stats.monthlyCount,
      lastMonthStats.monthlyCount
    );
    stats.weeklyCountChange = calculatePercentageChange(
      stats.weeklyCount,
      lastWeekStats.weeklyCount
    );
    stats.maxTempChange = calculatePercentageChange(
      stats.maxTemp,
      lastYearStats.maxTemp
    );

    res.status(200).send({
      message: "온도 통계 조회 성공",
      stats,
    });
  } catch (error) {
    console.error("온도 통계 조회 중 오류 발생:", error);
    res.status(500).send("서버 오류");
  }
});

// 주차 번호 계산 함수 (연도와 주 번호 추출)
function getWeekNumber(date) {
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + 1) / 7);
}

// 지난 기간에 대한 통계 계산 (연도, 월, 주 기준)
async function getStatsForPreviousPeriod(value, period) {
  let snapshot;
  if (period === "year") {
    snapshot = await getEventsByYear(value);
  } else if (period === "month") {
    snapshot = await getEventsByMonth(value);
  } else if (period === "week") {
    snapshot = await getEventsByWeek(value);
  }

  const events = snapshot.val();
  const stats = {
    totalCount: 0,
    yearlyCount: 0,
    monthlyCount: 0,
    weeklyCount: 0,
    maxTemp: -Infinity,
  };

  for (const eventId in events) {
    const event = events[eventId];
    const eventTimestamp = new Date(event.timestamp);
    const eventYear = eventTimestamp.getFullYear();
    const eventMonth = eventTimestamp.getMonth();
    const eventWeek = getWeekNumber(eventTimestamp);

    stats.totalCount++;
    if (eventYear === value) stats.yearlyCount++;
    if (eventMonth === value) stats.monthlyCount++;
    if (eventWeek === value) stats.weeklyCount++;

    if (event.tempVal > stats.maxTemp) {
      stats.maxTemp = event.tempVal;
    }
  }
  return stats;
}

// 특정 연도에 대한 데이터 필터링
async function getEventsByYear(year) {
  const snapshot = await eventDB
    .orderByChild("timestamp")
    .startAt(`${year}-01-01`)
    .endAt(`${year}-12-31`)
    .once("value");
  return snapshot;
}

// 특정 월에 대한 데이터 필터링
async function getEventsByMonth(month) {
  const snapshot = await eventDB
    .orderByChild("timestamp")
    .startAt(`2025-${month + 1}-01`)
    .endAt(`2025-${month + 1}-31`)
    .once("value");
  return snapshot;
}

// 특정 주에 대한 데이터 필터링
async function getEventsByWeek(week) {
  // 주간 데이터를 계산하려면 더 복잡한 로직이 필요할 수 있음
  const snapshot = await eventDB
    .orderByChild("timestamp")
    .startAt("2025-03-01")
    .endAt("2025-03-07")
    .once("value");
  return snapshot;
}

// 퍼센트 변화율 계산 함수
function calculatePercentageChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0; // previous가 0일 때 특별한 처리
  return ((current - previous) / previous) * 100;
}

module.exports = router;
