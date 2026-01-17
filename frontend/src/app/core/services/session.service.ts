import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private sessionExpiredSubject = new BehaviorSubject<boolean>(false);
  sessionExpired$ = this.sessionExpiredSubject.asObservable();

  setSessionExpired(): void {
    if (!this.sessionExpiredSubject.value) {
      this.sessionExpiredSubject.next(true);
    }
  }

  resetSession(): void {
    this.sessionExpiredSubject.next(false);
  }
}
