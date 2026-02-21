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
  filterBy?: 'check-ins' | 'check-outs' | 'both';
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
      if (params.filterBy) {
        httpParams = httpParams.set('filterBy', params.filterBy);
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

  updateBookingStatus(id: string, bookingStatusId: string, parkPlace?: string, applyExtraFee?: boolean, extraFields?: { keepKeys?: boolean; mileageKm?: number; parkingComments?: string; plateNo?: string; carModel?: string; adults?: number }): Observable<{ success: boolean; data: { id: string; bookingStatusId: string; bookingStatus: string; parkPlace?: string; actualCheckOut?: string; extraFee?: number } }> {
    const body: Record<string, any> = { bookingStatusId };
    if (parkPlace) {
      body['parkPlace'] = parkPlace;
    }
    if (applyExtraFee !== undefined) {
      body['applyExtraFee'] = applyExtraFee;
    }
    if (extraFields) {
      Object.assign(body, extraFields);
    }
    return this.http.patch<{ success: boolean; data: { id: string; bookingStatusId: string; bookingStatus: string; parkPlace?: string; actualCheckOut?: string; extraFee?: number } }>(
      `${this.baseUrl}/${id}/status`,
      body
    );
  }

  uploadImages(bookingId: string, files: File[]): Observable<{ success: boolean; data: { urls: string[]; errors: string[] } }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return this.http.post<{ success: boolean; data: { urls: string[]; errors: string[] } }>(
      `${getApiBaseUrl()}/upload/${bookingId}/images`,
      formData
    );
  }

  getBookingImages(bookingId: string): Observable<{ success: boolean; data: { urls: string[] } }> {
    return this.http.get<{ success: boolean; data: { urls: string[] } }>(
      `${getApiBaseUrl()}/upload/${bookingId}/images`
    );
  }
}
