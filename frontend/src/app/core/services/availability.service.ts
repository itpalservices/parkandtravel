import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from '../utils/api-url.util';

export interface AvailabilityResult {
  available: boolean;
  unavailableDates: string[];
  message?: string;
  availableSpots?: number;
  totalSpots?: number;
}

export interface BothAvailabilityResult {
  covered: AvailabilityResult;
  uncovered: AvailabilityResult;
}

@Injectable({
  providedIn: 'root'
})
export class AvailabilityService {
  private baseUrl = `${getApiBaseUrl()}/availability`;

  constructor(private http: HttpClient) {}

  checkAvailability(dateFrom: string, dateTo: string, parkingTypeId: string, excludeBookingId?: string): Observable<AvailabilityResult> {
    let params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo)
      .set('parkingTypeId', parkingTypeId);
    
    if (excludeBookingId) {
      params = params.set('excludeBookingId', excludeBookingId);
    }
    
    return this.http.get<AvailabilityResult>(`${this.baseUrl}/check`, { params });
  }

  checkBothAvailability(dateFrom: string, dateTo: string): Observable<BothAvailabilityResult> {
    const params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo);
    
    return this.http.get<BothAvailabilityResult>(`${this.baseUrl}/both`, { params });
  }
}
