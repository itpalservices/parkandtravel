/**
 * Builds a `tel:` href from a dial code (e.g. "+30") and a local number.
 * Strips everything but digits from both parts. Returns null when there's
 * no usable phone number, so callers can conditionally render the link.
 */
export function buildTelHref(phoneCode: string | null | undefined, phone: string | null | undefined): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;

  const codeDigits = (phoneCode || '').replace(/\D/g, '');
  return codeDigits ? `tel:+${codeDigits}${digits}` : `tel:${digits}`;
}
