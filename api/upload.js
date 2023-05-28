// api/upload.js
const { createWorker } = require("tesseract.js");
const PDFImage = require("pdf-image").PDFImage;
const multer = require("multer");
const upload = multer({ dest: "/tmp/uploads" });
const fs = require("fs");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const processPdf = async (path) => {
  const worker = await createWorker();
  const url =
    "https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=";
  const rectangle = { left: 0, top: 500, width: 1000, height: 500 };

  await worker.load();
  await worker.loadLanguage("nld");
  await worker.initialize("nld");

  const pdfImage = new PDFImage(path, {
    convertOptions: {
      "-density": "300",
    },
  });

  const totalPagesCommand = `pdfinfo ${path} | awk '/Pages/ {print $2}'`;
  const { stdout: pagesStdout } = await exec(totalPagesCommand);
  const totalPages = parseInt(pagesStdout);

  let results = [];
  for (let i = 0; i < totalPages; i++) {
    const imagePath = await pdfImage.convertPage(i);
    const {
      data: { text },
    } = await worker.recognize(imagePath, { rectangle });

    // Extract your data
    let lines = text.split("\n");
    for (let line of lines) {
      let cleanedLine = line.replace(/[^0-9]/g, "");
      if (cleanedLine.length === 9) {
        results.push(url + cleanedLine);
        break;
      }
    }

    // Delete the temporary image
    fs.unlinkSync(imagePath);
  }

  await worker.terminate();

  return results;
};

module.exports = async (req, res) => {
  try {
    const file = req.files.file; // Assumes you're uploading a file under the key 'file'
    const results = await processPdf(file.path);
    fs.unlinkSync(file.path);
    res.send(
      results.map((result) => `<a href="${result}">${result}</a>`).join("<br/>")
    );
  } catch (err) {
    res.status(500).send(err.toString());
  }
};
