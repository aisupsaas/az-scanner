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
app.use(express.json({ limit: "1mb" }));
app.use("/output", express.static(OUTPUT_DIR));

function safeName(input) {
  return String(input || "upload")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function cleanOcrText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[|]{2,}/g, "|")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function wrapText(text, font, fontSize, maxWidth) {
  const paragraphs = String(text || "").split(/\n+/);
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);

    if (!words.length) {
      lines.push("");
      continue;
    }

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
    lines.push("");
  }

  return lines;
}

async function createTextPdf({ text, outputPath, filename }) {
  const pdfDoc = await PDFDocument.create();

  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize = [595.28, 841.89];
  const margin = 42;
  const titleFontSize = 14;
  const metaFontSize = 8;
  const bodyFontSize = 10.5;
  const bodyLineHeight = 15;

  let page = pdfDoc.addPage(pageSize);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const maxWidth = pageWidth - margin * 2;

  const title = "AZ Scanner Export";
  const createdAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function drawHeader(currentPage) {
    currentPage.drawText(title, {
      x: margin,
      y: pageHeight - margin,
      size: titleFontSize,
      font: boldFont,
      color: rgb(0.07, 0.07, 0.07),
    });

    currentPage.drawText(`Generated: ${createdAt}`, {
      x: margin,
      y: pageHeight - margin - 18,
      size: metaFontSize,
      font: regularFont,
      color: rgb(0.42, 0.42, 0.42),
    });

    currentPage.drawText(`Source: ${filename}`, {
      x: margin,
      y: pageHeight - margin - 31,
      size: metaFontSize,
      font: regularFont,
      color: rgb(0.42, 0.42, 0.42),
    });

    currentPage.drawLine({
      start: { x: margin, y: pageHeight - margin - 48 },
      end: { x: pageWidth - margin, y: pageHeight - margin - 48 },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });
  }

  drawHeader(page);

  const textToWrite = text || "No text detected.";
  const lines = wrapText(textToWrite, regularFont, bodyFontSize, maxWidth);

  let y = pageHeight - margin - 72;

  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage(pageSize);
      drawHeader(page);
      y = pageHeight - margin - 72;
    }

    if (!line.trim()) {
      y -= bodyLineHeight * 0.75;
      continue;
    }

    page.drawText(line, {
      x: margin,
      y,
      size: bodyFontSize,
      font: regularFont,
      color: rgb(0.08, 0.08, 0.08),
      maxWidth,
    });

    y -= bodyLineHeight;
  }

  const pageCount = pdfDoc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const currentPage = pdfDoc.getPage(i);
    currentPage.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: pageWidth - margin - 70,
      y: 24,
      size: 8,
      font: regularFont,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

async function cleanupOldFiles(dir, maxAgeMs = 1000 * 60 * 60 * 12) {
  try {
    const now = Date.now();
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (error) {
    console.warn("Cleanup warning:", error?.message || error);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".jpg";
    const safeBase = safeName(file.originalname || "upload");
    cb(null, `${Date.now()}-${safeBase}${ext.toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/tiff",
      "image/heic",
      "image/heif",
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error("Only JPG, PNG, WEBP, TIFF, HEIC, and HEIF images are allowed.")
      );
    }

    cb(null, true);
  },
});

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "az-scanner-backend" });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "az-scanner-backend" });
});

app.post("/process", upload.single("file"), async (req, res) => {
  let uploadedPath = null;

  try {
    await cleanupOldFiles(UPLOAD_DIR);
    await cleanupOldFiles(OUTPUT_DIR);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    uploadedPath = req.file.path;

    const baseId = path.parse(req.file.filename).name;
    const cleanedImagePath = path.join(OUTPUT_DIR, `${baseId}-cleaned.png`);
    const pdfPath = path.join(OUTPUT_DIR, `${baseId}.pdf`);
    const txtPath = path.join(OUTPUT_DIR, `${baseId}.txt`);

    const image = sharp(uploadedPath, {
      failOn: "none",
      limitInputPixels: 60_000_000,
    }).rotate();

    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return res.status(400).json({
        error: "Could not read image dimensions. Please try another image.",
      });
    }

    await image
      .resize({
        width: metadata.width > 2200 ? 2200 : metadata.width,
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .modulate({
        brightness: 1.04,
        contrast: 1.12,
      })
      .sharpen({
        sigma: 1.1,
        m1: 1.1,
        m2: 2.0,
      })
      .png({
        compressionLevel: 8,
        adaptiveFiltering: true,
      })
      .toFile(cleanedImagePath);

    const ocrResult = await Tesseract.recognize(cleanedImagePath, "eng", {
      logger: () => {},
    });

    const rawText = ocrResult?.data?.text || "";
    const extractedText = cleanOcrText(rawText);
    const confidence = Math.round(ocrResult?.data?.confidence || 0);

    fs.writeFileSync(txtPath, extractedText || "No text detected.", "utf8");

    await createTextPdf({
      text: extractedText,
      outputPath: pdfPath,
      filename: req.file.originalname || req.file.filename,
    });

    return res.json({
      success: true,
      text: extractedText || "No text detected.",
      confidence,
      files: {
        cleanedImageUrl: `/output/${path.basename(cleanedImagePath)}`,
        pdfUrl: `/output/${path.basename(pdfPath)}`,
        txtUrl: `/output/${path.basename(txtPath)}`,
      },
    });
  } catch (error) {
    console.error("Process error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to process file. Please try a clearer image with better lighting.",
    });
  } finally {
    if (uploadedPath && fs.existsSync(uploadedPath)) {
      try {
        fs.unlinkSync(uploadedPath);
      } catch (error) {
        console.warn("Upload cleanup warning:", error?.message || error);
      }
    }
  }
});

app.use((error, _req, res, _next) => {
  console.error("Unhandled error:", error);

  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "Image is too large. Please use an image under 12 MB.",
    });
  }

  return res.status(500).json({
    error: error?.message || "Unexpected server error.",
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`AZ Scanner backend running on http://0.0.0.0:${PORT}`);
});