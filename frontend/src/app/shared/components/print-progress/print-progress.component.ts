import { Component, inject } from '@angular/core';
import { PrintProgressService } from '../../../core/services/print-progress.service';

@Component({
  selector: 'app-print-progress',
  standalone: true,
  templateUrl: './print-progress.component.html',
  styleUrl: './print-progress.component.scss',
})
export class PrintProgressComponent {
  protected progress = inject(PrintProgressService);
}
