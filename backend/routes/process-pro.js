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

router.post("/", async (req, res) => {
  try {
    const incomingFiles = Array.isArray(req.body.files)
      ? req.body.files
      : req.body.file
        ? [req.body.file]
        : [];

    if (!incomingFiles.length) {
      return res.status(400).json({ error: "No files provided" });
    }

    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
    const originalPdfImageUrls = [];
    const allText = [];

    for (let index = 0; index < incomingFiles.length; index += 1) {
      const file = incomingFiles[index];
      const imageBuffer = Buffer.from(file, "base64");
      const baseId = `pro-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`;
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
        allText.push(`Page ${index + 1}\n${pageText.trim()}`);
      }
    }

    const text = allText.join("\n\n");
    const firstOriginalUrl = originalPdfImageUrls[0] || "";

    res.json({
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
    });
  } catch (err) {
    console.error("OCR ERROR:", err);
    res.status(500).json({ error: err?.message || "OCR failed" });
  }
});

module.exports = router;