import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

const ZEBRA_SERVICE_UUID = '38eb4a80-c570-11e3-9507-0002a5d5c51b';
const ZEBRA_WRITE_UUID   = '38eb4a82-c570-11e3-9507-0002a5d5c51b';
const CHUNK_SIZE = 182;

@Injectable({ providedIn: 'root' })
export class ZebraPrintService {
  private device: any = null;
  private characteristic: any = null;

  constructor(private http: HttpClient) {}

  get isSupported(): boolean {
    return 'bluetooth' in navigator;
  }

  get isConnected(): boolean {
    return !!this.device?.gatt?.connected;
  }

  async connect(): Promise<void> {
    if (!this.isSupported) throw new Error('Web Bluetooth is not supported in this browser. Use Chrome on Android.');

    const bt = (navigator as any).bluetooth;
    const device = await bt.requestDevice({
      filters: [
        { namePrefix: 'ZQ521' },
        { services: [ZEBRA_SERVICE_UUID] },
      ],
      optionalServices: [ZEBRA_SERVICE_UUID],
    });

    device.addEventListener('gattserverdisconnected', () => {
      this.device = null;
      this.characteristic = null;
    });

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(ZEBRA_SERVICE_UUID);
    this.characteristic = await service.getCharacteristic(ZEBRA_WRITE_UUID);
    this.device = device;
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) await this.connect();
  }

  private async sendData(zpl: string): Promise<void> {
    const data = new TextEncoder().encode(zpl);
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, Math.min(offset + CHUNK_SIZE, data.length));
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
      if (offset + CHUNK_SIZE < data.length) {
        await new Promise(r => setTimeout(r, 10));
      }
    }
  }

  async printThermalReceipt(receiptId: string): Promise<void> {
    const zpl = await firstValueFrom(
      this.http.get(`/api/receipts/thermal/${receiptId}/zpl`, { responseType: 'text' })
    );
    await this.ensureConnected();
    await this.sendData(zpl);
  }

  disconnect(): void {
    this.device?.gatt?.disconnect();
    this.device = null;
    this.characteristic = null;
  }
}
