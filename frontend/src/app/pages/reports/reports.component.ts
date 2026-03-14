import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReportCard } from '../../shared/models/reports.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent {
  reports: ReportCard[] = [
    {
      id: 'z-report',
      title: 'Z-Report',
      description: 'View daily summary reports grouped'
    },
    {
      id: 'daily-inout',
      title: 'Daily In/Out Report',
      description: 'Track all check-ins and check-outs by date'
    },
    {
      id: 'wash-service',
      title: 'Wash Service Report',
      description: 'Monitor car wash service statistics'
    }
  ];
}
