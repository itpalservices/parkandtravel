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
    path: ':id',
    loadComponent: () =>
      import('./report-detail/report-detail.component').then((m) => m.ReportDetailComponent),
  },
];
