import { computeVatBreakdown } from './ledgerUtils';

/**
 * Legal seller identity printed on guest vouchers and Official Receipts.
 *
 * TODO (resort owner): before issuing real receipts, replace every placeholder below
 * with the resort's BIR-registered details from its Certificate of Registration
 * (BIR Form 2303).
 *
 * `vatRegistered` MUST match that certificate:
 *   true  → VAT-registered: prices are VAT-inclusive and the 12% VAT is shown.
 *   false → Non-VAT: no 12% VAT line; the business pays 3% percentage tax instead,
 *           and the OR must read "THIS DOCUMENT IS NOT VALID FOR CLAIMING INPUT TAXES".
 *
 * A legally issued OR number must come from a BIR-registered sequential series
 * (printed receipts) or an Accredited CAS / e-receipt system. `officialReceiptNo`
 * below only produces a stable DISPLAY value derived from the booking reference;
 * wire it to a server-issued series before using it as the authoritative OR number.
 */
export const RESORT_TAX_PROFILE = {
  registeredName: 'Rock View Beach Resort', // TODO: exact BIR-registered name
  tradeName: 'Rock View Beach Resort',
  address: 'Patar Coastal Road, Brgy. Patar, Bolinao, Pangasinan',
  tin: '000-000-000-00000', // TODO: real TIN incl. branch code
  vatRegistered: true, // per owner's choice: issue with 12% VAT
  birPermitNo: 'TODO-ATP/PTU-NO', // Authority to Print / PTU number
  orSeriesPrefix: 'OR',
  vatRate: 0.12,
} as const;

export interface OfficialReceiptAmounts {
  vatRegistered: boolean;
  totalAmountDue: number;
  /** Sale net of the 12% VAT already contained in the gross total. */
  vatableSales: number;
  /** The 12% VAT portion inside the VAT-inclusive total. */
  vatAmount: number;
  vatExemptSales: number;
  zeroRatedSales: number;
  amountNetOfVat: number;
}

/**
 * Breaks a VAT-inclusive gross amount into the lines a PH Official Receipt shows.
 * Philippine displayed prices already include VAT, so VAT is extracted from the total,
 * never added on top. Reuses the existing resort VAT helper for the arithmetic.
 */
export function computeOfficialReceipt(total: number): OfficialReceiptAmounts {
  const gross = Number(total) || 0;
  if (!RESORT_TAX_PROFILE.vatRegistered) {
    return {
      vatRegistered: false,
      totalAmountDue: gross,
      vatableSales: 0,
      vatAmount: 0,
      vatExemptSales: gross,
      zeroRatedSales: 0,
      amountNetOfVat: gross,
    };
  }
  const v = computeVatBreakdown(gross);
  return {
    vatRegistered: true,
    totalAmountDue: gross,
    vatableSales: v.vatableSales,
    vatAmount: v.vatAmount,
    vatExemptSales: 0,
    zeroRatedSales: 0,
    amountNetOfVat: v.vatableSales,
  };
}

/**
 * Stable DISPLAY Official Receipt number derived from a booking reference or id.
 * Not a BIR-authoritative serial — see the note on RESORT_TAX_PROFILE.
 */
export function officialReceiptNo(ref: string): string {
  const base = String(ref || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-8) || 'PENDING';
  return `${RESORT_TAX_PROFILE.orSeriesPrefix}-${base}`;
}

/** Two-decimal peso formatting used on tax lines. */
export function formatTaxPeso(val: number): string {
  return `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
