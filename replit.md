# replit.md

## Overview

This is a full-stack web application with an Angular frontend and Express.js backend. The project follows a monorepo-style structure with separate `frontend` and `backend` directories. The application appears to be in early development stages with basic scaffolding in place.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Angular 21 with standalone components (no NgModules required)
- **Styling**: SCSS with Bootstrap 5.3 for UI components
- **UI Libraries**: 
  - ng-bootstrap for Angular-native Bootstrap components
  - ngx-datatable for data tables
  - SweetAlert2 for dialogs/notifications
- **Build System**: Angular CLI with Vite-based build tooling
- **Testing**: Vitest for unit tests
- **Routing**: Angular Router (currently empty routes configured)

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Development**: ts-node-dev for hot reloading during development
- **API Pattern**: RESTful API with `/api` prefix (health check endpoint exists at `/api/health`)
- **CORS**: Enabled for cross-origin requests from frontend

### Database Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Connection**: Uses `pg` (node-postgres) connection pool
- **Configuration**: Database URL provided via `DATABASE_URL` environment variable
- **Schema Location**: `backend/src/db/index.ts` - Backend database connection with Drizzle ORM

### Project Structure
```
frontend/           # Angular 21 project (port 5000)
  src/
  angular.json      # Configured with host 0.0.0.0:5000, allowedHosts: true

backend/            # Express + TypeScript backend (port 3000)
  src/
    index.ts        # Express server entry point
    db/index.ts     # Drizzle ORM connection
    routes/
    controllers/
    services/
    models/
    config/
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