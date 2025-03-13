const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
// Realtime Database 레퍼런스
const noticeDB = admin.database().ref("posts");
const faqDB = admin.database().ref("faqs");
const inquiryDB = admin.database().ref("inquiries");

// Notice 모델 정의 (클래스 방식)
class Notice {
  constructor(title, content, author, type) {
    this.title = title;
    this.content = content;
    this.author = author;
    this.type = type || "공지";
    this.createdAt = admin.database.ServerValue.TIMESTAMP; // 타임스탬프
  }
}

// FAQ 모델 정의 (클래스 방식)
class FAQ {
  constructor(question, answer) {
    this.question = question;
    this.answer = answer;
    this.createdAt = admin.database.ServerValue.TIMESTAMP; // 타임스탬프
  }
}

// 공지사항 생성
router.post("/notice", async (req, res) => {
  const { title, content, author, type } = req.body;

  if (!title || !content || !author) {
    return res.status(400).send("Missing required fields");
  }

  const newNotice = new Notice(title, content, author, type);

  try {
    const postRef = noticeDB.push();
    await postRef.set(newNotice);
    res
      .status(201)
      .send({ message: "Post created successfully", postId: postRef.key });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).send("Internal Server Error");
  }
});

// FAQ 생성
router.post("/faq", async (req, res) => {
  const { question, answer } = req.body;

  if (!question || !answer) {
    return res.status(400).send("Missing required fields");
  }

  const newFAQ = new FAQ(question, answer);

  try {
    const faqRef = faqDB.push();
    await faqRef.set(newFAQ);
    res
      .status(201)
      .send({ message: "FAQ created successfully", faqId: faqRef.key });
  } catch (error) {
    console.error("Error creating FAQ:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 공지사항 조회
router.get("/notice/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const postRef = noticeDB.child(postId);
    const snapshot = await postRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("Post not found");
    }
    res.status(200).send(snapshot.val());
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).send("Internal Server Error");
  }
});

// FAQ 조회
router.get("/faq/:id", async (req, res) => {
  const faqId = req.params.id;

  try {
    const faqRef = faqDB.child(faqId);
    const snapshot = await faqRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("FAQ not found");
    }
    res.status(200).send(snapshot.val());
  } catch (error) {
    console.error("Error fetching FAQ:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 공지사항 전체 리스트 조회
router.get("/notice", async (req, res) => {
  try {
    const snapshot = await noticeDB.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("No posts found");
    }

    const posts = [];
    snapshot.forEach((childSnapshot) => {
      posts.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      });
    });

    res.status(200).send(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).send("Internal Server Error");
  }
});

// FAQ 전체 리스트 조회
router.get("/faq", async (req, res) => {
  try {
    const snapshot = await faqDB.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("No FAQ found");
    }

    const faqs = [];
    snapshot.forEach((childSnapshot) => {
      faqs.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      });
    });

    res.status(200).send(faqs);
  } catch (error) {
    console.error("Error fetching FAQs:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 공지사항 업데이트
router.put("/notice/:id", async (req, res) => {
  const postId = req.params.id;
  const { title, content, author } = req.body;

  if (!title && !content && !author) {
    return res.status(400).send("No fields to update");
  }

  const updatedNotice = new Notice(title, content, author);
  updatedNotice.updatedAt = admin.database.ServerValue.TIMESTAMP;

  try {
    const postRef = noticeDB.child(postId);
    await postRef.update(updatedNotice);
    res.status(200).send({ message: "Post updated successfully" });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).send("Internal Server Error");
  }
});

// FAQ 업데이트
router.put("/faq/:id", async (req, res) => {
  const faqId = req.params.id;
  const { question, answer } = req.body;

  if (!question && !answer) {
    return res.status(400).send("No fields to update");
  }

  const updatedFAQ = new FAQ(question, answer);
  updatedFAQ.updatedAt = admin.database.ServerValue.TIMESTAMP;

  try {
    const faqRef = faqDB.child(faqId);
    await faqRef.update(updatedFAQ);
    res.status(200).send({ message: "FAQ updated successfully" });
  } catch (error) {
    console.error("Error updating FAQ:", error);
    res.status(500).send("Internal Server Error");
  }
});

// 공지사항 삭제
router.delete("/notice/:id", async (req, res) => {
  const postId = req.params.id;

  try {
    const postRef = noticeDB.child(postId);
    await postRef.remove();
    res.status(200).send({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("Internal Server Error");
  }
});

// FAQ 삭제
router.delete("/faq/:id", async (req, res) => {
  const faqId = req.params.id;

  try {
    const faqRef = faqDB.child(faqId);
    await faqRef.remove();
    res.status(200).send({ message: "FAQ deleted successfully" });
  } catch (error) {
    console.error("Error deleting FAQ:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Inquiry 모델 정의 (클래스 방식)
class Inquiry {
  constructor(userId, title, content) {
    this.userId = userId;
    this.title = title;
    this.content = content;
    this.answer = ""; // 답변 필드 추가 (기본값: 없음)
    this.createdAt = admin.database.ServerValue.TIMESTAMP;
    this.status = "pending"; // 기본 상태: 대기 중
  }
}

// 1:1 문의 생성
router.post("/inquiry", async (req, res) => {
  const { userId, title, content } = req.body;

  if (!userId || !title || !content) {
    return res.status(400).send("필수 항목이 누락되었습니다.");
  }

  const newInquiry = new Inquiry(userId, title, content);

  try {
    const inquiryRef = inquiryDB.push();
    await inquiryRef.set(newInquiry);
    res.status(201).send({
      message: "문의가 성공적으로 생성되었습니다.",
      inquiryId: inquiryRef.key,
    });
  } catch (error) {
    console.error("문의 생성 오류:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 1:1 문의 조회
router.get("/inquiry/:id", async (req, res) => {
  const inquiryId = req.params.id;

  try {
    const inquiryRef = inquiryDB.child(inquiryId);
    const snapshot = await inquiryRef.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("문의가 존재하지 않습니다.");
    }
    res.status(200).send(snapshot.val());
  } catch (error) {
    console.error("문의 조회 오류:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 1:1 문의 전체 리스트 조회
router.get("/inquiry", async (req, res) => {
  try {
    const snapshot = await inquiryDB.once("value");
    if (!snapshot.exists()) {
      return res.status(404).send("문의가 없습니다.");
    }

    const inquiries = [];
    snapshot.forEach((childSnapshot) => {
      inquiries.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      });
    });

    res.status(200).send(inquiries);
  } catch (error) {
    console.error("문의 조회 오류:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 1:1 문의 업데이트 (예: 상태 변경, 내용 수정 등)
router.put("/inquiry/:id", async (req, res) => {
  const inquiryId = req.params.id;
  const { title, content, status } = req.body;

  if (!title && !content && !status) {
    return res.status(400).send("업데이트할 항목이 없습니다.");
  }

  try {
    const inquiryRef = inquiryDB.child(inquiryId);
    const updates = {};
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (status) updates.status = status;
    updates.updatedAt = admin.database.ServerValue.TIMESTAMP;

    await inquiryRef.update(updates);
    res.status(200).send({ message: "문의가 성공적으로 업데이트되었습니다." });
  } catch (error) {
    console.error("문의 업데이트 오류:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 1:1 문의 삭제
router.delete("/inquiry/:id", async (req, res) => {
  const inquiryId = req.params.id;

  try {
    const inquiryRef = inquiryDB.child(inquiryId);
    await inquiryRef.remove();
    res.status(200).send({ message: "문의가 성공적으로 삭제되었습니다." });
  } catch (error) {
    console.error("문의 삭제 오류:", error);
    res.status(500).send("서버 내부 오류");
  }
});

// 특정 사용자 ID의 1:1 문의 조회
router.get("/inquiry/user/:userId", async (req, res) => {
  const userId = req.params.userId;

  try {
    const snapshot = await inquiryDB
      .orderByChild("userId")
      .equalTo(userId)
      .once("value");

    if (!snapshot.exists()) {
      return res
        .status(404)
        .send({ message: "이 사용자에 대한 문의가 없습니다." });
    }

    const inquiries = [];
    snapshot.forEach((childSnapshot) => {
      inquiries.push({
        id: childSnapshot.key,
        ...childSnapshot.val(),
      });
    });

    res.status(200).send(inquiries);
  } catch (error) {
    console.error("사용자 문의 조회 오류:", error);
    res.status(500).send({ message: "서버 내부 오류" });
  }
});

// 1:1 문의 답변 작성
router.post("/inquiry/:id/answer", async (req, res) => {
  const inquiryId = req.params.id;
  const { answer } = req.body;

  if (!answer) {
    return res.status(400).send({ message: "답변은 필수입니다." });
  }

  try {
    const inquiryRef = inquiryDB.child(inquiryId);
    const snapshot = await inquiryRef.once("value");

    if (!snapshot.exists()) {
      return res.status(404).send({ message: "문의가 존재하지 않습니다." });
    }

    const updates = {
      answer,
      status: "answered",
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    };

    await inquiryRef.update(updates);

    res.status(200).send({ message: "답변이 성공적으로 제출되었습니다." });
  } catch (error) {
    console.error("답변 제출 오류:", error);
    res.status(500).send({ message: "서버 내부 오류" });
  }
});

module.exports = router;
