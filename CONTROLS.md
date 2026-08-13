# Voclara Editor Custom Controls Reference

This document catalogs the custom keyboard, mouse, and trackpad controls configured in the Voclara Editor to optimize timeline editing speed and lock accidental browser actions.

---

## 🖱️ Mouse & Trackpad Navigation (Timeline Track)

| Interaction | Action | Scope | Avoided Browser Default |
| :--- | :--- | :--- | :--- |
| **Trackpad Pinch (2 Fingers)** | Zoom In / Out | WAV Track Only | **Blocked Page Zoom:** Prevents browser window scaling. |
| **Mouse Wheel + `Ctrl`** | Zoom In / Out | WAV Track Only | **Blocked Page Zoom:** Prevents browser window scaling. |
| **Trackpad Swipe Left/Right (2 Fingers)** | Scroll Left / Right | WAV Track Only | **Blocked Page Navigation:** Prevents Edge from going back to the previous page. |
| **Mouse Wheel Scroll (Vertical)** | Scroll Left / Right (Horizontal) | WAV Track Only | **Blocked Page Scroll:** Keeps the overall webpage vertically locked. |
| **Click on Timeline Ruler** | Seek Audio Position | Timeline Ruler | N/A |
| **Select Region (Word Segment)** | Loop Segment Playback | Active Label | Plays segment repeatedly (looping). Instantly adjusts loop bounds in real-time as boundaries are dragged. |
| **Drag Region Handles (Left/Right edges)** | Resize Segment Time Boundaries | Active Label | N/A |
| **Drag Region Body** | Move Segment Timeline Position | Active Label | N/A |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Context Bypass | Avoided Browser Default |
| :--- | :--- | :--- | :--- |
| **`S` Key** | Create Segment from Active Selection | Automatically bypassed in text fields. | Instantly converts draft selection into segment (ID format: `callid_segmentid`). |
| **`Delete`** / **`Backspace`** | Delete Selected Segment | Automatically bypassed in text fields. | Deletes the currently selected segment region (`activeSegmentId`). |
| **`+`** / **`=`** | Zoom In Waveform | Automatically bypassed in text fields. | Step zooms in up to `300.0x` max. |
| **`-`** / **`_`** | Zoom Out Waveform | Automatically bypassed in text fields. | Step zooms out down to `1.0x` fit screen. |

---

## ✂️ Segment Selection & Deletion Controls

* **Select Segment:** Click anywhere inside a created segment region to select it (highlights with glowing border indicator).
* **Delete Segment:** Select a segment and click the **🗑️ Delete Segment** button in the toolbar (or press **`Delete`** / **`Backspace`** on keyboard).
* **Delete Button (`✕`):** Click the red `✕` button on any individual segment header to delete it directly.

## 🛡️ Global Web App Protection

### 🔒 Back-Navigation Gesture Lock
To prevent editors from accidentally losing unsaved changes by swiping left near the edges of their laptop trackpads:
* **CSS Overscroll Isolation:** `overscroll-behavior-x: none` is applied to the main page viewport. This tells the browser's rendering engine to completely disable edge swipe-to-go-back history gestures.
