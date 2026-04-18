# replit.md

## Overview

This is a full-stack web application serving as an admin panel for a "Park & Travel" parking booking system. It facilitates the management of bookings, customers, and reports for administrators, while enabling guest and authenticated users to book parking and manage personal details. The project aims to deliver a comprehensive, responsive, and role-based access controlled platform for efficient parking management. Key features include booking management with progressive pricing, user profile and car management, and advanced configuration settings.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Angular 21 (standalone components).
- **Styling**: SCSS, Bootstrap 5.3, ng-bootstrap.
- **UI/UX**: Responsive design with a blue header, left sidebar navigation, and a main content area. Features unified list components and a shared date range picker.
- **Routing**: Angular Router with lazy-loaded feature modules and layout wrapper.
- **Modules**: Modular structure including Layout, Core (API service, HTTP interceptor), Shared, and feature-specific modules.

### Backend
- **Framework**: Express.js with TypeScript.
- **API**: RESTful API (`/api` prefix) with public and protected endpoints.
- **CORS**: Enabled.

### Database
- **Type**: PostgreSQL.
- **ORM**: Drizzle ORM.
- **Schema**: Managed in `backend/src/db/index.ts`.
- **Tables**: `bookings`, `booking_statuses`, `cars`, `configuration_settings`, `phone_codes`, `parking_types`, `wallee_transactions`.

### Authentication & Authorization
- **Provider**: Auth0.
- **Integration**: `@auth0/auth0-angular` SDK.
- **Roles**: `admin`, `driver`, `user` with RBAC via Auth0 custom claims and Angular route guards.
  - **Admin**: Full access.
  - **Driver**: Access to all bookings.
  - **User**: Access to personal bookings and car management.
- **Features**: Guest/login landing page, protected admin routes, user profile management (including email verification), and car management.

### Core Features
- **Booking Management**: Create, list (with filters), soft delete bookings. Includes car wash and transport options.
- **Booking Statuses**: `Created`, `Parked`, `Completed`. Status updates are one-way (Created → Parked → Completed). "Parked" status triggers a prompt for `parkPlace` and records `actualCheckIn`.
- **Print Tag**: Admins/drivers can print a parking tag for "Parked" bookings, containing key booking details.
- **User Profile**: Users can manage name, surname, phone.
- **Car Management**: Users can add, edit, delete cars.
- **Configuration Settings**: Admin users manage parking availability, base prices, progressive price increments, service options, delivery fees, email description text, and mandatory pre-payment toggle.
- **Authenticated Booking Payment Flow**: Integrates with Wallee. If `mandatoryPrePayment` is true, payment is initiated directly. Otherwise, user chooses "Pay Now / Pay Later". Payment is skipped if price is TBC. Payment results redirect to `/admin/bookings`.
- **Wallee Transactions**: Successful payments are recorded in `wallee_transactions`. Booking payment status (Paid, Partial, Overpaid, Unpaid) is derived dynamically from these transactions.
- **Z-Report by Employee**: Admin report at `/admin/reports/employee-z-report` with two modes — (1) Date Range: paginated completion transactions across all employees with totals by payment method; (2) By Employee: drill-down from employee buttons → shift list (open+closed) → shift transactions. Employee names resolved via Auth0 Management API. Printable via `window.print()`. Backend: `GET /api/reports/employee-z/employees`, `/employees/:userId/shifts`, `/shifts/:shiftId/transactions`, `/by-date`.
- **Completion Transactions**: `completion_transactions` table records payment at checkout. `GET /api/bookings/:id/extra-fee-estimate` estimates late-checkout extra fee (read-only). `POST /api/bookings/:id/complete` atomically sets status to Completed, records `actualCheckOut`/`checkOutBy`, optionally applies extra fee, and creates a `CompletionTransaction`. Frontend "Mark as Completed" flow: fetches estimate → prompts about extra fee if late → shows Cash/Card popup (non-prepaid) or auto-records Wallee payment (prepaid) → calls complete endpoint.
- **Payment for Booking Update (Difference)**: If a booking edit increases the `finalPrice`, the user pays the difference via Wallee.
- **Paid Amount Tooltip**: Bookings list displays a tooltip showing the total amount paid.

### Progressive Pricing
- **Logic**: Base price for day 1, with configurable increments for subsequent days. The last increment repeats. Final price is for the total duration, not a sum of daily rates.
- **Storage**: `configurationSetting_priceIncrementsCovered` and `configurationSetting_priceIncrementsUncovered` (JSON arrays).
- **Extra Fee**: For overstay, extra fee is calculated using subsequent increments from the original booking end.
- **Admin UI**: Editable increment lists in Settings.
- **Application**: Applied across all booking operations (guest, authenticated, updates).

### Booking Form Features
- **Regular Users**: Auto-filled personal info from profile; car selection from saved vehicles; option to add new car.
- **Admin/Driver Users**: Search Auth0 by email or phone to auto-fill user details and load saved cars; ability to add new cars to found user's account.
- **Notifications**: SweetAlert2 for success/error messages.

### Customers Management
- **Admin Only**: View list of regular users fetched from Auth0.
- **Display**: Shows email, name, surname, phone code (with country flag), phone number.
- **Phone Flags**: Uses `phone_codes` database table for country flag display.
- **Responsiveness**: Desktop table and mobile card views.

### Parking Availability Check
- **Real-time Validation**: Checks availability for selected dates/parking type during booking creation/update.
- **Backend Service**: `availability.service.ts` counts active overlapping bookings and compares against configured availability.
- **API Endpoints**: For checking specific parking types or both.
- **Frontend Integration**: Provides visual feedback, disables submit if unavailable, and uses `excludeBookingId` for edit mode.

### Vehicle Photo Upload (S3)
- **Storage**: DigitalOcean Spaces (S3-compatible).
- **Backend Service**: `upload.service.ts` handles S3 operations.
- **API Endpoint**: `POST /api/upload/:bookingId/images` (multipart, max 10 files, 10MB each, JPG/PNG/WEBP).
- **Authorization**: Admin and driver roles only.
- **Frontend Integration**: Drag-and-drop upload area in the "Parked" status change modal.

## External Dependencies

### Database
- **PostgreSQL**
- **Drizzle ORM**

### Frontend Libraries
- **Bootstrap 5.3**
- **@ng-bootstrap/ng-bootstrap**
- **SweetAlert2**
- **@auth0/auth0-angular**
- **zone.js**

### Backend Libraries
- **Express.js**
- **http-proxy-middleware**
- **cors**

### Services
- **Auth0**: Identity management.
- **flagcdn.com**: Country flag icons.
- **Brevo**: Transactional email service.

### Email Integration
- **Provider**: Brevo (formerly Sendinblue) via SMTP.
- **Library**: `nodemailer`.
- **SMTP**: Host `smtp-relay.brevo.com`, port `587`, TLS required.
- **Credentials**: `SMTP_USER` and `SMTP_KEY` secrets; `FROM_NAME`, `SMTP_HOST`, `SMTP_PORT` env vars.
- **Sender**: `BREVO_SENDER_EMAIL` secret; reply-to from `BREVO_REPLY_TO_EMAIL` secret.
- **Endpoints**: `POST /api/email/send-booking-confirmation`, `GET /api/email/test`.
- **Auto-trigger**: Confirmation emails sent on booking creation and update.
- **Templates**: "New Booking" and "Updated Booking" templates.

### Shift Tracking
- **Table**: `shifts` — tracks open/closed shifts per staff user (admin/driver).
- **Schema**: `id` (serial PK), `user_id` (Auth0 sub string), `shift_start`, `shift_end`, `last_activity_at`, `status` (`open`|`closed`), `created_at`.
- **Constraint**: Partial unique index `one_open_shift_per_user` ensures only one open shift per user at a time.
- **API**: `POST /api/shifts/start` (idempotent — opens or reuses existing), `POST /api/shifts/end` (closes open shift). Both require admin or driver role.
- **Frontend**: `ShiftService` calls these endpoints. `LayoutComponent` starts a shift on app load after Auth0 authentication (admin/driver only). `HeaderComponent` ends the shift before calling Auth0 logout.
- **Future use**: Intended to power a report linking `completion_transactions` to the shift during which they were recorded.

### Vehicle Photo Upload (S3)
- **DigitalOcean Spaces**: S3-compatible object storage.