export function normalizePhone(phone?: string | null): string {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) cleaned = cleaned.substring(2);
  if (cleaned.length === 11 && cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  return cleaned;
}

export function formatPhone(phone?: string | null): string {
  const norm = normalizePhone(phone);
  if (norm.length === 10) {
    return `+91 ${norm.slice(0, 5)} ${norm.slice(5)}`;
  }
  return phone || '-';
}

export function getWhatsAppUrl(phone?: string | null, candidateName?: string): string {
  const norm = normalizePhone(phone);
  if (!norm) return '#';
  const full = norm.length === 10 ? `91${norm}` : norm;
  const msg = candidateName
    ? `Hello ${candidateName}, greetings from Genius Consultants. We reviewed your profile for current field sales and executive job openings. Please let us know if you are interested.`
    : `Hello, greetings from Genius Consultants.`;
  return `https://wa.me/${full}?text=${encodeURIComponent(msg)}`;
}

export function getTelUrl(phone?: string | null): string {
  const norm = normalizePhone(phone);
  if (!norm) return '#';
  return `tel:+91${norm}`;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
