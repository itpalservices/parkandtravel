import { Routes } from '@angular/router';

export const reportsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./reports.component').then((m) => m.ReportsComponent),
  },
  {
    path: 'wash-service',
    loadComponent: () =>
      import('./wash-service-report/wash-service-report.component').then((m) => m.WashServiceReportComponent),
  },
  {
    path: 'daily-in-out',
    loadComponent: () =>
      import('./daily-in-out-report/daily-in-out-report.component').then((m) => m.DailyInOutReportComponent),
  },
  {
    path: 'z-report',
    loadComponent: () =>
      import('./z-report/z-report.component').then((m) => m.ZReportComponent),
  },
  {
    path: 'pending-bookings',
    loadComponent: () =>
      import('./pending-bookings/pending-bookings-report.component').then((m) => m.PendingBookingsReportComponent),
  },
  {
    path: 'employee-session-report',
    loadComponent: () =>
      import('./employee-session-report/employee-session-report.component').then((m) => m.EmployeeSessionReportComponent),
  },
  {
    path: 'receipts',
    loadComponent: () =>
      import('./receipts-report/receipts-report.component').then((m) => m.ReceiptsReportComponent),
  },
  {
    path: 'z-reports',
    loadComponent: () =>
      import('./z-reports/z-reports.component').then((m) => m.ZReportsComponent),
  },
  {
    path: 'z-reports/:id',
    loadComponent: () =>
      import('./z-report-detail/z-report-detail.component').then((m) => m.ZReportDetailComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./report-detail/report-detail.component').then((m) => m.ReportDetailComponent),
  },
];
