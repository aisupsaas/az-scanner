require("dotenv").config();

const express = require("express");
const cors = require("cors");
const processProRoute = require("./routes/process-pro");
const multer = require("multer");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const Tesseract = require("tesseract.js");
const { Document, Packer, Paragraph, TextRun } = require("docx");

const app = express();
const PORT = process.env.PORT || 4000;
const ROOT_DIR = __dirname;
const UPLOAD_DIR = path.join(ROOT_DIR, "uploads");
const OUTPUT_DIR = path.join(ROOT_DIR, "output");

for (const dir of [UPLOAD_DIR, OUTPUT_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (
      origin === "http://localhost:3000" ||
      origin.includes("vercel.app")
    ) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
}));

app.use(express.json({ limit: "20mb" }));
app.use("/process-pro", processProRoute);

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

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
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
  if (clean.length >= 5 && useful / clean.length < 0.34) return true;
  if (weird / Math.max(clean.length, 1) > 0.24) return true;

  return false;
}

function normalizeOcrLines(ocrData, pageIndex = 0) {
  const rawLines = Array.isArray(ocrData?.lines) ? ocrData.lines : [];

  const lines = rawLines.length
    ? rawLines
    : String(ocrData?.text || "")
        .split(/\r?\n/)
        .map((text, index) => ({
          text,
          confidence: ocrData?.confidence || 0,
          bbox: {
            x0: 0,
            y0: index * 20,
            x1: 100,
            y1: index * 20 + 14,
          },
        }));

  return lines
    .map((line, index) => ({
      id: `page-${pageIndex + 1}-line-${index + 1}`,
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
      if (gap > avgHeight * 1.35) output.push("");
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

function outputPathFromPublicUrl(publicUrl) {
  const basename = path.basename(String(publicUrl || ""));
  const fullPath = path.join(OUTPUT_DIR, basename);

  if (!basename || !fullPath.startsWith(OUTPUT_DIR)) {
    throw new Error("Invalid output file path.");
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error("Source image is no longer available. Please process the scan again.");
  }

  return fullPath;
}

async function buildEditedScanImageBuffer({
  imagePath,
  rotate = 0,
  brightness = 1,
  crop = {},
}) {
  const safeRotate = clampNumber(rotate, 0, 270, 0);
  const normalizedRotate = [0, 90, 180, 270].includes(safeRotate) ? safeRotate : 0;

  const safeBrightness = clampNumber(brightness, 0.75, 1.35, 1);

  const cropLeft = clampNumber(crop.left, 0, 35, 0);
  const cropRight = clampNumber(crop.right, 0, 35, 0);
  const cropTop = clampNumber(crop.top, 0, 35, 0);
  const cropBottom = clampNumber(crop.bottom, 0, 35, 0);

  let pipeline = sharp(imagePath, {
    failOn: "none",
    limitInputPixels: 60_000_000,
  }).rotate(normalizedRotate);

  const metadata = await pipeline.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions.");
  }

  const leftPx = Math.floor(metadata.width * (cropLeft / 100));
  const rightPx = Math.floor(metadata.width * (cropRight / 100));
  const topPx = Math.floor(metadata.height * (cropTop / 100));
  const bottomPx = Math.floor(metadata.height * (cropBottom / 100));

  const cropWidth = metadata.width - leftPx - rightPx;
  const cropHeight = metadata.height - topPx - bottomPx;

  if (cropWidth > 100 && cropHeight > 100) {
    pipeline = pipeline.extract({
      left: leftPx,
      top: topPx,
      width: cropWidth,
      height: cropHeight,
    });
  }

  return pipeline
    .modulate({
      brightness: safeBrightness,
    })
    .resize({
      width: 2400,
      withoutEnlargement: true,
    })
    .png({
      compressionLevel: 8,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

async function addImagePageToPdf(pdfDoc, imageBuffer) {
  const image = await pdfDoc.embedPng(imageBuffer);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 18;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);

  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;

  const scale = Math.min(
    availableWidth / image.width,
    availableHeight / image.height
  );

  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;

  page.drawImage(image, {
    x: (pageWidth - drawWidth) / 2,
    y: (pageHeight - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

async function createMultiPageScanPdfBuffer(pages) {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages.slice(0, 10)) {
    const imagePath = outputPathFromPublicUrl(page.imageUrl);

    const imageBuffer = await buildEditedScanImageBuffer({
      imagePath,
      rotate: page.rotate,
      brightness: page.brightness,
      crop: page.crop || {},
    });

    await addImagePageToPdf(pdfDoc, imageBuffer);
  }

  if (pdfDoc.getPageCount() < 1) {
    throw new Error("No pages available for PDF.");
  }

  return Buffer.from(await pdfDoc.save());
}

async function createSingleScanPdfFile({ imagePath, outputPath }) {
  const imageBuffer = await buildEditedScanImageBuffer({
    imagePath,
    rotate: 0,
    brightness: 1,
    crop: {},
  });

  const pdfDoc = await PDFDocument.create();
  await addImagePageToPdf(pdfDoc, imageBuffer);
  fs.writeFileSync(outputPath, await pdfDoc.save());
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

async function createTextPdfBuffer({ text, filename = "AZ Scanner Text" }) {
  const pdfDoc = await PDFDocument.create();

  const fontkit = require("@pdf-lib/fontkit");
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = fs.readFileSync(path.join(__dirname, "fonts", "Inter-Regular.ttf"));
  const regularFont = await pdfDoc.embedFont(fontBytes);

  const pageSize = [595.28, 841.89];
  const margin = 42;
  const pageWidth = pageSize[0];
  const pageHeight = pageSize[1];
  const maxWidth = pageWidth - margin * 2;

  const bodyFontSize = 10.5;
  const bodyLineHeight = 15;

  function addCleanPage() {
    return pdfDoc.addPage(pageSize);
  }

  function drawBodyLine(page, line, y) {
    page.drawText(line, {
      x: margin,
      y,
      size: bodyFontSize,
      font: regularFont,
      color: rgb(0.08, 0.08, 0.08),
      maxWidth,
    });
  }

  const safeText = String(text || "").trim() || "No text provided.";

  const pageChunks = safeText
    .split(/\n\s*\n(?=Page\s+\d+\s*\n)/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const chunks = pageChunks.length ? pageChunks : [safeText];

  for (const chunk of chunks) {
    let page = addCleanPage();
    let y = pageHeight - margin;

    const cleanedChunk = chunk.replace(/^Page\s+\d+\s*\n/i, "").trim();
    const lines = wrapText(cleanedChunk || "No text provided.", regularFont, bodyFontSize, maxWidth);

    for (const line of lines) {
      if (y < margin) {
        page = addCleanPage();
        y = pageHeight - margin;
      }

      if (!line.trim()) {
        y -= bodyLineHeight * 0.85;
        continue;
      }

      drawBodyLine(page, line, y);
      y -= bodyLineHeight;
    }
  }

  return Buffer.from(await pdfDoc.save());
}

async function createTextDocxBuffer({ text }) {
  const safeText = String(text || "").trim() || "No text provided.";

  const paragraphs = safeText
    .split(/\r?\n/)
    .map((line) =>
      new Paragraph({
        children: [
          new TextRun({
            text: line || " ",
            size: 22,
          }),
        ],
      })
    );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return Packer.toBuffer(doc);
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
    cb(null, `${Date.now()}-${safeBase}-${cryptoRandom()}${ext.toLowerCase()}`);
  },
});

function cryptoRandom() {
  return Math.random().toString(36).slice(2, 8);
}

const upload = multer({
  storage,
  limits: { fileSize: 12 * 1024 * 1024, files: 10 },
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

app.post("/export/original-pdf", async (req, res) => {
  try {
    const pages = Array.isArray(req.body?.pages)
      ? req.body.pages
      : req.body?.imageUrl
        ? [
            {
              imageUrl: req.body.imageUrl,
              rotate: req.body.rotate,
              brightness: req.body.brightness,
              crop: req.body.crop || {},
            },
          ]
        : [];

    if (!pages.length) {
      return res.status(400).json({ error: "No PDF pages provided." });
    }

    const pdfBuffer = await createMultiPageScanPdfBuffer(pages);
    const filename = safeName(req.body?.filename || "az-scanner-original");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Original PDF export error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to create original PDF.",
    });
  }
});

app.post("/export/text-pdf", async (req, res) => {
  try {
    const text = String(req.body?.text || "").slice(0, 250_000);
    const filename = safeName(req.body?.filename || "az-scanner-text");

    const pdfBuffer = await createTextPdfBuffer({
      text,
      filename,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Text PDF export error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to create text PDF.",
    });
  }
});

app.post("/export/text-docx", async (req, res) => {
  try {
    const text = String(req.body?.text || "").slice(0, 250_000);
    const filename = safeName(req.body?.filename || "az-scanner-text");

    const docxBuffer = await createTextDocxBuffer({ text });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.docx"`);

    return res.send(docxBuffer);
  } catch (error) {
    console.error("DOCX export error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to create Word DOCX.",
    });
  }
});

app.post("/process", upload.array("files", 10), async (req, res) => {
  const uploadedPaths = [];

  try {
    await cleanupOldFiles(UPLOAD_DIR);
    await cleanupOldFiles(OUTPUT_DIR);

    const files = Array.isArray(req.files) ? req.files.slice(0, 10) : [];

    if (!files.length) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    for (const f of files) uploadedPaths.push(f.path);

    const originalPdfImageUrls = [];
    const cleanedImageUrls = [];
    const allLines = [];
    const textSections = [];
    const confidences = [];
    const qualityScores = [];

    let firstPdfPath = "";
    let firstTxtPath = "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const baseId = path.parse(file.filename).name;
      const originalPdfImagePath = path.join(OUTPUT_DIR, `${baseId}-original.png`);
      const cleanedImagePath = path.join(OUTPUT_DIR, `${baseId}-cleaned.png`);
      const pdfPath = path.join(OUTPUT_DIR, `${baseId}.pdf`);
      const txtPath = path.join(OUTPUT_DIR, `${baseId}.txt`);

      if (i === 0) {
        firstPdfPath = pdfPath;
        firstTxtPath = txtPath;
      }

      await sharp(file.path, {
        failOn: "none",
        limitInputPixels: 60_000_000,
      })
        .rotate()
        .resize({
          width: 2400,
          withoutEnlargement: true,
        })
        .png({
          compressionLevel: 8,
          adaptiveFiltering: true,
        })
        .toFile(originalPdfImagePath);

      const image = sharp(file.path, {
        failOn: "none",
        limitInputPixels: 60_000_000,
      }).rotate();

      const metadata = await image.metadata();

      if (!metadata.width || !metadata.height) {
        throw new Error("Could not read image dimensions. Please try another image.");
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
      const layoutLines = normalizeOcrLines(ocrResult?.data, i);
      const layoutText = buildLayoutText(layoutLines);
      const quality = scoreTextQuality(layoutText, rawConfidence);

      const pageText = quality.usable ? layoutText : "";

      confidences.push(rawConfidence);
      qualityScores.push(quality.score);

      allLines.push(...(quality.usable ? layoutLines : []));
      textSections.push(pageText ? `Page ${i + 1}\n${pageText}` : `Page ${i + 1}\n${OCR_LOW_QUALITY_MESSAGE}`);

      originalPdfImageUrls.push(`/output/${path.basename(originalPdfImagePath)}`);
      cleanedImageUrls.push(`/output/${path.basename(cleanedImagePath)}`);

      if (i === 0) {
        await createSingleScanPdfFile({
          imagePath: originalPdfImagePath,
          outputPath: pdfPath,
        });
      }
    }

    const finalText = textSections.join("\n\n");
    fs.writeFileSync(firstTxtPath, finalText, "utf8");

    const averageConfidence = Math.round(
      confidences.reduce((sum, item) => sum + item, 0) / Math.max(confidences.length, 1)
    );

    const averageQuality = Math.round(
      qualityScores.reduce((sum, item) => sum + item, 0) / Math.max(qualityScores.length, 1)
    );

    const usableText = allLines.length > 0;

    return res.json({
      success: true,
      text: finalText,
      confidence: averageConfidence,
      qualityScore: averageQuality,
      usableText,
      warning: usableText ? "" : OCR_LOW_QUALITY_MESSAGE,
      lineCount: allLines.length,
      lines: usableText ? allLines : [],
      files: {
        originalPdfImageUrl: originalPdfImageUrls[0],
        cleanedImageUrl: cleanedImageUrls[0],
        originalPdfImageUrls,
        cleanedImageUrls,
        pdfUrl: firstPdfPath ? `/output/${path.basename(firstPdfPath)}` : "",
        txtUrl: firstTxtPath ? `/output/${path.basename(firstTxtPath)}` : "",
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
    for (const uploadedPath of uploadedPaths) {
      if (uploadedPath && fs.existsSync(uploadedPath)) {
        try {
          fs.unlinkSync(uploadedPath);
        } catch (error) {
          console.warn("Upload cleanup warning:", error?.message || error);
        }
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