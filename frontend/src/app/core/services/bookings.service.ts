import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BookingsResponse, BookingResponse } from '../../shared/models/booking.model';
import { getApiBaseUrl } from '../utils/api-url.util';

export interface BookingsQueryParams {
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookingsService {
  private baseUrl = `${getApiBaseUrl()}/bookings`;

  constructor(private http: HttpClient) {}

  getBookings(params?: BookingsQueryParams): Observable<BookingsResponse> {
    let httpParams = new HttpParams();

    if (params) {
      if (params.dateFrom) {
        httpParams = httpParams.set('dateFrom', params.dateFrom);
      }
      if (params.dateTo) {
        httpParams = httpParams.set('dateTo', params.dateTo);
      }
      if (params.search) {
        httpParams = httpParams.set('search', params.search);
      }
      if (params.page) {
        httpParams = httpParams.set('page', params.page.toString());
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
    }

    return this.http.get<BookingsResponse>(this.baseUrl, { params: httpParams });
  }

  getBooking(id: string): Observable<BookingResponse> {
    return this.http.get<BookingResponse>(`${this.baseUrl}/${id}`);
  }

  softDelete(id: string): Observable<{ success: boolean; data: { id: string; deleteflag: number } }> {
    return this.http.put<{ success: boolean; data: { id: string; deleteflag: number } }>(
      `${this.baseUrl}/${id}/delete`,
      {}
    );
  }

  updateBookingStatus(id: string, bookingStatusId: string): Observable<{ success: boolean; data: { id: string; bookingStatusId: string; bookingStatus: string } }> {
    return this.http.patch<{ success: boolean; data: { id: string; bookingStatusId: string; bookingStatus: string } }>(
      `${this.baseUrl}/${id}/status`,
      { bookingStatusId }
    );
  }
}
