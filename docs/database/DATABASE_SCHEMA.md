# J & D Beach House — Database Schema & BaaS Architecture

The database runs on **PostgreSQL 15+** managed via **Supabase**. It leverages extensions, custom ENUMs, Row-Level Security (RLS) policies, triggers, and a GiST exclusion constraint.

---

## 1. PostgreSQL Extensions
- `pgcrypto`: Generates cryptographically secure UUIDs (`gen_random_uuid()`).
- `btree_gist`: Enables GiST exclusion constraints on scalar and date-range types.

---

## 2. Enumerated Types (ENUMs)

| Enum Name | Possible Values |
| :--- | :--- |
| `stay_status` | `'pending'`, `'confirmed'`, `'checked_in'`, `'checked_out'`, `'cancelled'`, `'no_show'` |
| `notif_status` | `'queued'`, `'sent'`, `'delivered'`, `'failed'` |
| `user_role` | `'customer'`, `'staff'`, `'receptionist'`, `'accounting'`, `'administrator'` |
| `dept_name` | `'front_desk'`, `'housekeeping'`, `'kitchen'`, `'tours'`, `'maintenance'` |
| `task_priority` | `'low'`, `'normal'`, `'high'`, `'urgent'` |
| `task_status` | `'pending'`, `'in_progress'`, `'completed'`, `'cancelled'` |
| `order_status` | `'placed'`, `'preparing'`, `'delivering'`, `'delivered'`, `'cancelled'` |

---

## 3. Core Relational Tables

### `profiles`
Stores profile information linked to `auth.users(id)`.
- `id` (`uuid`, PK, FK `auth.users.id` ON DELETE CASCADE)
- `first_name`, `middle_name`, `last_name`, `full_name` (`text`)
- `phone` (`text`), `address`, `city`, `emergency_contact` (`text`)
- `role` (`user_role`, default `'customer'`)
- `created_at` (`timestamptz`)

### `rooms`
Catalog of accommodations (Suites, Villas, Cottages).
- `id` (`uuid`, PK)
- `name`, `slug` (unique), `category` (`text`)
- `capacity` (`int`), `units` (`int`), `rate_php` (`int`)
- `amenities` (`text[]`), `is_active` (`boolean`)
- `rating_avg` (`numeric(3,2)`), `rating_count` (`int`)

### `reservations`
Guest bookings with date-range tracking.
- `id` (`uuid`, PK)
- `guest_id` (`uuid`, FK `profiles.id`)
- `room_id` (`uuid`, FK `rooms.id`)
- `check_in`, `check_out` (`date`)
- `nights` (`int`, generated as `check_out - check_in`)
- `guests` (`int`), `status` (`stay_status`), `total_php` (`int`)
- `no_overbooking` (GiST exclusion constraint preventing overlapping date ranges for active stays).

### `department_tasks`
Operational house tasks assigned to staff.
- `id` (`uuid`, PK), `department` (`dept_name`), `title` (`text`)
- `room_name` (`text`), `priority` (`task_priority`), `status` (`task_status`)
- `assigned_to` (`text`), `created_by` (`uuid`, FK `profiles.id`)

### `resort_orders`
In-room dining, tour tickets, and amenity requests.
- `id` (`uuid`, PK), `guest_id` (`uuid`, FK `profiles.id`)
- `item_name` (`text`), `category` (`text`), `price_php` (`int`), `status` (`order_status`)

### `resort_inventory`
Supplies and stock levels.
- `id` (`uuid`, PK), `item_name` (`text`, unique), `category` (`dept_name`)
- `stock_qty` (`int`), `unit` (`text`), `reorder_at` (`int`)

---

## 4. Hard Overbooking Guard (PostgreSQL GiST)

```sql
alter table reservations add constraint no_overbooking
  exclude using gist (
    room_id with =,
    daterange(check_in, check_out) with &&
  ) where (status in ('pending','confirmed','checked_in'));
```
This mathematical constraint makes it impossible for overlapping date ranges to be inserted into the database for the same room unit, preventing double-bookings even during high-concurrency race conditions.

---

## 5. Security & Row-Level Security (RLS)

All tables have RLS enabled:
- **Guests**: Can only read and update their own profiles, reservations, and orders (`auth.uid() = guest_id`).
- **Staff & Admin**: Can view all operations data via the `is_admin_or_staff()` security definer function:
```sql
create or replace function public.is_admin_or_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() 
      and role in ('administrator','receptionist','accounting','staff')
  );
$$;
```

---

## 6. System Data Hierarchy

For an in-depth breakdown of parent-child foreign key dependency trees, organizational operational domains, role-based authorization tiers (RBAC), and physical storage lifecycles, see:
* 📄 [**System Data Hierarchy Specification (`DATA_HIERARCHY.md`)**](./DATA_HIERARCHY.md)
* 🌲 [**Interactive Data Hierarchy Explorer (`data_hierarchy_viewer.html`)**](../architecture/data_hierarchy_viewer.html)
* 📐 [**Data Hierarchy Vector Diagram (`data_hierarchy_diagram.svg`)**](../architecture/data_hierarchy_diagram.svg)
