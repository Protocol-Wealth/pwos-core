/**
 * Layer 4: Allow-list — patterns and terms that should NEVER be redacted.
 * Apache 2.0 — Protocol Wealth LLC
 */

const ALLOW_PATTERNS: RegExp[] = [
  /^\$[\d,]+(?:\.\d{1,2})?[kKmMbB]?$/,
  /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/,
  /^\d+\.?\d*\s*%$/,
  /^(?:10|12|22|24|32|35|37)\s*%$/,
  /^\d+\s*(?:bps?|basis\s+points?)$/i,
  /^20[2-9]\d$/,
  /^age\s+\d{1,3}$/i,
  /^(?:Form|Schedule|IRC\s*§?)\s*[A-Z0-9§.-]+$/i,
];

const ALLOW_TERMS = new Set([
  'AGI', 'MAGI', 'QBI', 'RMD', 'QCD', 'NUA', 'IRA', 'SEP', 'SIMPLE',
  '401K', '403B', '457B', '529', 'HSA', 'FSA', 'W2', 'W-2', '1099',
  '1040', '1041', '1065', '1120', '990', '8606', '8275',
  'FICO', 'CUSIP', 'ISIN', 'ETF', 'NAV', 'AUM', 'EBITDA',
  'EPS', 'ROI', 'ROE', 'CROIC', 'ROIC', 'FCF', 'DCF',
  'LTV', 'DTI', 'PMI', 'PITI', 'MIP', 'UFMIP', 'ARM', 'FRM',
  'HELOC', 'HEL', 'TILA', 'RESPA', 'ECOA', 'HMDA', 'TRID',
  'URLA', 'QM', 'ATR', 'DU', 'LP', 'AUS', 'GFE', 'LE', 'CD',
  'HUD', 'ALTA', 'CLTA', 'CPL', 'FNMA', 'FHLMC', 'GNMA',
  'VOE', 'VOD', 'VOM', 'VOR', 'APR', 'MERS', 'MLS', 'HOA',
  'TVL', 'APY', 'DEX', 'CEX', 'AMM', 'IL',
  'EMF', 'DXY', 'VIX', 'FRED',
  'FANNIE MAE', 'FREDDIE MAC', 'GINNIE MAE',
]);

export function isAllowed(text: string): boolean {
  const trimmed = text.trim();
  if (ALLOW_TERMS.has(trimmed.toUpperCase())) return true;
  for (const pattern of ALLOW_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}
