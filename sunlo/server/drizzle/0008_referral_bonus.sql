-- 0008: referral code se mile bonus coins ka ledger type
ALTER TYPE "txn_type" ADD VALUE IF NOT EXISTS 'REFERRAL_BONUS';
