const express = require("express");
const admin = require("firebase-admin");
const axios = require("axios");
const router = express.Router();

// Firebase Realtime Database의 "complexes" 레퍼런스를 가져옴
const complexDB = admin.database().ref("complexes");

// 단지 추가 API
router.post("/", async (req, res) => {
  try {
    const { complexName, apartments = [] } = req.body;
    if (!complexName) {
      return res.status(400).json({ error: "단지 이름은 필수 입력값입니다." });
    }

    // 아파트 명이 하나의 문자열로 입력된 경우 배열로 변환
    const apartmentList =
      typeof apartments === "string" ? [apartments] : apartments;

    // 해당 단지가 이미 존재하는지 확인
    const snapshot = await complexDB
      .orderByChild("name")
      .equalTo(complexName)
      .once("value");

    if (snapshot.exists()) {
      // 기존 단지가 존재하는 경우 아파트 목록을 추가
      const complexKey = Object.keys(snapshot.val())[0];
      const existingApartments = snapshot.val()[complexKey].apartments || [];
      await complexDB.child(complexKey).update({
        apartments: [...new Set([...existingApartments, ...apartmentList])],
      });
      res.status(200).json({
        message: "아파트 목록이 성공적으로 업데이트되었습니다.",
        id: complexKey,
      });
    } else {
      // 새로운 단지를 추가
      const newComplexRef = complexDB.push();
      await newComplexRef.set({
        name: complexName,
        apartments: apartmentList,
      });
      res.status(201).json({
        message: "단지가 성공적으로 추가되었습니다.",
        id: newComplexRef.key,
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 단지 목록 조회 API
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

// 단지 수정 API
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { complexName, apartments } = req.body;

    const updateData = {};
    if (complexName) updateData.name = complexName;
    if (apartments) updateData.apartments = apartments;

    await complexDB.child(id).update(updateData);
    res.status(200).json({ message: "단지가 성공적으로 수정되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 단지 삭제 API
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await complexDB.child(id).remove();
    res.status(200).json({ message: "단지가 성공적으로 삭제되었습니다." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
