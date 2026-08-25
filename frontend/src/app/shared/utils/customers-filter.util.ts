import { Customer, CustomerSortDirection, CustomerSortField, CustomersFilterState } from '../models/customers.model';
import { matchesPrefix } from './bookings-filter.util';

export function createDefaultCustomersFilterState(): CustomersFilterState {
  return {
    name: '',
    email: '',
    phone: '',
    phoneCode: null,
    sortField: null,
    sortDirection: 'asc',
  };
}

/** Builds a single predicate from the panel's filters. */
export function buildCustomersPredicate(state: CustomersFilterState): (customer: Customer) => boolean {
  return (c: Customer): boolean => {
    // Full name matches on either first or last name, not only the concatenated string.
    if (state.name.trim() && !(matchesPrefix(c.name, state.name) || matchesPrefix(c.surname, state.name))) return false;
    if (!matchesPrefix(c.email, state.email)) return false;
    if (!matchesPrefix(c.phone, state.phone)) return false;
    if (state.phoneCode && c.phoneCode !== state.phoneCode) return false;
    return true;
  };
}

export function countActiveCustomerFilters(state: CustomersFilterState): number {
  let count = 0;
  if (state.name.trim()) count++;
  if (state.email.trim()) count++;
  if (state.phone.trim()) count++;
  if (state.phoneCode) count++;
  return count;
}

/** Empty values always sort last, regardless of direction. */
function compareStrings(a: string, b: string, direction: CustomerSortDirection): number {
  const aEmpty = !a.trim();
  const bEmpty = !b.trim();
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

function fieldComparator(field: CustomerSortField, direction: CustomerSortDirection): (a: Customer, b: Customer) => number {
  switch (field) {
    case 'name': return (a, b) => compareStrings(`${a.name} ${a.surname}`, `${b.name} ${b.surname}`, direction);
    case 'email': return (a, b) => compareStrings(a.email, b.email, direction);
    case 'phoneCode': return (a, b) => compareStrings(a.phoneCode ?? '', b.phoneCode ?? '', direction);
    case 'phone': return (a, b) => compareStrings(a.phone, b.phone, direction);
  }
}

/** No-op when `field` is null — matches the backend's own default (unsorted) order. */
export function sortCustomers(customers: Customer[], field: CustomerSortField | null, direction: CustomerSortDirection): Customer[] {
  if (!field) return customers;
  return [...customers].sort(fieldComparator(field, direction));
}

// ---------- URL query-param (de)serialization ----------

export function customersFilterStateToQueryParams(state: CustomersFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.name.trim()) params['name'] = state.name;
  if (state.email.trim()) params['email'] = state.email;
  if (state.phone.trim()) params['phone'] = state.phone;
  if (state.phoneCode) params['phoneCode'] = state.phoneCode;
  if (state.sortField) {
    params['sortBy'] = state.sortField;
    params['sortDir'] = state.sortDirection;
  }
  return params;
}

const SORT_FIELDS: CustomerSortField[] = ['name', 'email', 'phoneCode', 'phone'];

export function customersFilterStateFromQueryParams(
  params: Record<string, string | null>,
  fallback: CustomersFilterState,
): CustomersFilterState {
  const get = (key: string): string | null => (params[key] ? params[key] : null);

  const sortByRaw = get('sortBy');
  const sortField = sortByRaw && (SORT_FIELDS as string[]).includes(sortByRaw) ? (sortByRaw as CustomerSortField) : null;

  return {
    name: get('name') ?? fallback.name,
    email: get('email') ?? fallback.email,
    phone: get('phone') ?? fallback.phone,
    phoneCode: get('phoneCode') ?? fallback.phoneCode,
    sortField,
    sortDirection: (get('sortDir') as CustomerSortDirection) ?? fallback.sortDirection,
  };
}
