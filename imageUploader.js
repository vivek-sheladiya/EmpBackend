const multer = require('multer');
const path = require('path');
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/screenshots';

    if (file.fieldname === 'profilePhoto') {
      uploadPath = 'uploads/profilePhoto';
    }

    if (!fs.existsSync(path.join(__dirname, uploadPath))) {
      fs.mkdirSync(path.join(__dirname, uploadPath), { recursive: true });
    }

    cb(null, path.join(__dirname, uploadPath));
  },
  filename: (req, file, cb) => {
    const fileName = Date.now() + path.extname(file.originalname);
    cb(null, fileName);
  },
});

const upload = multer({ storage: storage, limits: { fieldSize: 2 * 1024 * 1024 } });

module.exports = upload;

