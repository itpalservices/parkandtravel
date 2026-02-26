# replit.md

## Overview

This is a full-stack web application designed as an admin panel for a "Park & Travel" parking booking system. It features an Angular frontend and an Express.js backend, organized in a monorepo structure. The application allows administrators to manage bookings, customers, and reports, while also providing functionalities for guest users to book parking and authenticated users to manage their profiles and car details. The project aims to provide a comprehensive, responsive, and role-based access controlled platform for parking management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: Angular 21 with standalone components.
- **Styling**: SCSS with Bootstrap 5.3 and ng-bootstrap for UI components.
- **UI/UX**: Responsive design with a blue header, left sidebar navigation (Home, Bookings, Customers, Reports), and a main content area. Features a unified bookings list component adaptable for desktop tables and mobile cards, and a shared date range picker.
- **Routing**: Angular Router with lazy-loaded feature modules and layout wrapper.
- **Modules**: Modular structure including Layout, Core (API service, HTTP interceptor), Shared (reusable components), and specific feature modules (e.g., Bookings, User Profile).

### Backend
- **Framework**: Express.js with TypeScript.
- **API**: RESTful API with a `/api` prefix, handling public and protected endpoints.
- **CORS**: Enabled for cross-origin requests.

### Database
- **Type**: PostgreSQL.
- **ORM**: Drizzle ORM for type-safe SQL queries.
- **Schema**: Managed in `backend/src/db/index.ts`.
- **Tables**: Includes `bookings`, `booking_statuses`, `cars`, `configuration_settings`, `phone_codes`, `parking_types`.

### Authentication & Authorization
- **Provider**: Auth0 for user authentication.
- **Integration**: `@auth0/auth0-angular` SDK.
- **Roles**: Supports `admin`, `driver`, and `user` roles with role-based access control (RBAC) implemented via Auth0 custom claims and Angular route guards.
  - **Admin**: Full access.
  - **Driver**: Access to bookings (sees all).
  - **User**: Access to bookings (sees only their own) and car management.
- **Features**: Landing page with guest/login options, protected admin routes, user profile management (including email verification status and resending verification emails), and car management for regular users.

### Core Features
- **Booking Management**: Guest and authenticated user booking creation, listing with filters, soft deletion. Includes options for car wash service and car transport (self-drive, airport pickup/delivery).
- **Booking Statuses**: Each booking has a status (Created, Parked, Completed) stored in the `booking_statuses` table. New bookings default to "Created" status. Status is displayed as the first column in the bookings list with color-coded badges (yellow for Created, blue for Parked, green for Completed). Admins and drivers can click the status badge to see a dropdown menu for updating the status. Status transitions are one-way: Created → Parked → Completed. When a booking status is "Parked", the edit option is hidden. API endpoint: PATCH /api/bookings/:id/status.
- **Park Place**: When changing a booking status from Created to Parked, a modal prompts the user to enter the parking place (e.g., A-15, B-22). This field is required and stored in the `parkPlace` column. The parking place is included in all booking responses.
- **User Profile**: Users can view and update their name, surname, and phone number. Email is displayed but not editable.
- **Car Management**: Regular users can add, edit, and delete their cars.
- **Configuration Settings**: Admin users can manage parking availability, prices per day, car wash service options, delivery fee (car delivery from/to airport), and email description text.

### Booking Form Features
- **Regular Users**: Personal info (email, phone, fullName) auto-filled from profile and disabled when values exist. Car selection dropdown to choose from saved vehicles. Add New Car modal if no saved vehicles exist.
- **Admin/Driver Users**: Email field enabled initially, phone and fullName fields disabled. When email is entered and focus leaves, system searches Auth0 for matching regular users (excluding admin/driver roles). If found, fields are auto-filled, userId is set, and the user's saved cars are loaded in a dropdown. Phone search also supported: when phone number + phone code are entered and focus leaves the phone field, system searches Auth0 by phone metadata. If found via phone, email is auto-filled and disabled. Admin/driver can add new cars to the found user's account. If not found, fields are enabled for manual entry and userId is null.
- Toast notifications for success/error messages using SweetAlert2.

### Customers Management
- **Admin Only**: Only admin users can view the customers list.
- **Data Source**: Fetches all regular users from Auth0 (excludes admins and drivers based on app_metadata.role).
- **Display**: Shows email, name, surname, phone code (with country flag), and phone number.
- **Phone Flags**: Phone codes are matched against the phone_codes database table to display country flags from flagcdn.com.
- **Responsive**: Desktop table view and mobile card view matching the bookings list styling.

## External Dependencies

### Database
- **PostgreSQL**: Relational database.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.

### Frontend Libraries
- **Bootstrap 5.3**: CSS framework.
- **@ng-bootstrap/ng-bootstrap**: Angular-native Bootstrap components.
- **SweetAlert2**: For dialogs and notifications.
- **@auth0/auth0-angular**: Auth0 SDK for Angular SPAs.
- **zone.js**: Required for Angular change detection.

### Backend Libraries
- **Express.js**: Web application framework.
- **http-proxy-middleware**: For proxying requests in development.
- **cors**: Middleware for enabling Cross-Origin Resource Sharing.

### Services
- **Auth0**: Identity management platform for authentication and authorization.
- **flagcdn.com**: For country flag icons used in phone code selection.
- **Brevo**: Transactional email service for booking confirmation emails.

### Email Integration
- **Provider**: Brevo (formerly Sendinblue) for transactional emails.
- **Library**: `@getbrevo/brevo` SDK.
- **Endpoints**:
  - `POST /api/email/send-booking-confirmation` - Send booking confirmation email manually.
  - `GET /api/email/test` - Test Brevo connection.
- **Auto-trigger**: Booking confirmation emails are sent automatically on every booking creation and update (guest and authenticated).
- **Templates**:
  - **New Booking**: Green header with "Booking Confirmed!" title, subject "Booking Confirmed - Park & Travel".
  - **Updated Booking**: Blue header with "Booking Updated!" title, subject "Booking Updated - Park & Travel".
- **Required Secrets**:
  - `BREVO_API_KEY` - Brevo API key (required).
  - `BREVO_SENDER_EMAIL` - Verified sender email address (optional, defaults to it.pal.service@gmail.com).
  - `BREVO_REPLY_TO_EMAIL` - Reply-to email address (optional, defaults to support@parkandtravel.com).

### Parking Availability Check
- **Real-time Validation**: When creating or updating a booking (guest or authenticated), the system checks parking availability for the selected dates and parking type.
- **Backend Service**: `backend/src/services/availability.service.ts` provides `checkAvailability()` function that:
  - Counts existing active bookings (deleteflag=0) that overlap with the requested date range
  - Supports optional `excludeBookingId` parameter to exclude current booking from count when editing
  - Compares against configured availability (availableCovered or availableUncovered from configuration_settings)
  - Returns availability status, unavailable dates, and remaining spots
- **API Endpoints**:
  - `GET /api/availability/check?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&parkingTypeId=parkingType_covered|parkingType_uncovered&excludeBookingId=id` - Check availability for specific parking type
  - `GET /api/availability/both?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD` - Check availability for both parking types
- **Frontend Integration**:
  - Availability is checked automatically when dates or parking type change in booking forms (both create and edit modes)
  - In edit mode, the current booking is excluded from availability count using excludeBookingId
  - Visual feedback shows: "Checking availability...", "Parking available (X spots remaining)", or error message with unavailable dates
  - Submit button is disabled when parking is not available
  - Backend validation also prevents booking creation/update if no spots available
- **Booking Validation**: `createBooking`, `createGuestBooking`, and `updateBooking` services validate availability before inserting/updating bookings

### Vehicle Photo Upload (S3)
- **Storage**: DigitalOcean Spaces (S3-compatible) for vehicle photo storage.
- **Backend Service**: `backend/src/services/upload.service.ts` handles upload/delete operations.
- **S3 Config**: `backend/src/config/s3.config.ts` - S3 client configuration with virtual-host style URLs.
- **API Endpoint**: `POST /api/upload/:bookingId/images` - Multipart upload (multer), max 10 files, 10MB each, JPG/PNG/WEBP only.
- **Public URL Format**: `https://{bucket}.{region}.digitaloceanspaces.com/bookings/{bookingId}/{uniqueId}.{ext}`
- **Authorization**: Only admin and driver roles can upload images. Booking must exist.
- **Frontend Integration**: When changing booking status to "Parked", the modal includes a drag-and-drop image upload area. Images are uploaded after the status update succeeds. Upload failures show a toast error but don't block the status change.
- **Required Secrets**: `DO_SPACE_ENDPOINT`, `DO_SPACE_REGION`, `DO_SPACE_KEY`, `DO_SPACE_SECRET`, `DO_SPACE_BUCKET`.