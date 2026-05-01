import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Observable, catchError, of } from 'rxjs';
import { ShiftSummary } from '../../shared/models/shifts.model';

@Injectable({
  providedIn: 'root'
})
export class ShiftService {
  private apiService = inject(ApiService);

  startShift(): void {
    this.apiService.post<any>('/shifts/start', {}).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  ensureShift(): Promise<void> {
    return new Promise(resolve => {
      this.apiService.post<any>('/shifts/start', {}).pipe(
        catchError(() => of(null))
      ).subscribe(() => resolve());
    });
  }

  endShift(): Promise<void> {
    return new Promise(resolve => {
      this.apiService.post<any>('/shifts/end', {}).pipe(
        catchError(() => of(null))
      ).subscribe(() => resolve());
    });
  }

  getShiftSummary(): Observable<ShiftSummary> {
    return this.apiService.get<ShiftSummary>('/shifts/summary');
  }
}
