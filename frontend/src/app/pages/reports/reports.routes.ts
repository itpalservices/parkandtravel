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
    path: 'drivers',
    loadComponent: () =>
      import('./drivers/drivers.component').then((m) => m.DriversComponent),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./report-detail/report-detail.component').then((m) => m.ReportDetailComponent),
  },
];
