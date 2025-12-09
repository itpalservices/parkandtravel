import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';

export const appRoutes: Routes = [
  {
    path: '',
    component: LayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'bookings',
        loadChildren: () => import('./bookings/bookings.routes').then(m => m.bookingsRoutes)
      },
      {
        path: 'customers',
        loadComponent: () => import('./pages/customers/customers.component').then(m => m.CustomersComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: '',
        redirectTo: 'bookings',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'bookings'
  }
];
