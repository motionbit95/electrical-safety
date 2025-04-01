const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = admin.database();

// Firebase Realtime Database 레퍼런스
const complexDB = admin.database().ref("complexes");
const apartmentDB = admin.database().ref("apartments");
const deviceDB = admin.database().ref("devices");

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

// **아파트 클래스**
class Apartment {
  // 아파트 추가
  static async add(complexId, apartmentName, criticalTemperature = null) {
    if (!complexId || !apartmentName) {
      throw new Error("단지 ID와 아파트 이름이 필요합니다.");
    }

    const complexSnap = await complexDB.child(complexId).once("value");
    if (!complexSnap.exists()) throw new Error("단지를 찾을 수 없습니다.");

    const newApartmentRef = apartmentDB.push();
    await newApartmentRef.set({
      temp: criticalTemperature,
      name: apartmentName,
      complexId,
    });
    return {
      id: newApartmentRef.key,
      message: "아파트가 성공적으로 추가되었습니다.",
    };
  }

  // 특정 단지 내 아파트 목록 조회
  static async getByComplex(complexId) {
    const apartmentSnap = await apartmentDB
      .orderByChild("complexId")
      .equalTo(complexId)
      .once("value");
    return apartmentSnap.exists() ? apartmentSnap.val() : {};
  }

  // 특정 아파트 ID로 조회
  static async getById(apartmentId) {
    const apartmentSnap = await apartmentDB.child(apartmentId).once("value");
    if (!apartmentSnap.exists()) throw new Error("아파트를 찾을 수 없습니다.");
    return apartmentSnap.val();
  }

  // 아파트 수정
  static async update(apartmentId, data) {
    await apartmentDB.child(apartmentId).update({
      temp: data.criticalTemperature || null,
      name: data.newName || null,
      complexId: data.complexId || null,
    });
    return { message: "아파트가 성공적으로 수정되었습니다." };
  }

  // 아파트 삭제
  static async delete(apartmentId) {
    await apartmentDB.child(apartmentId).remove();
    return { message: "아파트가 성공적으로 삭제되었습니다." };
  }

  // 아파트 이름으로 검색
  static async findByName(name) {
    const apartmentSnap = await apartmentDB.once("value");
    if (!apartmentSnap.exists()) return [];

    const apartments = apartmentSnap.val();

    // 부분 검색 기능 추가 (name에 검색어가 포함된 데이터 필터링)
    const result = Object.entries(apartments)
      .filter(([id, apt]) => apt.name.includes(name)) // 부분 검색
      .map(([id, apt]) => ({ id, ...apt }));

    return result;
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

// **아파트 API 라우터**
router.post("/apartment", async (req, res) => {
  try {
    res
      .status(201)
      .json(
        await Apartment.add(
          req.body.complexId,
          req.body.apartmentName,
          req.body.criticalTemperature
        )
      );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/apartment", async (req, res) => {
  try {
    res
      .status(200)
      .json(await Apartment.update(req.body.apartmentId, req.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/apartments/:complexId", async (req, res) => {
  try {
    res.status(200).json(await Apartment.getByComplex(req.params.complexId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/apartment/:apartmentId", async (req, res) => {
  try {
    res.status(200).json(await Apartment.getById(req.params.apartmentId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/apartment", async (req, res) => {
  try {
    res.status(200).json(await Apartment.delete(req.body.apartmentId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/apartment/search/:name", async (req, res) => {
  try {
    const apartments = await Apartment.findByName(req.params.name);
    res.status(200).json(apartments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 특정 아파트의 센서 정보 (페이지네이션 적용)
router.get("/apartment/:apartmentId/sensors", async (req, res) => {
  try {
    const apartmentId = req.params.apartmentId;
    let { limit, page } = req.query;

    limit = parseInt(limit) || 10; // 기본값: 10개
    page = parseInt(page) || 1; // 기본값: 1페이지

    // Firebase에서 apartmentId가 일치하는 센서 조회
    const snapshot = await deviceDB
      .orderByChild("apartmentId")
      .equalTo(apartmentId)
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
