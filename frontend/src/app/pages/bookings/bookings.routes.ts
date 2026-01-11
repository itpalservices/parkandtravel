import { Routes } from '@angular/router';
import { BookingsPageComponent } from './components/bookings-page/bookings-page.component';

export const bookingsRoutes: Routes = [
  {
    path: '',
    component: BookingsPageComponent
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./components/booking-form/booking-form.component').then(
        (m) => m.BookingFormComponent
      ),
  }
];
