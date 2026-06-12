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

    const available = await firstValueFrom(
      this.http.get<{ printer?: any[] }>(`${this.agentUrl}/available`)
    ).catch(() => {
      throw new Error('Zebra Browser Print is not running. Please open the app and try again.');
    });

    const printer = available?.printer?.[0];
    if (!printer) {
      throw new Error('No Zebra printer found. Make sure the ZQ521 is connected in Browser Print.');
    }

    // Ensure printer is in ZPL mode (works even if printer is currently in CPCL mode)
    await firstValueFrom(
      this.http.post(`${this.agentUrl}/write`, { device: printer, data: '! U1 setvar "device.languages" "ZPL"\r\n' }, { responseType: 'text' })
    ).catch(() => {});

    await firstValueFrom(
      this.http.post(`${this.agentUrl}/write`, { device: printer, data: zpl }, { responseType: 'text' })
    );
  }
}
