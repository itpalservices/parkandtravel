import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-report-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './report-detail.component.html',
  styleUrl: './report-detail.component.scss'
})
export class ReportDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  
  reportId: string = '';
  reportTitle: string = '';

  private reportTitles: Record<string, string> = {
    'z-report': 'Z-Report by Employee',
    'daily-inout': 'Daily In/Out Report',
    'wash-service': 'Wash Service Report'
  };

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.reportId = params['id'];
      this.reportTitle = this.reportTitles[this.reportId] || 'Report';
    });
  }
}
