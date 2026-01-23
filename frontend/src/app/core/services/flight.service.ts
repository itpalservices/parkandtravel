import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getApiBaseUrl } from '../utils/api-url.util';

export interface FlightValidationResponse {
  success: boolean;
  data?: {
    flightNumber: string;
    airline: string;
    departure: {
      airport: string;
      iata: string;
      scheduled: string;
    };
    arrival: {
      airport: string;
      iata: string;
      scheduled: string;
    };
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FlightService {
  private baseUrl = `${getApiBaseUrl()}/flight`;

  constructor(private http: HttpClient) {}

  validateFlightNumber(flightNumber: string): Observable<FlightValidationResponse> {
    return this.http.get<FlightValidationResponse>(`${this.baseUrl}/validate`, {
      params: { flightNumber }
    });
  }
}
