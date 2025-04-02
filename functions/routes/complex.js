const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = admin.database();

// Firebase Realtime Database 레퍼런스
const complexDB = admin.database().ref("complexes");
const groupDB = admin.database().ref("groups");
const deviceDB = admin.database().ref("devices");
const sensorDB = admin.database().ref("sensors");

// **단지 클래스**
class Complex {
  static async add(complexName) {
    if (!complexName) throw new Error("단지 이름은 필수 입력값입니다.");

    const complexSnapshot = await complexDB
      .orderByChild("name")
      .equalTo(complexName)
      .once("value");
    if (complexSnapshot.exists()) throw new Error("단지가 이미 존재합니다.");

    const newComplexRef = complexDB.push();
    await newComplexRef.set({ name: complexName });
    return {
      id: newComplexRef.key,
      message: "단지가 성공적으로 추가되었습니다.",
    };
  }

  static async getAll() {
    const snapshot = await complexDB.once("value");
    if (!snapshot.exists()) return [];
    return snapshot.val();
  }

  static async update(complexId, newName) {
    if (!newName) throw new Error("새로운 단지 이름은 필수 입력값입니다.");
    await complexDB.child(complexId).update({ name: newName });
    return { message: "단지가 성공적으로 수정되었습니다." };
  }

  static async delete(complexId) {
    await complexDB.child(complexId).remove();
    return { message: "단지가 성공적으로 삭제되었습니다." };
  }

  static async getById(complexId) {
    const snapshot = await complexDB.child(complexId).once("value");
    if (!snapshot.exists())
      throw new Error("해당 ID의 단지를 찾을 수 없습니다.");
    return snapshot.val();
  }
}

// **그룹 클래스**
class Group {
  // 그룹 추가
  static async add(groupName, criticalTemperature = null) {
    if (!groupName) {
      throw new Error("단지 ID와 그룹 이름이 필요합니다.");
    }

    const newGroupRef = groupDB.push();
    await newGroupRef.set({
      temp: criticalTemperature,
      name: groupName,
    });
    return {
      id: newGroupRef.key,
      message: "그룹이 성공적으로 추가되었습니다.",
    };
  }

  // 특정 그룹 ID로 조회
  static async getById(groupId) {
    const groupSnap = await groupDB.child(groupId).once("value");
    if (!groupSnap.exists()) throw new Error("그룹를 찾을 수 없습니다.");
    return groupSnap.val();
  }

  // 그룹 수정
  static async update(groupId, data) {
    await groupDB.child(groupId).update({
      temp: data.criticalTemperature || null,
      name: data.newName || null,
    });
    return { message: "그룹이 성공적으로 수정되었습니다." };
  }

  // 그룹 삭제
  static async delete(groupId) {
    await groupDB.child(groupId).remove();
    return { message: "그룹이 성공적으로 삭제되었습니다." };
  }

  // 그룹 이름으로 검색
  static async findByName(name) {
    const groupSnap = await groupDB.once("value");
    if (!groupSnap.exists()) return [];

    const groups = groupSnap.val();

    // 부분 검색 기능 추가 (name에 검색어가 포함된 데이터 필터링)
    const result = Object.entries(groups)
      .filter(([id, apt]) => apt.name.includes(name)) // 부분 검색
      .map(([id, apt]) => ({ id, ...apt }));

    return result;
  }

  // 그룹 리스트
  static async getAll() {
    const groupSnap = await groupDB.once("value");
    if (!groupSnap.exists()) return [];
    return groupSnap.val();
  }
}

// **단지 API**
router.post("/complex", async (req, res) => {
  try {
    res.status(201).json(await Complex.add(req.body.complexName));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/complexes", async (req, res) => {
  try {
    res.status(200).json(await Complex.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/complex", async (req, res) => {
  try {
    res
      .status(200)
      .json(await Complex.update(req.body.complexId, req.body.newName));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/complex", async (req, res) => {
  try {
    res.status(200).json(await Complex.delete(req.body.complexId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/complex/:complexId", async (req, res) => {
  try {
    res.status(200).json(await Complex.getById(req.params.complexId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **그룹 API 라우터**
router.post("/group", async (req, res) => {
  try {
    res
      .status(201)
      .json(await Group.add(req.body.groupName, req.body.criticalTemperature));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/group", async (req, res) => {
  try {
    res.status(200).json(await Group.update(req.body.groupId, req.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/groups", async (req, res) => {
  try {
    res.status(200).json(await Group.getAll());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/group/:groupId", async (req, res) => {
  try {
    res.status(200).json(await Group.getById(req.params.groupId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/group", async (req, res) => {
  try {
    res.status(200).json(await Group.delete(req.body.groupId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/group/search/:name", async (req, res) => {
  try {
    const groups = await Group.findByName(req.params.name);
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 그룹의 센서 정보 (페이지네이션 적용)
router.get("/group/:groupId/sensors", async (req, res) => {
  try {
    const groupId = req.params.groupId;
    let { limit, page } = req.query;

    limit = parseInt(limit) || 10; // 기본값: 10개
    page = parseInt(page) || 1; // 기본값: 1페이지

    // Firebase에서 groupId가 일치하는 센서 조회
    const snapshot = await sensorDB
      .orderByChild("groupId")
      .equalTo(groupId)
      .once("value");

    if (!snapshot.exists()) {
      return res.status(200).send({ message: "등록된 센서가 없습니다." });
    }

    // Firebase 데이터는 객체 형태 -> 배열 변환 후 정렬
    const devices = Object.entries(snapshot.val() || {}).map(
      ([key, value]) => ({
        sensorId: key,
        ...value,
      })
    );

    // 전체 개수 저장
    const totalDevices = devices.length;

    // 페이지네이션 적용 (배열 자르기)
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedDevices = devices.slice(startIndex, endIndex);

    // 센서별 최신 온도 조회
    for (const device of paginatedDevices) {
      const { sensorId } = device;
      const temperatureRef = db.ref(`temperature/${sensorId}`);

      try {
        const tempSnapshot = await temperatureRef.limitToLast(1).once("value");

        if (tempSnapshot.exists()) {
          const temperatureData = Object.values(tempSnapshot.val())[0];
          device.temperature = temperatureData ? temperatureData.tempVal : null;
        } else {
          device.temperature = null;
        }
      } catch (error) {
        console.error(`센서 ${sensorId}의 온도 조회 오류:`, error);
        device.temperature = null;
      }
    }

    // 응답 반환
    res.status(200).send({
      message: "센서 목록 조회 성공",
      totalDevices, // 전체 센서 개수
      totalPages: Math.ceil(totalDevices / limit), // 총 페이지 수
      currentPage: page,
      limit,
      devices: paginatedDevices, // 페이지 적용된 데이터만 전송
    });
  } catch (error) {
    console.error("센서 목록 조회 중 오류 발생:", error);
    res.status(500).send({ message: "서버 내부 오류" });
  }
});

module.exports = router;
