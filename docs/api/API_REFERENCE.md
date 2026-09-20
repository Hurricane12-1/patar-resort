# J & D Beach House — REST API & WebSocket Reference

**Base URL (Local)**: `http://localhost:5000/api` (HTTP) or `https://localhost:5000/api` (TLS)  
**Authentication**: Bearer token via `Authorization: Bearer <token>` or session cookie.

---

## 1. Authentication & User Profile (`/api/me`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/me` | Authenticated | Fetch active user profile from Supabase. |
| `PATCH` | `/api/me` | Authenticated | Update user name, phone, address, and emergency contact. |
| `PATCH` | `/api/me/password` | Authenticated | Update account password (triggers confirmation SMS). |

---

## 2. Accommodations & Availability (`/api/rooms`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/rooms` | Public | Returns all active room categories with rates and amenities. |
| `GET` | `/api/availability` | Public | Query available units between `check_in` and `check_out` using the `available_rooms()` RPC. |

---

## 3. Reservations Engine (`/api/reservations`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/reservations` | Authenticated | Create a stay booking. Protected by PostgreSQL GiST exclusion constraint against double-booking. Sends SMS confirmation ping. |
| `GET` | `/api/reservations/mine` | Authenticated | Fetch reservations belonging to the authenticated guest. |
| `GET` | `/api/reservations` | Staff / Admin | Fetch all resort reservations for staff operations desks. |
| `PATCH` | `/api/reservations/:id/status` | Staff / Admin | Update status (`confirmed`, `checked_in`, `checked_out`, `cancelled`). Triggers status SMS ping. |
| `PATCH` | `/api/reservations/:id/cancel` | Guest / Staff | Cancel a pending or confirmed reservation. |

---

## 4. Guest Experience Hub (`/api/customer`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/customer/services` | Authenticated | Catalog of in-room dining, amenities, and guided tours. |
| `GET` | `/api/customer/orders` | Authenticated | List all service and dining orders for current guest. |
| `POST` | `/api/customer/orders` | Authenticated | Place order for dining or tour service. Sends SMS receipt. |
| `GET` | `/api/customer/digital-pass` | Authenticated | Generates digital RFID pass code for active check-in stay. |
| `GET` | `/api/customer/stats` | Authenticated | Summary of stays booked, active orders, and total spent. |

---

## 5. Department Operations Hub (`/api/department`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/department/tasks` | Staff / Admin | List operational tasks for Front Desk, Housekeeping, Kitchen, Tours, and Maintenance. |
| `POST` | `/api/department/tasks` | Staff / Admin | Dispatch new task with priority (`low`, `normal`, `high`, `urgent`). |
| `PATCH` | `/api/department/tasks/:id/status` | Staff / Admin | Update task progress (`pending`, `in_progress`, `completed`). |
| `GET` | `/api/department/room-status` | Staff / Admin | Room occupancy and housekeeping status matrix. |
| `GET` | `/api/department/inventory` | Staff / Admin | Inventory levels and reorder thresholds for resort goods. |

---

## 6. Telemetry & Analytics (`/api/telemetry`, `/api/analytics`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/telemetry/ping` | Public | Record visitor heartbeat ping. |
| `GET` | `/api/telemetry/stats` | Staff / Admin | Real-time active visitors, on-grounds guests, and density. |
| `GET` | `/api/telemetry/predictions` | Staff / Admin | 7-day occupancy and revenue forecast with scenario simulation. |
| `GET` | `/api/analytics/overview` | Staff / Admin | Full financial KPIs (ADR, RevPAR, GoPPAR, Gross Revenue). |
| `GET` | `/api/analytics/export` | Staff / Admin | Export analytics as downloadable CSV. |

---

## 7. Secure Media Upload (`/api/upload`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/upload/image` | Authenticated | Upload base64 encoded image. Validates MIME type, restricts file size to <= 5MB, assigns cryptographically random UUID filename, and protects against directory traversal. |

---

## 8. Real-Time Chatbot Socket (`J & D Bot`)

**Protocol**: WebSocket via Socket.io  
**Connection**: `ws://localhost:5000`

### Client-to-Server Events
- `chat:message`: `{ text: string }` — User prompt or quick chip selection.

### Server-to-Client Events
- `bot:message`: `{ text: string, chips?: string[] }` — Response message with suggestion chips.
- `bot:typing`: Signals that the bot is generating a reply.
