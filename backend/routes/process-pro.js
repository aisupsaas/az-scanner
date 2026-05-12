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

async function processProFiles(incomingFiles, onProgress) {
  const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
  const originalPdfImageUrls = [];
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
      .toFile(originalImagePath);

    const originalPdfImageUrl = `/output/${path.basename(originalImagePath)}`;
    originalPdfImageUrls.push(originalPdfImageUrl);

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