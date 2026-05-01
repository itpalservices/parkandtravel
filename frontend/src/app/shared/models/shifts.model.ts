export interface ShiftTransaction {
  id: string;
  datetime: string;
  amount: number;
  paymentMethod: string;
  notes: string | null;
  plateNo: string | null;
  type: 'checkin' | 'checkout';
}

export interface ShiftTotals {
  paymentMethod: string;
  total: number;
  count: number;
}

export interface ShiftSummary {
  shiftId: number | null;
  transactions: ShiftTransaction[];
  totals: ShiftTotals[];
}

export interface LogoutConfirmationState {
  visible: boolean;
  loading: boolean;
  summary: ShiftSummary | null;
}