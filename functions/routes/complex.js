const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

// Firebase Realtime Database 레퍼런스
const complexDB = admin.database().ref("complexes");
const apartmentDB = admin.database().ref("apartments");

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
  static async update(apartmentId, newName) {
    if (!newName) throw new Error("새로운 아파트 이름은 필수 입력값입니다.");
    await apartmentDB.child(apartmentId).update({ name: newName });
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

module.exports = router;
