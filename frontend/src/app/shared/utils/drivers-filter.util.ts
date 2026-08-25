import { Driver, DriverSortDirection, DriverSortField, DriversFilterState } from '../models/driver.model';
import { matchesPrefix } from './bookings-filter.util';

export function createDefaultDriversFilterState(): DriversFilterState {
  return {
    name: '',
    email: '',
    phone: '',
    phoneCode: null,
    status: [],
    sortField: null,
    sortDirection: 'asc',
  };
}

function statusKey(d: Driver): 'active' | 'inactive' {
  return d.blocked ? 'inactive' : 'active';
}

/** Builds a single predicate from the panel's filters. */
export function buildDriversPredicate(state: DriversFilterState): (driver: Driver) => boolean {
  return (d: Driver): boolean => {
    // Full name matches on either first or last name, not only the concatenated string.
    if (state.name.trim() && !(matchesPrefix(d.name, state.name) || matchesPrefix(d.surname, state.name))) return false;
    if (!matchesPrefix(d.email, state.email)) return false;
    if (!matchesPrefix(d.phone, state.phone)) return false;
    if (state.phoneCode && d.phoneCode !== state.phoneCode) return false;
    if (state.status.length > 0 && !state.status.includes(statusKey(d))) return false;
    return true;
  };
}

export function countActiveDriverFilters(state: DriversFilterState): number {
  let count = 0;
  if (state.name.trim()) count++;
  if (state.email.trim()) count++;
  if (state.phone.trim()) count++;
  if (state.phoneCode) count++;
  if (state.status.length) count++;
  return count;
}

/** Empty values always sort last, regardless of direction. */
function compareStrings(a: string, b: string, direction: DriverSortDirection): number {
  const aEmpty = !a.trim();
  const bEmpty = !b.trim();
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const result = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'desc' ? -result : result;
}

function compareBooleans(a: boolean, b: boolean, direction: DriverSortDirection): number {
  const result = Number(a) - Number(b);
  return direction === 'desc' ? -result : result;
}

function fieldComparator(field: DriverSortField, direction: DriverSortDirection): (a: Driver, b: Driver) => number {
  switch (field) {
    case 'name': return (a, b) => compareStrings(`${a.name} ${a.surname}`, `${b.name} ${b.surname}`, direction);
    case 'email': return (a, b) => compareStrings(a.email, b.email, direction);
    case 'phoneCode': return (a, b) => compareStrings(a.phoneCode ?? '', b.phoneCode ?? '', direction);
    case 'phone': return (a, b) => compareStrings(a.phone, b.phone, direction);
    case 'status': return (a, b) => compareBooleans(a.blocked, b.blocked, direction); // Active (false) before Inactive (true) ascending
  }
}

/** No-op when `field` is null — matches the backend's own default (unsorted) order. */
export function sortDrivers(drivers: Driver[], field: DriverSortField | null, direction: DriverSortDirection): Driver[] {
  if (!field) return drivers;
  return [...drivers].sort(fieldComparator(field, direction));
}

// ---------- URL query-param (de)serialization ----------

export function driversFilterStateToQueryParams(state: DriversFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (state.name.trim()) params['name'] = state.name;
  if (state.email.trim()) params['email'] = state.email;
  if (state.phone.trim()) params['phone'] = state.phone;
  if (state.phoneCode) params['phoneCode'] = state.phoneCode;
  if (state.status.length) params['status'] = state.status.join(',');
  if (state.sortField) {
    params['sortBy'] = state.sortField;
    params['sortDir'] = state.sortDirection;
  }
  return params;
}

const SORT_FIELDS: DriverSortField[] = ['name', 'email', 'phoneCode', 'phone', 'status'];

export function driversFilterStateFromQueryParams(
  params: Record<string, string | null>,
  fallback: DriversFilterState,
): DriversFilterState {
  const get = (key: string): string | null => (params[key] ? params[key] : null);

  const sortByRaw = get('sortBy');
  const sortField = sortByRaw && (SORT_FIELDS as string[]).includes(sortByRaw) ? (sortByRaw as DriverSortField) : null;

  return {
    name: get('name') ?? fallback.name,
    email: get('email') ?? fallback.email,
    phone: get('phone') ?? fallback.phone,
    phoneCode: get('phoneCode') ?? fallback.phoneCode,
    status: get('status')?.split(',').filter(Boolean) ?? fallback.status,
    sortField,
    sortDirection: (get('sortDir') as DriverSortDirection) ?? fallback.sortDirection,
  };
}
