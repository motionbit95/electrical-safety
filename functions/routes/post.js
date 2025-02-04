const express = require("express");
const admin = require("firebase-admin");

const router = express.Router();
// Realtime Database 레퍼런스
const noticeDB = admin.database().ref("posts");
const faqDB = admin.database().ref("faqs");

// Notice 모델 정의 (클래스 방식)
class Notice {
  constructor(title, content, author) {
    this.title = title;
    this.content = content;
    this.author = author;
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
  const { title, content, author } = req.body;

  if (!title || !content || !author) {
    return res.status(400).send("Missing required fields");
  }

  const newNotice = new Notice(title, content, author);

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

module.exports = router;
