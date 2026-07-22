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
| **`Spacebar`** | Toggle Play / Pause | Automatically bypassed when typing in text fields or transcription editor. | **Blocked Page Scroll:** Prevents spacebar from scrolling down the webpage. |
| **`Right Arrow`** | Skip 3 seconds forward (hold to seek continuously) | Automatically bypassed in text fields. | **Blocked Default Action:** Blocks caret moving or text behavior outside text-entry. |
| **`Left Arrow`** | Skip 3 seconds backward (hold to seek continuously) | Automatically bypassed in text fields. | **Blocked Default Action:** Blocks caret moving or text behavior outside text-entry. |
| **`Up Arrow`** | Increase Playback Speed by +0.25x (Max 3.0x) | Automatically bypassed in text fields. | **Blocked Page Scroll:** Prevents arrow keys from scrolling the webpage. |
| **`Down Arrow`** | Decrease Playback Speed by -0.25x (Min 0.5x) | Automatically bypassed in text fields. | **Blocked Page Scroll:** Prevents arrow keys from scrolling the webpage. |

---

## 🛡️ Global Web App Protection

### 🔒 Back-Navigation Gesture Lock
To prevent editors from accidentally losing unsaved changes by swiping left near the edges of their laptop trackpads:
* **CSS Overscroll Isolation:** `overscroll-behavior-x: none` is applied to the main page viewport. This tells the browser's rendering engine to completely disable edge swipe-to-go-back history gestures.
