import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/guards/auth.guard';
import { adminOnlyGuard } from './core/guards/role-redirect.guard';

export const appRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'guest/book',
    loadComponent: () =>
      import('./pages/guest-booking/guest-booking.component').then((m) => m.GuestBookingComponent),
  },
  {
    path: 'admin',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'bookings',
        loadChildren: () =>
          import('./pages/bookings/bookings.routes').then((m) => m.bookingsRoutes),
      },
      {
        path: 'customers',
        canActivate: [adminOnlyGuard],
        loadComponent: () =>
          import('./pages/customers/customers.component').then((m) => m.CustomersComponent),
      },
      {
        path: 'reports',
        canActivate: [adminOnlyGuard],
        loadChildren: () =>
          import('./pages/reports/reports.routes').then((m) => m.reportsRoutes),
      },
      {
        path: 'user-profile',
        loadComponent: () =>
          import('./pages/user-profile/user-profile.component').then((m) => m.UserProfileComponent),
      },
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin-redirect/admin-redirect.component').then((m) => m.AdminRedirectComponent),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
