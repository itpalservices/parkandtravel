# replit.md

## Overview

This is a full-stack web application with an Angular frontend and Express.js backend. The project follows a monorepo-style structure with separate `frontend` and `backend` directories featuring modular architecture. It is a **Park & Travel** parking booking admin panel.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Angular 21 with standalone components
- **Styling**: SCSS with Bootstrap 5.3 for UI components
- **UI Libraries**: 
  - ng-bootstrap for Angular-native Bootstrap components
  - SweetAlert2 for dialogs/notifications
- **Build System**: Angular CLI with Vite-based build tooling
- **HTTP Client**: Angular HttpClient with base URL interceptor
- **Routing**: Angular Router with lazy-loaded feature modules and layout wrapper

### Frontend Module Structure
- **Layout Module** (`src/app/layout/`): Main layout with header, sidebar navigation
- **Core Module** (`src/app/core/`): API service, HTTP interceptor
- **Shared Module** (`src/app/shared/`): Reusable components, directives, pipes, UI elements
- **Bookings Feature Module** (`src/app/bookings/`): Bookings page with table and mobile list
- **Pages** (`src/app/pages/`): Dashboard, Customers, Reports pages

### UI Layout
- **Header**: Blue header bar with Park & Travel logo, user/settings/notification icons
- **Sidebar**: Left navigation with Home, Bookings, Customers, Reports links
- **Content Area**: Main content with page-specific components
- **Responsive Design**: Mobile hamburger menu, sidebar drawer, mobile-optimized views

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Entry Points**: 
  - `app.ts` - Express app configuration (exported)
  - `server.ts` - Server startup (imports and runs app)
- **Development**: ts-node-dev for hot reloading
- **API Pattern**: RESTful API with `/api` prefix
- **CORS**: Enabled for cross-origin requests

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Connection**: Uses `pg` (node-postgres) connection pool
- **Configuration**: Database URL provided via `DATABASE_URL` environment variable
- **Schema Location**: `backend/src/db/index.ts`

### Project Structure
```
frontend/                    # Angular 21 project (port 4200, proxied through 5000)
  src/
    app/
      layout/                # Layout components
        components/
          header/            # App header with logo and icons
          sidebar/           # Navigation sidebar
        layout.component.ts  # Main layout wrapper
      core/                  # Core module
        services/
          api.service.ts     # Centralized API service
          bookings.service.ts # Bookings API service
        interceptors/
          http.interceptor.ts # Base URL interceptor
        guards/
          auth.guard.ts      # Auth guard for protected routes
      shared/                # Shared module
        components/
          date-range-picker/ # Reusable date range picker with presets
        models/
          booking.model.ts   # Booking interfaces
      pages/                 # All page components
        landing/             # Landing page with guest/login options
        guest-booking/       # Guest booking form
        dashboard/           # Dashboard page
        customers/           # Customers placeholder
        reports/             # Reports placeholder
        bookings/            # Bookings feature module
          components/
            bookings-page/     # Main bookings page with search/filters
            bookings-list/     # Unified list component (responsive: table on desktop, cards on mobile)
      app-routing.module.ts  # Routes with layout wrapper
      app.config.ts          # App configuration with zone.js
    styles/
      _variables.scss        # SCSS variables
  angular.json               # Configured with host 0.0.0.0:4200, allowedHosts: true

backend/                     # Express + TypeScript backend (port 5000)
  src/
    app.ts                   # Express app with proxy to Angular
    server.ts                # Server entry point
    db/                      # Drizzle ORM connection
    routes/                  # API route handlers
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe SQL query builder and ORM

### Frontend Libraries
- **Bootstrap 5.3**: CSS framework for responsive design
- **@ng-bootstrap/ng-bootstrap**: Angular-specific Bootstrap components
- **zone.js**: Change detection for Angular 21

### Backend Libraries
- **Express.js**: Web server framework
- **http-proxy-middleware**: Proxy requests to Angular dev server
- **cors**: Cross-origin resource sharing middleware

## Workflows
- **Frontend**: `cd frontend && npm start` - Angular dev server on port 4200
- **Backend**: `cd backend && npm run dev` - Express dev server on port 5000 (proxies to frontend)

## Authentication

### Auth0 Integration
- **SDK**: @auth0/auth0-angular for SPA authentication
- **Configuration**: `frontend/src/environments/environment.ts`
  - Set `auth0Domain` and `auth0ClientId` with your Auth0 application credentials
- **Flow**: 
  - Landing page (/) shows "Proceed as Guest" and "Login" buttons
  - Login redirects to Auth0 login flow
  - After login, admins are redirected to /admin/dashboard, users/drivers to /admin/bookings
  - Guest users can create bookings without authentication
- **Protected Routes**: All /admin/* routes require authentication

### User Roles
The system supports three user roles: **admin**, **driver**, and **user**.

**Role Permissions:**
- **Admin**: Full access to Dashboard, Bookings, Customers, and Reports (sees all bookings)
- **Driver**: Access to Bookings only (sees all bookings)
- **User**: Access to Bookings only (sees only their own bookings filtered by email)

**Auth0 Role Configuration:**
To set up roles in Auth0, create a Post Login Action with the following code:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://park-and-travel/roles';
  
  // Get user's role from app_metadata (set during registration)
  // Default to 'user' if no role is set
  const role = event.user.app_metadata?.role || 'user';
  
  // Add role to the ID token and access token
  api.idToken.setCustomClaim(namespace, role);
  api.accessToken.setCustomClaim(namespace, role);
};
```

**Setting User Roles:**
- New users automatically get the 'user' role (default)
- To assign a different role, update the user's `app_metadata.role` in Auth0 Dashboard or via Management API:
  ```json
  { "role": "admin" }  // or "driver" or "user"
  ```

### Route Structure
- `/` - Landing page (public)
- `/guest/book` - Guest booking form (public)
- `/admin/*` - Protected admin routes (requires Auth0 login)
- `/admin/dashboard` - Admin only
- `/admin/bookings` - All authenticated users
- `/admin/customers` - Admin only
- `/admin/reports` - Admin only

## API Endpoints

### Public Endpoints
- `GET /api/health` - Health check
- `GET /api/parking-types` - List parking types
- `GET /api/phone-codes` - List phone codes with ISO country codes
- `POST /api/bookings/guest` - Create guest booking (includes phoneCodeId)

### Protected Endpoints (Admin)
- `GET /api/bookings` - List bookings with filters
- `GET /api/bookings/:id` - Get booking by ID
- `PUT /api/bookings/:id/delete` - Soft delete booking

## Recent Changes
- Added main layout with header, sidebar, and content area
- Created Dashboard, Customers, and Reports placeholder pages
- Redesigned bookings table with proper columns and pagination
- Redesigned mobile bookings list with card view and pagination
- Added responsive design with mobile hamburger menu
- Added shared DateRangePickerComponent with preset options (Today, Tomorrow, Next 7 Days, Next 30 Days, Custom Range)
- Custom Range shows two side-by-side ngb-datepicker calendars with Apply button
- Past dates are disabled in date picker (only today and future dates allowed)
- Bookings table filters by check-in date based on selected date range
- Added landing page with "Proceed as Guest" and "Login" buttons
- Implemented Auth0 authentication integration
- Created guest booking form for public users
- Added auth guard to protect admin routes
- Updated sidebar navigation to use /admin/* routes
- Consolidated bookings-table and bookings-mobile-list into single BookingsListComponent with CSS media queries
- Converted guest booking form to reactive forms with validation
- Created shared FormFieldErrorComponent for consistent validation error messages
- Updated guest booking form with input fields that open ngb-datepicker popup on click
- Check-in date enabled from tomorrow, check-out from day after check-in
- Default check-in is tomorrow, check-out is day after tomorrow
- Date format in inputs: dd/MM/yyyy
- Datepicker closes automatically when clicking outside
- Added @angular/localize polyfill to support ng-bootstrap components
- Added phone_codes database table (id, isoCode, phoneCode) with 35 country codes
- Added phoneCodeId foreign key column to bookings table
- Created GET /api/phone-codes endpoint for retrieving phone codes
- Updated guest booking form with ngbDropdown for country code selection with flags
- Phone number field now has separate country code dropdown and phone number input
- Country flags loaded from flagcdn.com using ISO country codes
- Cyprus (+357) is selected as default phone code
- Flight number field is now optional
- Implemented role-based access control with three roles (admin, driver, user)
- Created RoleService to extract user roles from Auth0 tokens
- Updated sidebar to show/hide menu items based on user role
- Added adminOnlyGuard to protect admin-only routes (dashboard, customers, reports)
- Non-admin users are automatically redirected to bookings page
- Updated header: removed cog and notification icons, made avatar clickable to user-profile page
- Added email verification indicator (red dot) on avatar when user's email is not verified (from Auth0)
- Created user-profile page at /admin/user-profile with reactive form
- User profile fetches and updates user data from Auth0 (name, surname, phone)
- Email field is disabled and not editable
- Added Auth0 Management API integration for user profile updates
- Backend endpoints: GET/PUT /api/user/profile
