import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'bookings',
    loadChildren: () => import('./bookings/bookings.routes').then(m => m.bookingsRoutes)
  },
  {
    path: '',
    redirectTo: 'bookings',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'bookings'
  }
];
