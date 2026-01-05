export interface Booking {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  plateNo: string;
  carBrand: string | null;
  carModel: string | null;
  carColor: string | null;
  dateFrom: string;
  dateTo: string;
  timeFrom: string | null;
  timeTo: string | null;
  adults: number;
  returnFlight: string | null;
  parkingTypeId: string;
  parkingType?: string;
  deleteflag: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingsResponse {
  success: boolean;
  data: Booking[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BookingResponse {
  success: boolean;
  data: Booking;
}
