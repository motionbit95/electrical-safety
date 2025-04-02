const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const uploadImageToFirebase = async (file) => {
  try {
    if (!file) {
      throw new Error("파일이 제공되지 않았습니다.");
    }

    const bucket = admin.storage().bucket();
    const filename = `${uuidv4()}${path.extname(file.originalname)}`;
    const fileUpload = bucket.file(filename);

    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    new Promise((resolve, reject) => {
      stream.on("error", (error) => reject(error));
      stream.on("finish", async () => {
        await fileUpload.makePublic();
        resolve(`https://storage.googleapis.com/${bucket.name}/${filename}`);
      });

      stream.end(file.buffer);
    });

    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { upload, uploadImageToFirebase };
