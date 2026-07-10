const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const Project = require('../models/Project');
const { uploadAudio, uploadText } = require('../middleware/upload');
const { parseLabels, labelsToAudacity, labelsToJson } = require('../utils/labelParser');

const router = express.Router();

// In-memory fallback when MongoDB is unavailable
const memoryStore = new Map();

async function getProject(id) {
  try {
    const doc = await Project.findById(id);
    if (doc) return doc.toObject();
  } catch {
    // mongoose not connected
  }
  return memoryStore.get(id) || null;
}

async function saveProject(project) {
  try {
    if (project._id) {
      const updated = await Project.findByIdAndUpdate(project._id, project, { new: true });
      if (updated) return updated.toObject();
    }
  } catch {
    // fall through
  }
  memoryStore.set(String(project._id), project);
  return project;
}

async function createProject(data) {
  try {
    const doc = await Project.create(data);
    return doc.toObject();
  } catch {
    const id = require('crypto').randomBytes(12).toString('hex');
    const project = { _id: id, ...data, createdAt: new Date(), updatedAt: new Date() };
    memoryStore.set(id, project);
    return project;
  }
}

// Create project
router.post('/', async (req, res) => {
  try {
    const project = await createProject({ name: req.body.name || 'Untitled Project' });
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get project
router.get('/:id', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// Update transcription
router.put('/:id/transcription', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.transcription = req.body.transcription ?? '';
  project.updatedAt = new Date();
  const saved = await saveProject(project);
  res.json(saved);
});

// Update labels
router.put('/:id/labels', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  project.labels = req.body.labels ?? [];
  project.updatedAt = new Date();
  const saved = await saveProject(project);
  res.json(saved);
});

// Upload audio
router.post('/:id/audio', uploadAudio.single('audio'), async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  project.audioFile = req.file.filename;
  project.audioOriginalName = req.file.originalname;
  project.updatedAt = new Date();
  const saved = await saveProject(project);
  res.json(saved);
});

// Upload transcription file
router.post('/:id/transcription/upload', uploadText.single('file'), async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = await fs.readFile(req.file.path, 'utf-8');
  project.transcription = content.trim();
  project.updatedAt = new Date();
  await fs.unlink(req.file.path).catch(() => {});
  const saved = await saveProject(project);
  res.json(saved);
});

// Upload labels file
router.post('/:id/labels/upload', uploadText.single('file'), async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = await fs.readFile(req.file.path, 'utf-8');
  const labels = parseLabels(content, req.file.originalname);
  project.labels = labels;
  project.updatedAt = new Date();
  await fs.unlink(req.file.path).catch(() => {});
  const saved = await saveProject(project);
  res.json(saved);
});

// Export labels
router.get('/:id/labels/export', async (req, res) => {
  const project = await getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const format = req.query.format || 'audacity';
  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=labels.json');
    return res.send(labelsToJson(project.labels || []));
  }

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename=labels.txt');
  res.send(labelsToAudacity(project.labels || []));
});

module.exports = router;
