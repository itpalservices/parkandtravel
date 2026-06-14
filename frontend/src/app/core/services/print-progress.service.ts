import { Injectable, signal } from '@angular/core';

export type PrintStatus = 'idle' | 'printing' | 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class PrintProgressService {
  private _status = signal<PrintStatus>('idle');
  private _message = signal('');
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly status = this._status.asReadonly();
  readonly message = this._message.asReadonly();

  start(): void {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this._status.set('printing');
    this._message.set('');
  }

  success(): void {
    this._status.set('success');
    this._hideTimer = setTimeout(() => this.hide(), 3000);
  }

  error(msg: string): void {
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this._status.set('error');
    this._message.set(msg);
  }

  hide(): void {
    this._status.set('idle');
    this._message.set('');
  }
}
