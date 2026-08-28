/**
 * Normalizes any phone number string into a clean 10-digit canonical Indian phone number,
 * or standard international digits.
 */
export function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Strip everything except digits
  let cleaned = String(phone).replace(/\D/g, '');

  // If 12 digits starting with 91 (e.g. 919876543210), trim leading 91
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    cleaned = cleaned.substring(2);
  }

  // If 11 digits starting with 0 (e.g. 09876543210), trim leading 0
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Validates whether a normalized phone number is a valid 10-digit Indian mobile number
 * (typically starting with 6, 7, 8, 9)
 */
export function isValidMobileNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^[6-9]\d{9}$/.test(normalized);
}

/**
 * Formats a 10-digit number for display: +91 98765 43210
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone || '-';
}

/**
 * Generates WhatsApp direct click-to-chat URL
 */
export function getWhatsAppUrl(phone: string | null | undefined, text?: string): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return '#';
  const fullNum = norm.length === 10 ? `91${norm}` : norm;
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${fullNum}${encodedText}`;
}

/**
 * Generates dialer click-to-call tel: URI
 */
export function getTelUrl(phone: string | null | undefined): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm) return '#';
  return `tel:+91${norm}`;
}
