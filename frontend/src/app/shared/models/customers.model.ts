export interface Customer {
  userId: string;
  email: string;
  name: string;
  surname: string;
  phone: string;
  phoneCode: string;
}

/** One key per sortable customers-table column. */
export type CustomerSortField = 'name' | 'email' | 'phoneCode' | 'phone';

export type CustomerSortDirection = 'asc' | 'desc';

/** Full filter + sort state for the customers filter panel. */
export interface CustomersFilterState {
  name: string;
  email: string;
  phone: string;
  phoneCode: string | null;
  sortField: CustomerSortField | null;
  sortDirection: CustomerSortDirection;
}