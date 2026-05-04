const express = require("express");
const router = express.Router();
const { DocumentProcessorServiceClient } = require("@google-cloud/documentai").v1;

const client = new DocumentProcessorServiceClient({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
});

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = "us";
const PROCESSOR_ID = process.env.GOOGLE_PROCESSOR_ID;

router.post("/", async (req, res) => {
  try {
    const { file } = req.body;

    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;

    const request = {
      name,
      rawDocument: {
        content: Buffer.from(file, "base64"),
        mimeType: "image/jpeg",
      },
    };

    const [result] = await client.processDocument(request);

    const text = result.document.text;

    res.json({ text });
  } catch (err) {
    console.error("OCR ERROR:", err);
    res.status(500).json({ error: "OCR failed" });
  }
});

module.exports = router;