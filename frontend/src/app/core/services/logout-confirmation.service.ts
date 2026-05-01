import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LogoutConfirmationState, ShiftSummary } from '../../shared/models/shifts.model';

@Injectable({ providedIn: 'root' })
export class LogoutConfirmationService {
  private _state$ = new BehaviorSubject<LogoutConfirmationState>({
    visible: false,
    loading: false,
    summary: null,
  });

  state$ = this._state$.asObservable();

  show(): void {
    this._state$.next({ visible: true, loading: true, summary: null });
  }

  setSummary(summary: ShiftSummary): void {
    this._state$.next({ visible: true, loading: false, summary });
  }

  hide(): void {
    this._state$.next({ visible: false, loading: false, summary: null });
  }
}
