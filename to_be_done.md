# To Be Done (Future Backlog)

## 1. Merged Voclara Admin Panel Integration
- **Goal**: Merge the standalone/external Admin Panel directly into the main Voclara web interface.
- **Key Features to Implement**:
  - Add an **`⚙️ Admin Panel`** button to the top header navigation (`Header.jsx`).
  - Render an `AdminPanel.jsx` view displaying a table of all saved segmentations retrieved from backend S3 server storage (`GET /api/segmentation/all`).
  - Interactive JSON viewer modal to inspect segment-level millisecond timestamps (`start_ms`, `end_ms`, `duration_ms`).
  - Direct download and deletion controls for admin users.
