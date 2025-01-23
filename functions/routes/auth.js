const express = require("express");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const router = express.Router();
const db = admin.database();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "your_secret_key";

// 회원가입 엔드포인트
router.post("/signup", async (req, res) => {
  const { user_id, user_pw } = req.body;

  if (!user_id || !user_pw) {
    return res
      .status(400)
      .json({ code: -1000, message: "user_id와 user_pw를 입력하세요." });
  }

  try {
    const hashedPw = await bcrypt.hash(user_pw, 10);
    const userRef = db.ref("users").child(user_id);
    const snapshot = await userRef.once("value");

    if (snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -1001, message: "이미 존재하는 user_id입니다." });
    }

    const timestamp = new Date().toISOString();
    await userRef.set({
      user_id,
      user_pw: hashedPw,
      createdAt: timestamp,
      lastActiveAt: timestamp,
    });

    res.status(201).json({ message: "회원가입 성공" });
  } catch (error) {
    res
      .status(500)
      .json({ code: -1002, message: "회원가입 중 서버 오류가 발생했습니다." });
  }
});

// 로그인 엔드포인트
router.post("/login", async (req, res) => {
  const { user_id, user_pw } = req.body;

  if (!user_id || !user_pw) {
    return res
      .status(400)
      .json({ code: -1000, message: "user_id와 user_pw를 입력하세요." });
  }

  try {
    const userRef = db.ref("users").child(user_id);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -1001, message: "존재하지 않는 user_id입니다." });
    }

    const userData = snapshot.val();
    const isMatch = await bcrypt.compare(user_pw, userData.user_pw);

    if (!isMatch) {
      return res
        .status(400)
        .json({ code: -1003, message: "비밀번호가 일치하지 않습니다." });
    }

    const token = jwt.sign({ user_id: userData.user_id }, JWT_SECRET_KEY, {
      expiresIn: "1h",
    });
    const lastActiveAt = new Date().toISOString();
    await userRef.update({ lastActiveAt });

    res.status(200).json({ message: "로그인 성공", token, lastActiveAt });
  } catch (error) {
    res.status(500).json({
      code: -1004,
      message: "로그인 처리 중 서버 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
