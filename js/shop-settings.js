export const DEFAULT_OPEN_DATE = '2026-11-01';
export const SETTINGS_DOC = 'store';

export function defaultShopSettings() {
  return {
    status: 'scheduled',
    openDate: DEFAULT_OPEN_DATE
  };
}

export function normalizeShopSettings(data) {
  const defaults = defaultShopSettings();
  if (!data) return defaults;
  return {
    status: ['scheduled', 'open', 'closed'].includes(data.status) ? data.status : 'scheduled',
    openDate: data.openDate || DEFAULT_OPEN_DATE
  };
}

export function parseOpenDate(dateStr) {
  const [year, month, day] = String(dateStr || DEFAULT_OPEN_DATE).split('-').map(Number);
  return new Date(year, (month || 11) - 1, day || 1, 0, 0, 0);
}

export function isShopOpen(settings) {
  const shop = normalizeShopSettings(settings);
  if (shop.status === 'open') return true;
  if (shop.status === 'closed') return false;
  return new Date() >= parseOpenDate(shop.openDate);
}

export function formatOpenDate(dateStr) {
  return parseOpenDate(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function shopStatusLabel(settings) {
  const shop = normalizeShopSettings(settings);
  if (shop.status === 'open' || isShopOpen(shop)) return 'Open';
  if (shop.status === 'closed') return 'Closed';
  return `Opens ${formatOpenDate(shop.openDate)}`;
}

export function countdownLabel(settings) {
  const shop = normalizeShopSettings(settings);
  if (shop.status === 'closed') return 'Shop closed';
  if (isShopOpen(shop)) return 'Shop open';
  const diffDays = Math.ceil((parseOpenDate(shop.openDate) - new Date()) / (1000 * 60 * 60 * 24));
  const when = formatOpenDate(shop.openDate);
  if (diffDays <= 0) return `Opening ${when}`;
  return `${diffDays} day${diffDays === 1 ? '' : 's'} until ${when}`;
}
