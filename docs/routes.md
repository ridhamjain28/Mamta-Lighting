# Routes Map

## Frontend Routes (Component Based)
The app doesn't use `react-router` extensively for traditional page navigation; it uses a state-based tab switching mechanism driven by `useQuoteStore` (systemMode) and local state (`activeTab`) in `App.jsx`.

### Systems (Modes)
- **Image Quote**: Visual quotations for decorative lights.
- **Switch Quote**: Spreadsheet style for modular switches.
- **Wire Quote**: Coil-based pricing for house wires.

### Active Tabs (Navigation)
- **new-quote**: Main interface (Catalog on left, Cart on right).
- **preview**: PDF Preview (only for Image Quote).
- **history**: Quotation History view (`History.jsx`).
- **management**: Product Management (`ProductManagement.jsx`, `SwitchProductManagement.jsx`, `WireProductManagement.jsx`).
- **compare**: Compare products (`SwitchComparePage.jsx` - only for Switch Quote).

## Backend Routes
API endpoints are defined in `server/index.js`.

| Method | Route | Purpose | Auth Required |
| --- | --- | --- | --- |
| GET | `/api/keepalive` | Pings the database to keep Supabase active | No |
| POST | `/api/upload-image` | Uploads an image to Supabase Storage via Multer | No |
| POST | `/api/quotation` | Generates a branded PDF using Puppeteer | No |
