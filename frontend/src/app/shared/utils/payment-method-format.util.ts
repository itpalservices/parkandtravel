const PAYMENT_METHOD_LABELS: Record<string, string> = {
  fee_waived: 'Extra Fee Waived',
};

/** Human-readable label for a stored payment_method tag (cash, card, discount,
 *  complimentary, fee_waived, refund, online, ...). */
export function formatPaymentMethodLabel(method: string): string {
  if (PAYMENT_METHOD_LABELS[method]) return PAYMENT_METHOD_LABELS[method];
  return method.charAt(0).toUpperCase() + method.slice(1).toLowerCase();
}

/** Puts the minus sign before the currency symbol (-€3.00), not between them (€-3.00). */
export function formatSignedCurrency(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  return `${sign}€${Math.abs(amount).toFixed(2)}`;
}
