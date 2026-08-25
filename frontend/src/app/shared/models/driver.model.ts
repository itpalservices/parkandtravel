export interface Driver {
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
  blocked: boolean;
  idNumber?: string;
  address?: string;
}

/** One key per sortable drivers-table column. */
export type DriverSortField = 'name' | 'email' | 'phoneCode' | 'phone' | 'status';

export type DriverSortDirection = 'asc' | 'desc';

/** Full filter + sort state for the drivers filter panel. */
export interface DriversFilterState {
  name: string;
  email: string;
  phone: string;
  phoneCode: string | null;
  status: string[]; // 'active' | 'inactive'
  sortField: DriverSortField | null;
  sortDirection: DriverSortDirection;
}
