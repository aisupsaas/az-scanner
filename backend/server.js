const express = require("express");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = process.env.PORT || 4000;

const ROOT_DIR = __dirname;
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

app.use(cors());
app.use(express.json());
app.use("/output", express.static(OUTPUT_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".png";
    const safeBase = path
      .basename(file.originalname || "upload", ext)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 60);

    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/tiff"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, WEBP, and TIFF images are allowed."));
    }
    cb(null, true);
  },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "az-scanner-backend" });
});

app.post("/process", upload.single("file"), async (req, res) => {
  let uploadedPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    uploadedPath = req.file.path;

    const baseId = path.parse(req.file.filename).name;
    const cleanedImagePath = path.join(OUTPUT_DIR, `${baseId}-cleaned.png`);
    const pdfPath = path.join(OUTPUT_DIR, `${baseId}.pdf`);
    const txtPath = path.join(OUTPUT_DIR, `${baseId}.txt`);

    await sharp(uploadedPath)
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toFile(cleanedImagePath);

    const ocrResult = await Tesseract.recognize(cleanedImagePath, "eng");
    const extractedText = (ocrResult?.data?.text || "").trim();

    fs.writeFileSync(txtPath, extractedText || "", "utf8");

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const margin = 40;
    const fontSize = 11;
    const lineHeight = 15;
    const maxWidth = page.getWidth() - margin * 2;
    const pageHeight = page.getHeight();

    const textToWrite = extractedText || "No text detected.";
    const words = textToWrite.split(/\s+/);
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);

    let y = pageHeight - margin;

    for (const line of lines) {
      if (y < margin) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = page.getHeight() - margin;
      }

      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth,
      });

      y -= lineHeight;
    }

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(pdfPath, pdfBytes);

    return res.json({
      success: true,
      text: extractedText,
      files: {
        cleanedImageUrl: `/output/${path.basename(cleanedImagePath)}`,
        pdfUrl: `/output/${path.basename(pdfPath)}`,
        txtUrl: `/output/${path.basename(txtPath)}`
      }
    });
  } catch (error) {
    console.error("Process error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to process file."
    });
  }
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({
    error: error?.message || "Unexpected server error."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AZ Scanner backend running on http://0.0.0.0:${PORT}`);
});