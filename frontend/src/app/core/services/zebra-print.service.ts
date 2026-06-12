import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ZebraPrintService {
  private readonly agentUrl = 'http://localhost:9100';

  constructor(private http: HttpClient) {}

  async printThermalReceipt(receiptId: string): Promise<void> {
    const zpl = await firstValueFrom(
      this.http.get(`/api/receipts/thermal/${receiptId}/zpl`, { responseType: 'text' })
    );
    await this.sendZpl(zpl);
  }

  async printCheckinReceipt(bookingId: string): Promise<void> {
    const zpl = await firstValueFrom(
      this.http.get(`/api/bookings/${bookingId}/checkin-receipt/zpl`, { responseType: 'text' })
    );
    await this.sendZpl(zpl);
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
