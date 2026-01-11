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
- **Tables**: Includes `bookings`, `cars`, `configuration_settings`, `phone_codes`.

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
- **User Profile**: Users can view and update their name, surname, and phone number. Email is displayed but not editable.
- **Car Management**: Regular users can add, edit, and delete their cars.
- **Configuration Settings**: Admin users can manage parking availability, prices per day, and car wash service options.

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