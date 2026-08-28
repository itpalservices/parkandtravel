import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PrintProgressService } from './print-progress.service';

@Injectable({ providedIn: 'root' })
export class ZebraPrintService {
  private readonly agentUrl = 'http://localhost:9100';
  private http = inject(HttpClient);
  private progress = inject(PrintProgressService);

  async printThermalReceipt(receiptId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/receipts/thermal/${receiptId}/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  async printCheckinReceipt(bookingId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/bookings/${bookingId}/checkin-receipt/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  async printCheckinPaymentReceipt(bookingId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/bookings/${bookingId}/checkin-payment/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  async printCompletionPaymentReceipt(bookingId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/bookings/${bookingId}/completion-payment/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  async printPrepaidPaymentReceipt(bookingId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/bookings/${bookingId}/prepaid-payment/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  async printBookingTag(bookingId: string): Promise<void> {
    await this.run(() =>
      this.http.get(`/api/bookings/${bookingId}/booking-tag/zpl`, { responseType: 'text' })
        .toPromise().then(zpl => this.sendZpl(zpl!))
    );
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.progress.start();
    try {
      await action();
      this.progress.success();
    } catch (err: any) {
      this.progress.error(err?.message || 'Print failed. Please try again.');
    }
  }

  private async sendZpl(zpl: string): Promise<void> {
    const available = await firstValueFrom(
      this.http.get<{ printer?: any[] }>(`${this.agentUrl}/available`)
    ).catch(() => {
      throw new Error('Zebra Browser Print is not running. Please open the app and try again.');
    });

    const printer = available?.printer?.[0];
    if (!printer) {
      throw new Error('No Zebra printer found. Make sure the ZQ521 is connected in Browser Print.');
    }

    await firstValueFrom(
      this.http.post(`${this.agentUrl}/write`, { device: printer, data: zpl }, { responseType: 'text' })
    );
  }
}
