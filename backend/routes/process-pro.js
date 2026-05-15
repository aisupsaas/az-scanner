const express = require("express");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const router = express.Router();
const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;

const client = new DocumentProcessorServiceClient({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
});

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = "us";
const PROCESSOR_ID = process.env.GOOGLE_PROCESSOR_ID;

const OUTPUT_DIR = path.join(__dirname, "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getIncomingFiles(req) {
  return Array.isArray(req.body.files)
    ? req.body.files
    : req.body.file
      ? [req.body.file]
      : [];
}

async function createOriginalImage(imageBuffer, outputPath) {
  await sharp(imageBuffer, {
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
    .toFile(outputPath);
}

async function createSmartCleanImage(imageBuffer, outputPath) {
  const base = sharp(imageBuffer, {
    failOn: "none",
    limitInputPixels: 60_000_000,
  }).rotate();

  const metadata = await base.metadata();
  const width = metadata.width || 2400;

  await sharp(imageBuffer, {
    failOn: "none",
    limitInputPixels: 60_000_000,
  })
    .rotate()

    // DPI / resolution normalization
    .resize({
      width: Math.min(2400, width),
      withoutEnlargement: true,
    })

    // Auto white balance / exposure cleanup
    .normalize()

    // Background/shadow cleanup + stronger paper white
    .modulate({
      brightness: 1.08,
      saturation: 0.82,
    })

    // Adaptive black/white document feel
    .grayscale()
    .linear(1.22, -18)

    // Text sharpening
    .sharpen({
      sigma: 1.15,
      m1: 1.2,
      m2: 2.4,
      x1: 2,
      y2: 12,
      y3: 18,
    })

    // Clean output
    .png({
      compressionLevel: 8,
      adaptiveFiltering: true,
    })
    .toFile(outputPath);
}

async function processProFiles(incomingFiles, onProgress) {
  const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
  const originalPdfImageUrls = [];
  const smartCleanImageUrls = [];
  const allText = [];

  for (let index = 0; index < incomingFiles.length; index += 1) {
    const pageNumber = index + 1;
    const totalPages = incomingFiles.length;

    onProgress?.({
      type: "progress",
      stage: "ocr",
      page: pageNumber,
      total: totalPages,
      message: `Processing page ${pageNumber} of ${totalPages}...`,
    });

    const file = incomingFiles[index];
    const imageBuffer = Buffer.from(file, "base64");
    const baseId = `pro-${Date.now()}-${pageNumber}-${Math.random().toString(36).slice(2, 8)}`;

    const originalImagePath = path.join(OUTPUT_DIR, `${baseId}-original.png`);
    const smartCleanImagePath = path.join(OUTPUT_DIR, `${baseId}-smart-clean.png`);

    await createOriginalImage(imageBuffer, originalImagePath);

    onProgress?.({
      type: "progress",
      stage: "smart-clean",
      page: pageNumber,
      total: totalPages,
      message: `Smart Clean page ${pageNumber} of ${totalPages}...`,
    });

    await createSmartCleanImage(imageBuffer, smartCleanImagePath);

    const originalPdfImageUrl = `/output/${path.basename(originalImagePath)}`;
    const smartCleanImageUrl = `/output/${path.basename(smartCleanImagePath)}`;

    originalPdfImageUrls.push(originalPdfImageUrl);
    smartCleanImageUrls.push(smartCleanImageUrl);

    const request = {
      name,
      rawDocument: {
        content: imageBuffer,
        mimeType: "image/jpeg",
      },
    };

    const [result] = await client.processDocument(request);
    const pageText = result?.document?.text || "";

    if (pageText.trim()) {
      allText.push(`Page ${pageNumber}\n${pageText.trim()}`);
    }

    onProgress?.({
      type: "progress",
      stage: "done-page",
      page: pageNumber,
      total: totalPages,
      message: `Page ${pageNumber} complete.`,
    });
  }

  onProgress?.({
    type: "progress",
    stage: "finalizing",
    page: incomingFiles.length,
    total: incomingFiles.length,
    message: "Finalizing scan...",
  });

  const text = allText.join("\n\n");
  const firstOriginalUrl = originalPdfImageUrls[0] || "";
  const firstSmartCleanUrl = smartCleanImageUrls[0] || "";

  return {
    success: true,
    text,
    confidence: 100,
    qualityScore: 100,
    usableText: Boolean(text.trim()),
    warning: "",
    lineCount: text.trim() ? text.split(/\r?\n/).filter(Boolean).length : 0,
    lines: [],
    files: {
      originalPdfImageUrl: firstOriginalUrl,
      originalPdfImageUrls,
      cleanedImageUrl: "",
      cleanedImageUrls: [],
      smartCleanImageUrl: firstSmartCleanUrl,
      smartCleanImageUrls,
      pdfUrl: "",
      txtUrl: "",
    },
  };
}

router.post("/", async (req, res) => {
  try {
    const incomingFiles = getIncomingFiles(req);

    if (!incomingFiles.length) {
      return res.status(400).json({ error: "No files provided" });
    }

    const resultPayload = await processProFiles(incomingFiles);

    return res.json(resultPayload);
  } catch (err) {
    console.error("OCR ERROR:", err);
    return res.status(500).json({ error: err?.message || "OCR failed" });
  }
});

router.post("/stream", async (req, res) => {
  function sendEvent(payload) {
    res.write(`${JSON.stringify(payload)}\n`);
  }

  try {
    const incomingFiles = getIncomingFiles(req);

    if (!incomingFiles.length) {
      res.status(400);
      return res.json({ error: "No files provided" });
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    sendEvent({
      type: "progress",
      stage: "start",
      page: 0,
      total: incomingFiles.length,
      message: `Starting OCR for ${incomingFiles.length} page${incomingFiles.length === 1 ? "" : "s"}...`,
    });

    const resultPayload = await processProFiles(incomingFiles, sendEvent);

    sendEvent({
      type: "complete",
      message: "OCR complete.",
      result: resultPayload,
    });

    return res.end();
  } catch (err) {
    console.error("OCR STREAM ERROR:", err);

    if (!res.headersSent) {
      return res.status(500).json({ error: err?.message || "OCR failed" });
    }

    sendEvent({
      type: "error",
      message: err?.message || "OCR failed",
    });

    return res.end();
  }
});

module.exports = router;