import { Routes } from '@angular/router';
import { BookingsPageComponent } from './components/bookings-page/bookings-page.component';
import { FormAction } from '../../shared/enums/form-action.enum';

export const bookingsRoutes: Routes = [
  {
    path: '',
    component: BookingsPageComponent,
    pathMatch: 'full'
  },
  {
    path: FormAction.Add,
    loadComponent: () =>
      import('./components/booking-form/booking-form.component').then(
        (m) => m.BookingFormComponent
      ),
  },
  {
    path: FormAction.Edit+'/:id',
    loadComponent: () =>
      import('./components/booking-form/booking-form.component').then(
        (m) => m.BookingFormComponent
      ),
  }
];
