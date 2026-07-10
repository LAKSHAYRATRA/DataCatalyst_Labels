const API_BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function createProject(name) {
  return request('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function getProject(id) {
  return request(`/projects/${id}`);
}

export async function uploadAudio(projectId, file) {
  const form = new FormData();
  form.append('audio', file);
  return request(`/projects/${projectId}/audio`, { method: 'POST', body: form });
}

export async function uploadTranscription(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  return request(`/projects/${projectId}/transcription/upload`, { method: 'POST', body: form });
}

export async function uploadLabels(projectId, file) {
  const form = new FormData();
  form.append('file', file);
  return request(`/projects/${projectId}/labels/upload`, { method: 'POST', body: form });
}

export async function updateTranscription(projectId, transcription) {
  return request(`/projects/${projectId}/transcription`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcription }),
  });
}

export async function updateLabels(projectId, labels) {
  return request(`/projects/${projectId}/labels`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labels }),
  });
}

export function getAudioUrl(filename) {
  return `/uploads/${filename}`;
}

export function getExportUrl(projectId, format = 'audacity') {
  return `${API_BASE}/projects/${projectId}/labels/export?format=${format}`;
}
