const express = require("express");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const router = express.Router();
const db = admin.database();

const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || "your_secret_key";

// 관리자 회원가입 엔드포인트
router.post("/admin/signup", async (req, res) => {
  const { admin_id, admin_pw } = req.body;

  if (!admin_id || !admin_pw) {
    return res
      .status(400)
      .json({ code: -2000, message: "admin_id와 admin_pw를 입력하세요." });
  }

  try {
    const hashedPw = await bcrypt.hash(admin_pw, 10);
    const adminRef = db.ref("admins").child(admin_id);
    const snapshot = await adminRef.once("value");

    if (snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -2001, message: "이미 존재하는 admin_id입니다." });
    }

    const timestamp = new Date().toISOString();
    await adminRef.set({
      admin_id,
      admin_pw: hashedPw,
      createdAt: timestamp,
      lastActiveAt: timestamp,
    });

    res.status(201).json({ message: "관리자 회원가입 성공" });
  } catch (error) {
    res.status(500).json({
      code: -2002,
      message: "관리자 회원가입 중 서버 오류가 발생했습니다.",
    });
  }
});

// 관리자 로그인 엔드포인트
router.post("/admin/login", async (req, res) => {
  const { admin_id, admin_pw } = req.body;

  if (!admin_id || !admin_pw) {
    return res
      .status(400)
      .json({ code: -2000, message: "admin_id와 admin_pw를 입력하세요." });
  }

  try {
    const adminRef = db.ref("admins").child(admin_id);
    const snapshot = await adminRef.once("value");

    if (!snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -2001, message: "존재하지 않는 admin_id입니다." });
    }

    const adminData = snapshot.val();
    const isMatch = await bcrypt.compare(admin_pw, adminData.admin_pw);

    if (!isMatch) {
      return res
        .status(400)
        .json({ code: -2003, message: "비밀번호가 일치하지 않습니다." });
    }

    const token = jwt.sign({ admin_id: adminData.admin_id }, JWT_SECRET_KEY, {
      expiresIn: "1h",
    });
    const lastActiveAt = new Date().toISOString();
    await adminRef.update({ lastActiveAt });

    res.status(200).json({
      message: "관리자 로그인 성공",
      token,
      lastActiveAt,
    });
  } catch (error) {
    res.status(500).json({
      code: -2004,
      message: "관리자 로그인 처리 중 서버 오류가 발생했습니다.",
    });
  }
});

// 관리자 목록 조회 엔드포인트
router.get("/admins", async (req, res) => {
  try {
    const adminsRef = db.ref("admins");
    const snapshot = await adminsRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        code: -2008,
        message: "등록된 관리자가 없습니다.",
      });
    }

    const admins = snapshot.val();
    res.status(200).json(admins);
  } catch (error) {
    res.status(500).json({
      code: -2009,
      message: "관리자 목록 조회 중 서버 오류가 발생했습니다.",
    });
  }
});

// 관리자 탈퇴 엔드포인트
router.delete("/admin/:admin_id", async (req, res) => {
  const { admin_id } = req.params;

  if (!admin_id) {
    return res
      .status(400)
      .json({ code: -2005, message: "admin_id를 입력하세요." });
  }

  try {
    const adminRef = db.ref("admins").child(admin_id);
    const snapshot = await adminRef.once("value");

    if (!snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -2006, message: "존재하지 않는 admin_id입니다." });
    }

    await adminRef.remove();
    res.status(200).json({ message: "관리자 탈퇴 성공" });
  } catch (error) {
    res.status(500).json({
      code: -2007,
      message: "관리자 탈퇴 처리 중 서버 오류가 발생했습니다.",
    });
  }
});

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

// 사용자 목록 조회 엔드포인트
router.get("/users", async (req, res) => {
  try {
    const usersRef = db.ref("users");
    const snapshot = await usersRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).json({
        code: -1008,
        message: "등록된 사용자가 없습니다.",
      });
    }

    const users = snapshot.val();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      code: -1009,
      message: "사용자 목록 조회 중 서버 오류가 발생했습니다.",
    });
  }
});

// 사용자 탈퇴 엔드포인트
router.delete("/:user_id", async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res
      .status(400)
      .json({ code: -1005, message: "user_id를 입력하세요." });
  }

  try {
    const userRef = db.ref("users").child(user_id);
    const snapshot = await userRef.once("value");

    if (!snapshot.exists()) {
      return res
        .status(400)
        .json({ code: -1006, message: "존재하지 않는 user_id입니다." });
    }

    await userRef.remove();
    res.status(200).json({ message: "사용자 탈퇴 성공" });
  } catch (error) {
    res.status(500).json({
      code: -1007,
      message: "사용자 탈퇴 처리 중 서버 오류가 발생했습니다.",
    });
  }
});

module.exports = router;
