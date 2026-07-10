const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const audioFilter = (req, file, cb) => {
  const allowed = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only audio files are allowed'), false);
  }
};

const textFilter = (req, file, cb) => {
  const allowed = ['.txt', '.json', '.label'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext) || file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
    cb(null, true);
  } else {
    cb(new Error('Only text or JSON label files are allowed'), false);
  }
};

const uploadAudio = multer({ storage, fileFilter: audioFilter, limits: { fileSize: 500 * 1024 * 1024 } });
const uploadText = multer({ storage, fileFilter: textFilter, limits: { fileSize: 10 * 1024 * 1024 } });

module.exports = { uploadAudio, uploadText };
