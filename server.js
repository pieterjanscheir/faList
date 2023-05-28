const express = require("express");
const multer = require("multer");
const fsPromises = require("fs").promises;
const fs = require("fs");
const path = require("path");
const { createWorker } = require("tesseract.js");
const PDFImage = require("pdf-image").PDFImage;
const { PDFDocument } = require("pdf-lib");

const app = express();
const upload = multer({ dest: "/tmp/" }); // Change the destination to /tmp

app.set("view engine", "ejs");
app.use(express.static("public"));

app.post("/api/upload", upload.single("file"), async (req, res) => {
  // Change the route to /api/upload
  const worker = await createWorker();
  const url =
    "https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=";
  const rectangle = { left: 0, top: 500, width: 1000, height: 500 };
  const pdfPath = req.file.path;

  try {
    await worker.load();
    await worker.loadLanguage("nld");
    await worker.initialize("nld");

    const pdfImage = new PDFImage(pdfPath, {
      convertOptions: {
        "-density": "300",
      },
    });

    const pdfBytes = await fsPromises.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const totalPages = pdfDoc.getPages().length;

    let results = [];

    for (let i = 0; i < totalPages; i++) {
      console.log(`Processing page ${i + 1}...`);
      const imagePath = await pdfImage.convertPage(i);
      const {
        data: { text },
      } = await worker.recognize(imagePath, { rectangle });

      console.log("TEXT:", text);

      let lines = text.split("\n");
      for (let line of lines) {
        let cleanedLine = line.replace(/[^0-9]/g, "");
        if (cleanedLine.length === 9) {
          results.push(url + cleanedLine);
          console.log("Found: ", url + cleanedLine);
          break;
        }
      }

      fs.unlinkSync(imagePath);
    }

    await worker.terminate();

    res.render("results", { results: results });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred while processing the file.");
  }
});

module.exports = app; // Instead of listening to a port, export the app
