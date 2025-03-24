const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

// Firebase Realtime Database의 "complexes" 레퍼런스를 가져옴
const complexDB = admin.database().ref("complexes");

// **단지 및 아파트 추가 API**
router.post("/", async (req, res) => {
  try {
    const { flag, complexName, apartments } = req.body;

    if (!flag) {
      return res
        .status(400)
        .json({ error: "플래그(flag)는 필수 입력값입니다." });
    }

    switch (flag) {
      case "CPX":
        // **단지 추가**
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
          apartments: [], // 아파트 목록 초기화
        });

        res.status(201).json({
          message: "단지가 성공적으로 추가되었습니다.",
          id: newComplexRef.key,
        });
        break;

      case "APT":
        // **아파트 추가**
        if (!complexName || !apartments || apartments.length === 0) {
          return res.status(400).json({
            error: "단지 이름과 추가할 아파트 목록이 필요합니다.",
          });
        }

        const apartmentList = Array.isArray(apartments)
          ? apartments
          : [apartments];

        const aptSnapshot = await complexDB
          .orderByChild("name")
          .equalTo(complexName)
          .once("value");

        if (!aptSnapshot.exists()) {
          return res.status(404).json({ error: "단지를 찾을 수 없습니다." });
        }

        const complexKey = Object.keys(aptSnapshot.val())[0];
        const existingApartments =
          aptSnapshot.val()[complexKey].apartments || [];

        await complexDB.child(complexKey).update({
          apartments: [...new Set([...existingApartments, ...apartmentList])],
        });

        res.status(200).json({
          message: "아파트 목록이 성공적으로 업데이트되었습니다.",
          apartments: [...existingApartments, ...apartmentList],
        });
        break;

      default:
        res.status(400).json({ error: "잘못된 플래그 값입니다." });
        break;
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
      return res.status(404).json({ message: "등록된 단지가 없습니다." });
    }
    res.status(200).json(snapshot.val());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// **단지 및 아파트 수정 API**
router.put("/", async (req, res) => {
  try {
    const {
      flag,
      complexId,
      complexName,
      apartments,
      apartmentIndex,
      apartmentName,
    } = req.body;

    if (!flag) {
      return res
        .status(400)
        .json({ error: "플래그(flag)는 필수 입력값입니다." });
    }

    switch (flag) {
      case "CPX":
        // **단지 수정**
        if (!complexId) {
          return res
            .status(400)
            .json({ error: "단지 ID는 필수 입력값입니다." });
        }

        const updateData = {};
        if (complexName) updateData.name = complexName;
        if (apartments) updateData.apartments = apartments;

        await complexDB.child(complexId).update(updateData);
        res.status(200).json({ message: "단지가 성공적으로 수정되었습니다." });
        break;

      case "APT":
        // **아파트 수정**
        if (!complexId || apartmentIndex === undefined || !apartmentName) {
          return res.status(400).json({
            error: "단지 ID, 아파트 인덱스, 아파트 이름이 필요합니다.",
          });
        }

        const complexSnap = await complexDB.child(complexId).once("value");
        if (!complexSnap.exists()) {
          return res.status(404).json({ error: "단지를 찾을 수 없습니다." });
        }

        const currentApts = complexSnap.val().apartments || [];

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

// **단지 및 아파트 삭제 API**
router.delete("/", async (req, res) => {
  try {
    const { flag, complexId, apartmentIndex } = req.body;

    if (!flag) {
      return res
        .status(400)
        .json({ error: "플래그(flag)는 필수 입력값입니다." });
    }

    switch (flag) {
      case "CPX":
        // **단지 삭제**
        if (!complexId) {
          return res
            .status(400)
            .json({ error: "단지 ID는 필수 입력값입니다." });
        }

        await complexDB.child(complexId).remove();
        res.status(200).json({ message: "단지가 성공적으로 삭제되었습니다." });
        break;

      case "APT":
        // **아파트 삭제**
        if (!complexId || apartmentIndex === undefined) {
          return res.status(400).json({
            error: "단지 ID와 아파트 인덱스는 필수입니다.",
          });
        }

        const complexSnap = await complexDB.child(complexId).once("value");
        if (!complexSnap.exists()) {
          return res.status(404).json({ error: "단지를 찾을 수 없습니다." });
        }

        const apts = complexSnap.val().apartments || [];
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
