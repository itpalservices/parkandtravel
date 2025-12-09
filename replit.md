# replit.md

## Overview

This is a full-stack web application with an Angular frontend and Express.js backend. The project follows a monorepo-style structure with separate `frontend` and `backend` directories featuring modular architecture.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Angular 21 with standalone components
- **Styling**: SCSS with Bootstrap 5.3 for UI components
- **UI Libraries**: 
  - ng-bootstrap for Angular-native Bootstrap components
  - ngx-datatable for data tables
  - SweetAlert2 for dialogs/notifications
- **Build System**: Angular CLI with Vite-based build tooling
- **HTTP Client**: Angular HttpClient with base URL interceptor
- **Routing**: Angular Router with lazy-loaded feature modules

### Frontend Module Structure
- **Core Module** (`src/app/core/`): API service, HTTP interceptor
- **Shared Module** (`src/app/shared/`): Reusable components, directives, pipes, UI elements
- **Bookings Feature Module** (`src/app/bookings/`): Feature-specific components and routing

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
frontend/                    # Angular 21 project (port 5000)
  src/
    app/
      core/                  # Core module
        services/
          api.service.ts     # Centralized API service
        interceptors/
          http.interceptor.ts # Base URL interceptor
        index.ts             # Barrel exports
      shared/                # Shared module
        components/          # Reusable components
        directives/          # Custom directives
        pipes/               # Custom pipes
        ui/                  # Reusable UI elements
        index.ts
      bookings/              # Bookings feature module
        components/          # Feature components
        routing/             # Feature routing
        bookings.routes.ts   # Feature routes
        index.ts
      app-routing.module.ts  # Main app routes
      app.config.ts          # App configuration with providers
    environments/
      environment.ts         # Dev environment config
      environment.prod.ts    # Prod environment config
    styles/
      _variables.scss        # SCSS variables (colors, spacing)
      _mixins.scss           # Responsive mixins
    styles.scss              # Global styles
  angular.json               # Configured with host 0.0.0.0:5000, allowedHosts: true

backend/                     # Express + TypeScript backend (port 3000)
  src/
    app.ts                   # Express app (exported)
    server.ts                # Server entry point
    db/
      index.ts               # Drizzle ORM connection
    routes/                  # API route handlers
    controllers/             # Request controllers
    services/                # Business logic
    models/                  # Data models
    middleware/              # Custom middleware
    config/                  # Configuration files
  package.json
  tsconfig.json
```

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe SQL query builder and ORM

### Frontend Libraries
- **Bootstrap 5.3**: CSS framework for responsive design
- **@ng-bootstrap/ng-bootstrap**: Angular-specific Bootstrap components
- **@popperjs/core**: Tooltip/popover positioning (Bootstrap dependency)
- **@swimlane/ngx-datatable**: Advanced data table component
- **SweetAlert2**: Modern popup/dialog library
- **RxJS**: Reactive programming library (Angular core dependency)

### Backend Libraries
- **Express.js**: Web server framework
- **cors**: Cross-origin resource sharing middleware
- **dotenv**: Environment variable management
- **pg**: PostgreSQL client for Node.js

### Development Tools
- **TypeScript**: Both frontend (~5.9) and backend (~5.3) use TypeScript
- **Angular CLI**: Frontend build and scaffolding tool
- **ts-node-dev**: Backend development server with hot reload

## Workflows
- **Frontend**: `cd frontend && npm start` - Angular dev server on port 5000
- **Backend**: `cd backend && npm run dev` - Express dev server on port 3000
