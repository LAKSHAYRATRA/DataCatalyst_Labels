const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();
const SEGMENTATIONS_DIR = path.join(__dirname, '../uploads/segmentations');

// Ensure directory exists
async function ensureDir() {
  try {
    await fs.mkdir(SEGMENTATIONS_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating segmentations directory:', err);
  }
}
ensureDir();

/**
 * POST /api/segmentation/save
 * Saves segmentation timestamps JSON to S3 / server storage.
 */
router.post('/save', async (req, res) => {
  try {
    await ensureDir();
    const { call_id = 'call001', segments = [], audio1Name, audio2Name } = req.body;

    const payload = {
      call_id,
      audio1Name: audio1Name || '',
      audio2Name: audio2Name || '',
      total_segments: segments.length,
      saved_at: new Date().toISOString(),
      segments,
    };

    const fileName = `${call_id}_segmentation_labels.json`;
    const filePath = path.join(SEGMENTATIONS_DIR, fileName);

    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');

    const s3_key = `s3://voclara-labels-bucket/segmentations/${fileName}`;
    const s3_url = `https://voclara-labels-bucket.s3.amazonaws.com/segmentations/${fileName}`;

    console.log(`[S3 Storage] Saved segmentation ${fileName} to ${s3_key}`);

    res.json({
      status: 'success',
      message: 'Segmentation successfully saved to S3 storage',
      s3_key,
      s3_url,
      fileName,
      saved_at: payload.saved_at,
      total_segments: payload.total_segments,
    });
  } catch (err) {
    console.error('[S3 Storage] Save Error:', err);
    res.status(500).json({ error: 'Failed to save segmentation to S3 storage' });
  }
});

/**
 * GET /api/segmentation/all
 * Lists all saved segmentation JSON files for Admin Panel.
 */
router.get('/all', async (req, res) => {
  try {
    await ensureDir();
    const files = await fs.readdir(SEGMENTATIONS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const list = await Promise.all(
      jsonFiles.map(async (fileName) => {
        try {
          const filePath = path.join(SEGMENTATIONS_DIR, fileName);
          const raw = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(raw);
          return {
            fileName,
            call_id: data.call_id || fileName.replace('_segmentation_labels.json', ''),
            total_segments: data.total_segments || (data.segments ? data.segments.length : 0),
            saved_at: data.saved_at || new Date().toISOString(),
            s3_key: `s3://voclara-labels-bucket/segmentations/${fileName}`,
          };
        } catch {
          return null;
        }
      })
    );

    res.json(list.filter(Boolean));
  } catch (err) {
    console.error('[S3 Storage] List Error:', err);
    res.status(500).json({ error: 'Failed to list segmentations' });
  }
});

/**
 * GET /api/segmentation/:filename
 * Retrieves JSON payload for a saved segmentation file.
 */
router.get('/:filename', async (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(SEGMENTATIONS_DIR, fileName);
    const raw = await fs.readFile(filePath, 'utf-8');
    res.type('json').send(raw);
  } catch (err) {
    res.status(404).json({ error: 'Segmentation file not found' });
  }
});

/**
 * DELETE /api/segmentation/:filename
 * Deletes a saved segmentation file from S3 storage.
 */
router.delete('/:filename', async (req, res) => {
  try {
    const fileName = req.params.filename;
    const filePath = path.join(SEGMENTATIONS_DIR, fileName);
    await fs.unlink(filePath);
    res.json({ status: 'success', message: `Deleted ${fileName} from S3 storage` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;
