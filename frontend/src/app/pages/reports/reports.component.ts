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
      description: 'View daily summary reports'
    },
    {
      id: 'employee-z-report',
      title: 'Z-Report by Employee',
      description: 'View completion transactions by date range or drill down by employee and shift'
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
    },
    {
      id: 'pending-bookings',
      title: 'Pending Bookings Report',
      description: 'Pending bookings which they don\'t have check-out date or they don\'t checked-out at the correct date'
    }
  ];
}
