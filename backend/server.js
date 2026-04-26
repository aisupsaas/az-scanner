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
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/output", express.static(OUTPUT_DIR));

const OCR_LOW_QUALITY_MESSAGE =
  "Text quality is too low to extract reliable text. Try a clearer, brighter, flatter photo with the document filling the frame.";

function safeName(input) {
  return String(input || "upload")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

function cleanLine(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function isGarbageLine(line) {
  const clean = cleanLine(line);
  if (!clean) return true;

  const letters = (clean.match(/[a-zA-Z]/g) || []).length;
  const digits = (clean.match(/[0-9]/g) || []).length;
  const useful = letters + digits;
  const weird = (clean.match(/[^a-zA-Z0-9\s.,:;'"!?$%&()\-+/#[\]]/g) || []).length;

  if (clean.length <= 2 && useful === 0) return true;
  if (clean.length >= 5 && useful / clean.length < 0.32) return true;
  if (weird / Math.max(clean.length, 1) > 0.3) return true;

  return false;
}

function normalizeOcrLines(ocrData) {
  const rawLines = Array.isArray(ocrData?.lines) ? ocrData.lines : [];

  if (!rawLines.length) {
    const fallback = String(ocrData?.text || "")
      .split(/\r?\n/)
      .map((text) => ({ text, confidence: ocrData?.confidence || 0, bbox: null }));

    return fallback
      .map((line) => ({
        text: cleanLine(line.text),
        confidence: Math.round(line.confidence || 0),
        bbox: line.bbox || null,
      }))
      .filter((line) => line.text && !isGarbageLine(line.text));
  }

  return rawLines
    .map((line) => ({
      text: cleanLine(line.text),
      confidence: Math.round(line.confidence || 0),
      bbox: line.bbox || null,
    }))
    .filter((line) => line.text && !isGarbageLine(line.text));
}

function buildLayoutText(lines) {
  if (!lines.length) return "";

  const withY = lines
    .map((line, index) => ({
      ...line,
      index,
      y0: line?.bbox?.y0 ?? index * 20,
      y1: line?.bbox?.y1 ?? index * 20 + 14,
      x0: line?.bbox?.x0 ?? 0,
    }))
    .sort((a, b) => {
      const yDiff = a.y0 - b.y0;
      if (Math.abs(yDiff) > 8) return yDiff;
      return a.x0 - b.x0;
    });

  const heights = withY
    .map((line) => Math.max(8, (line.y1 || 0) - (line.y0 || 0)))
    .filter(Boolean);

  const avgHeight =
    heights.reduce((sum, value) => sum + value, 0) / Math.max(heights.length, 1);

  const output = [];

  for (let i = 0; i < withY.length; i++) {
    const line = withY[i];

    if (i > 0) {
      const prev = withY[i - 1];
      const gap = line.y0 - prev.y1;

      if (gap > avgHeight * 1.35) {
        output.push("");
      }
    }

    output.push(line.text);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function scoreTextQuality(text, confidence) {
  const clean = String(text || "").trim();
  if (!clean) return { usable: false, score: 0 };

  const chars = clean.length;
  const letters = (clean.match(/[a-zA-Z]/g) || []).length;
  const digits = (clean.match(/[0-9]/g) || []).length;
  const spaces = (clean.match(/\s/g) || []).length;
  const weird = (clean.match(/[^a-zA-Z0-9\s.,:;'"!?$%&()\-+/#[\]]/g) || []).length;

  const usefulRatio = (letters + digits + spaces) / Math.max(chars, 1);
  const weirdRatio = weird / Math.max(chars, 1);

  let score = 0;
  score += Math.min(Math.max(confidence, 0), 100) * 0.55;
  score += usefulRatio * 35;
  score -= weirdRatio * 45;

  if (chars < 12) score -= 20;
  if (letters + digits < 8) score -= 25;

  const usable = score >= 42 && confidence >= 28 && usefulRatio >= 0.58 && weirdRatio <= 0.22;

  return {
    usable,
    score: Math.round(Math.max(0, Math.min(score, 100))),
  };
}

function wrapText(text, font, fontSize, maxWidth) {
  const lines = [];

  for (const inputLine of String(text || "").split("\n")) {
    const trimmed = inputLine.trim();

    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);
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
  }

  return lines;
}

async function createTextPdf({
  text,
  outputPath,
  filename,
  confidence,
  qualityScore,
}) {
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

  const createdAt = new Date().toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function drawHeader(currentPage) {
    currentPage.drawText("AZ Scanner Export", {
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

    currentPage.drawText(`OCR confidence: ${confidence}%   Quality score: ${qualityScore}/100`, {
      x: margin,
      y: pageHeight - margin - 44,
      size: metaFontSize,
      font: regularFont,
      color: rgb(0.42, 0.42, 0.42),
    });

    currentPage.drawLine({
      start: { x: margin, y: pageHeight - margin - 58 },
      end: { x: pageWidth - margin, y: pageHeight - margin - 58 },
      thickness: 0.5,
      color: rgb(0.82, 0.82, 0.82),
    });
  }

  drawHeader(page);

  const lines = wrapText(text || OCR_LOW_QUALITY_MESSAGE, regularFont, bodyFontSize, maxWidth);
  let y = pageHeight - margin - 82;

  for (const line of lines) {
    if (y < margin) {
      page = pdfDoc.addPage(pageSize);
      drawHeader(page);
      y = pageHeight - margin - 82;
    }

    if (!line.trim()) {
      y -= bodyLineHeight * 0.85;
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
    pdfDoc.getPage(i).drawText(`Page ${i + 1} of ${pageCount}`, {
      x: pageWidth - margin - 70,
      y: 24,
      size: 8,
      font: regularFont,
      color: rgb(0.55, 0.55, 0.55),
    });
  }

  fs.writeFileSync(outputPath, await pdfDoc.save());
}

async function cleanupOldFiles(dir, maxAgeMs = 1000 * 60 * 60 * 12) {
  try {
    const now = Date.now();

    for (const entry of fs.readdirSync(dir)) {
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
  limits: { fileSize: 12 * 1024 * 1024 },
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
      return cb(new Error("Only JPG, PNG, WEBP, TIFF, HEIC, and HEIF images are allowed."));
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

    const resizedWidth = metadata.width > 2400 ? 2400 : metadata.width;

    await image
      .resize({
        width: resizedWidth,
        withoutEnlargement: true,
      })
      .grayscale()
      .normalize()
      .linear(1.18, -12)
      .median(1)
      .sharpen({
        sigma: 1.1,
        m1: 1.15,
        m2: 2.1,
      })
      .png({
        compressionLevel: 8,
        adaptiveFiltering: true,
      })
      .toFile(cleanedImagePath);

    const ocrResult = await Tesseract.recognize(cleanedImagePath, "eng", {
      logger: () => {},
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });

    const rawConfidence = Math.round(ocrResult?.data?.confidence || 0);
    const layoutLines = normalizeOcrLines(ocrResult?.data);
    const layoutText = buildLayoutText(layoutLines);
    const quality = scoreTextQuality(layoutText, rawConfidence);

    const finalText = quality.usable ? layoutText : OCR_LOW_QUALITY_MESSAGE;

    fs.writeFileSync(txtPath, finalText, "utf8");

    await createTextPdf({
      text: finalText,
      outputPath: pdfPath,
      filename: req.file.originalname || req.file.filename,
      confidence: rawConfidence,
      qualityScore: quality.score,
    });

    return res.json({
      success: true,
      text: finalText,
      confidence: rawConfidence,
      qualityScore: quality.score,
      usableText: quality.usable,
      warning: quality.usable ? "" : OCR_LOW_QUALITY_MESSAGE,
      lineCount: layoutLines.length,
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