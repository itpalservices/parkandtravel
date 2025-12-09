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
      shared/                # Shared module
        models/
          booking.model.ts   # Booking interfaces
      bookings/              # Bookings feature module
        components/
          bookings-page/     # Main bookings page
          bookings-table/    # Desktop table with pagination
          bookings-mobile-list/ # Mobile card list with pagination
      pages/                 # Static pages
        dashboard/           # Dashboard page
        customers/           # Customers placeholder
        reports/             # Reports placeholder
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

## Recent Changes
- Added main layout with header, sidebar, and content area
- Created Dashboard, Customers, and Reports placeholder pages
- Redesigned bookings table with proper columns and pagination
- Redesigned mobile bookings list with card view and pagination
- Added responsive design with mobile hamburger menu
