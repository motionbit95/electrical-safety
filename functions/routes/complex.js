const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

// Firebase Realtime Database의 "complexes" 레퍼런스를 가져옴
const complexDB = admin.database().ref("complexes");

// **단지 및 아파트 추가 API**
router.post("/", async (req, res) => {
  try {
    const { flag, complexName, apartments = [] } = req.body;

    if (!flag) {
      return res
        .status(400)
        .json({ error: "플래그(flag)는 필수 입력값입니다." });
    }

    switch (flag) {
      case "CPX":
        if (!complexName) {
          return res
            .status(400)
            .json({ error: "단지 이름은 필수 입력값입니다." });
        }

        const complexSnapshot = await complexDB
          .orderByChild("name")
          .equalTo(complexName)
          .once("value");

        if (complexSnapshot.exists()) {
          return res.status(400).json({ error: "단지가 이미 존재합니다." });
        }

        const newComplexRef = complexDB.push();
        await newComplexRef.set({
          name: complexName,
          apartments: [],
        });

        res.status(201).json({
          message: "단지가 성공적으로 추가되었습니다.",
          id: newComplexRef.key,
        });
        break;

      case "APT":
        if (!complexName || !apartments || apartments.length === 0) {
          return res.status(400).json({
            error: "단지 이름과 추가할 아파트 목록이 필요합니다.",
          });
        }

        const aptSnapshot = await complexDB
          .orderByChild("name")
          .equalTo(complexName)
          .once("value");

        if (!aptSnapshot.exists()) {
          return res.status(500).json({ error: "단지를 찾을 수 없습니다." });
        }

        const complexKey = Object.keys(aptSnapshot.val())[0];
        const existingApartments =
          aptSnapshot.val()[complexKey].apartments || [];

        await complexDB.child(complexKey).update({
          apartments: [...new Set([...existingApartments, ...apartments])],
        });

        res.status(200).json({
          message: "아파트 목록이 성공적으로 업데이트되었습니다.",
          apartments: [...existingApartments, ...apartments],
        });
        break;

      default:
        res.status(400).json({ error: "잘못된 플래그 값입니다." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **단지 목록 조회 API**
router.get("/", async (req, res) => {
  try {
    const snapshot = await complexDB.once("value");
    if (!snapshot.exists()) {
      return res.status(500).json({ message: "등록된 단지가 없습니다." });
    }

    // 데이터를 객체 형태로 변환
    const complexes = snapshot.val();

    // 각 단지의 아파트 목록을 index와 함께 변환
    const result = Object.keys(complexes).map((key) => ({
      id: key,
      name: complexes[key].name,
      apartments: complexes[key].apartments
        ? complexes[key].apartments.map((apt, index) => ({
            index,
            name: apt,
          }))
        : [],
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **단지 이름으로 단지 데이터 조회 API**
router.get("/:complexName", async (req, res) => {
  try {
    const { complexName } = req.params;

    if (!complexName) {
      return res.status(400).json({ error: "단지 이름은 필수 입력값입니다." });
    }

    const complexSnap = await complexDB
      .orderByChild("name")
      .equalTo(complexName)
      .once("value");

    if (!complexSnap.exists()) {
      return res.status(500).json({ error: "해당 단지를 찾을 수 없습니다." });
    }

    // 단지 ID와 데이터를 반환
    const complexId = Object.keys(complexSnap.val())[0];
    const complexData = complexSnap.val()[complexId];

    res.status(200).json({ id: complexId, ...complexData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **단지 및 아파트 수정 API** (complexId 대신 complexName 사용)
router.put("/", async (req, res) => {
  try {
    const {
      flag,
      apartments,
      complexName,
      apartmentIndex,
      apartmentName,
      newComplexName,
    } = req.body;

    if (!flag || !complexName) {
      return res
        .status(400)
        .json({ error: "플래그(flag)와 단지 이름은 필수 입력값입니다." });
    }

    const complexSnap = await complexDB
      .orderByChild("name")
      .equalTo(complexName)
      .once("value");
    if (!complexSnap.exists()) {
      return res.status(500).json({ error: "단지를 찾을 수 없습니다." });
    }

    const complexId = Object.keys(complexSnap.val())[0];

    switch (flag) {
      case "CPX":
        if (!newComplexName) {
          return res
            .status(400)
            .json({ error: "새로운 단지 이름은 필수 입력값입니다." });
        }

        // 모든 단지 데이터를 가져와서 중복 확인
        const allComplexesSnapshot = await complexDB.once("value");
        const allComplexes = allComplexesSnapshot.val();

        // 현재 수정하려는 단지 외에 동일한 이름이 존재하는지 검사
        const nameExists = Object.values(allComplexes).some(
          (complex) =>
            complex.name === newComplexName && complex.id !== complexId
        );

        if (nameExists) {
          return res
            .status(400)
            .json({ error: "이미 존재하는 단지 이름입니다." });
        }

        const updateData = {
          name: newComplexName,
        };
        if (apartments) updateData.apartments = apartments;

        console.log(complexId, updateData);
        await complexDB.child(complexId).update(updateData);
        res.status(200).json({ message: "단지가 성공적으로 수정되었습니다." });
        break;

      case "APT":
        if (apartmentIndex === undefined || !apartmentName) {
          return res
            .status(400)
            .json({ error: "아파트 인덱스와 이름이 필요합니다." });
        }

        const currentApts = complexSnap.val()[complexId].apartments || [];
        if (apartmentIndex < 0 || apartmentIndex >= currentApts.length) {
          return res.status(400).json({ error: "잘못된 아파트 인덱스입니다." });
        }

        currentApts[apartmentIndex] = apartmentName;
        await complexDB.child(complexId).update({ apartments: currentApts });
        res
          .status(200)
          .json({ message: "아파트가 성공적으로 수정되었습니다." });
        break;

      default:
        res.status(400).json({ error: "잘못된 플래그 값입니다." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **단지 및 아파트 삭제 API** (complexId 대신 complexName 사용)
router.delete("/", async (req, res) => {
  try {
    const { flag, apartmentIndex, complexName } = req.body;

    if (!flag || !complexName) {
      return res
        .status(400)
        .json({ error: "플래그(flag)와 단지 이름은 필수 입력값입니다." });
    }

    const complexSnap = await complexDB
      .orderByChild("name")
      .equalTo(complexName)
      .once("value");
    if (!complexSnap.exists()) {
      return res.status(500).json({ error: "단지를 찾을 수 없습니다." });
    }

    const complexId = Object.keys(complexSnap.val())[0];

    switch (flag) {
      case "CPX":
        await complexDB.child(complexId).remove();
        res.status(200).json({ message: "단지가 성공적으로 삭제되었습니다." });
        break;

      case "APT":
        if (apartmentIndex === undefined) {
          return res.status(400).json({ error: "아파트 인덱스가 필요합니다." });
        }

        const apts = complexSnap.val()[complexId].apartments || [];
        if (apartmentIndex < 0 || apartmentIndex >= apts.length) {
          return res.status(400).json({ error: "잘못된 아파트 인덱스입니다." });
        }

        apts.splice(apartmentIndex, 1);
        await complexDB.child(complexId).update({ apartments: apts });

        res
          .status(200)
          .json({ message: "아파트가 성공적으로 삭제되었습니다." });
        break;

      default:
        res.status(400).json({ error: "잘못된 플래그 값입니다." });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
