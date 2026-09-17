/**
 * Indian Mobile Phone Normalization Utility
 * Handles Excel float/scientific notation (e.g., 9.558555612E9, 9558555612.0),
 * prefixes (+91, 91, 0), spaces, dashes, and invalid non-digits.
 */
export function normalizeIndianPhone(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  let str = String(input).trim();
  if (!str) return null;

  // Handle Excel scientific float notation like "9.558555612E9" or "9558555612.0"
  if (str.includes('E') || str.includes('e') || str.includes('.')) {
    const num = Number(str);
    if (!isNaN(num) && isFinite(num)) {
      str = Math.round(num).toString();
    }
  }

  // Strip all non-digit characters
  const digits = str.replace(/\D/g, '');

  // Case 1: Standard 10 digits
  if (digits.length === 10) {
    return digits;
  }

  // Case 2: 12 digits starting with country code 91
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }

  // Case 3: 11 digits starting with leading 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }

  // Case 4: More than 10 digits -> take trailing 10 digits if valid Indian format
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    // Indian mobiles typically start with 6, 7, 8, or 9
    if (/^[6-9]/.test(last10)) {
      return last10;
    }
    return last10;
  }

  // For shorter landline / local numbers
  return digits.length >= 7 ? digits : null;
}

export function formatIndianPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  const norm = normalizeIndianPhone(phone);
  if (!norm || norm.length !== 10) return phone;
  return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
}
