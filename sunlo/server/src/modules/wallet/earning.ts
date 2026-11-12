import { eq } from 'drizzle-orm';
import type { DbOrTx } from '../../db/client';
import { vendors } from '../../db/schema';
import { getSettings } from '../../lib/settings';
import { postTxn } from './ledger';

/**
 * TDS ka hisaab (Income-tax Act 2025 Sec 393(1) Table 8(v); purana Sec 194-O):
 * e-commerce operator service ki GROSS raqam par TDS kaatta hai (commission se pehle wali raqam).
 * PAN ho to 0.1%, PAN na ho to 5%. Rate admin settings se badal sakte hain (basis points).
 * Rs 5 lakh tak ki chhoot (individual + PAN) jaisi shartein CA ke saath tay karein; tab admin `tdsEnabled` band kar sakta hai.
 */
export async function tdsFor(tx: DbOrTx, vendorId: string, gross: number) {
  const s = await getSettings();
  if (!s.tdsEnabled || gross <= 0) return { amount: 0, bps: 0 };
  const [v] = await tx.select({ panLast4: vendors.panLast4 }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const bps = v?.panLast4 ? s.tdsBps : s.tdsNoPanBps;
  return { amount: Math.round((gross * bps) / 10_000), bps };
}

/**
 * Vendor ki kamai wallet mein: pehle kamai (SESSION_EARNING), phir usi reference par TDS (negative).
 * Isse vendor ka statement saaf rehta hai: gross -> commission -> TDS -> net. Transaction ke andar hi bulayein.
 */
export async function postVendorEarning(
  tx: DbOrTx,
  p: { vendorId: string; vendorUserId: string; gross: number; earning: number; referenceType: string; referenceId: string; note: string },
) {
  if (p.earning <= 0) return { tds: 0 };
  await postTxn(tx, { userId: p.vendorUserId, type: 'SESSION_EARNING', amount: p.earning, referenceType: p.referenceType, referenceId: p.referenceId, note: p.note });
  const { amount, bps } = await tdsFor(tx, p.vendorId, p.gross);
  const tds = Math.min(amount, p.earning);
  if (tds > 0) {
    await postTxn(tx, {
      userId: p.vendorUserId,
      type: 'TDS',
      amount: -tds,
      referenceType: p.referenceType,
      referenceId: p.referenceId,
      note: `TDS ${(bps / 100).toFixed(2)}% (gross Rs ${(p.gross / 100).toFixed(2)})`,
    });
  }
  return { tds };
}
