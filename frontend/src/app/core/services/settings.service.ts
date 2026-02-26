import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConfigurationSettings {
  availableUncovered: number | null;
  availableCovered: number | null;
  priceUncovered: number | null;
  priceCovered: number | null;
  priceWash: number | null;
  dayEnd: number | null;
  deliveryFee: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);

  getSettings(): Observable<ConfigurationSettings> {
    return this.http.get<ConfigurationSettings>('/api/settings');
  }

  updateSettings(data: Partial<ConfigurationSettings>): Observable<ConfigurationSettings> {
    return this.http.put<ConfigurationSettings>('/api/settings', data);
  }
}
