# QA Review Workflow Plan (Draft)

This document drafts the Quality Assurance (QA) review workflow, utilizing separate original and corrected transcript files keyed by Call ID.

---

## 🗃️ Storage File Convention
For each audio session (call), we maintain two separate JSON states:
1. **`original_[call_id]_transcript.json`**
   * **Source:** Generated directly by the automated Databricks/Python STT (WhisperX) pipeline.
   * **Status:** Read-only (never modified after upload). Acts as the baseline reference.
2. **`corrected_[call_id]_transcript.json`**
   * **Source:** Saved and updated dynamically by the editor as adjustments are made.
   * **Status:** Writable. Represents the final human-aligned timestamp corrections.

---

## 🔍 QA Diff Analysis Specs
The QA reviewer will compare the two JSONs to audit modifications. Key changes to calculate and highlight:

### 1. Word Text Modifications
* **Insertions:** Words added by the editor that were missed by the STT model.
* **Deletions:** Words removed by the editor (e.g. model hallucination or background noise).
* **Corrections:** Text spelling corrections (e.g. model guessed "see you" -> editor corrected to "CU").

### 2. Time Alignment Adjustments
* **Start Shift:** Difference in start time: `corrected.start - original.start`.
* **End Shift:** Difference in end time: `corrected.end - original.end`.
* **Expansion/Shrinkage:** Highlight words whose durations were significantly adjusted to align with speaker boundaries.

---

## ⏳ To Be Decided (Incomplete Items)
* [ ] **Storage Location:** Will these JSON files be saved on a cloud bucket (e.g., AWS S3, Azure Blob) or directly on the Node backend disk/database?
* [ ] **QA View Interface:** Will the QA reviewer have a side-by-side visual timeline comparing the original and corrected wav blocks, or just a text-diff interface showing edits?
* [ ] **Review States:** Implement status tags for the call (e.g., `Pending Review`, `QA Approved`, `Re-edit Requested`).
