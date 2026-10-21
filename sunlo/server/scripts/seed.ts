import { sql } from 'drizzle-orm';
import { isProd } from '../src/config/env';
import { db, pool } from '../src/db/client';
import { banners, blockedKeywords, categories, rechargePacks, users, vendorCategories, vendors, wallets } from '../src/db/schema';
import { randomReferralCode } from '../src/lib/crypto';

/**
 * `npm run db:seed`            -> zaroori data (categories, recharge packs, blocked keywords, banners)
 * `npm run db:seed -- --demo`  -> upar wala + DEMO vendors (sirf development; production mein mana)
 * Koi admin ya default password wala account yahan NAHI banta (admin: npm run create-admin).
 */
const CATEGORIES: { name: string; slug: string; kind: 'LISTENER' | 'EXPERT'; icon: string; description: string }[] = [
  { name: 'Dil ki Baat', slug: 'listener', kind: 'LISTENER', icon: 'heart-outline', description: 'Akelapan, tension, udaasi: koi dhyan se sune' },
  { name: 'Rishte', slug: 'relationships', kind: 'LISTENER', icon: 'people-outline', description: 'Pyaar, shaadi, parivar, dosti' },
  { name: 'Career', slug: 'career', kind: 'EXPERT', icon: 'briefcase-outline', description: 'Naukri, interview, resume, career badalna' },
  { name: 'Business', slug: 'business', kind: 'EXPERT', icon: 'trending-up-outline', description: 'Startup, dukaan, marketing, growth' },
  { name: 'Legal', slug: 'legal', kind: 'EXPERT', icon: 'document-text-outline', description: 'Kanooni sawaal, property, agreement' },
  { name: 'Finance', slug: 'finance', kind: 'EXPERT', icon: 'cash-outline', description: 'Bachat, tax, nivesh, loan' },
  { name: 'Health & Fitness', slug: 'fitness', kind: 'EXPERT', icon: 'fitness-outline', description: 'Diet, fitness, lifestyle' },
  { name: 'Padhai', slug: 'education', kind: 'EXPERT', icon: 'school-outline', description: 'Exam, college, study plan' },
  { name: 'Parenting', slug: 'parenting', kind: 'EXPERT', icon: 'happy-outline', description: 'Bachchon ki parvarish' },
];
const PACKS = [
  { amount: 5000, bonusPct: 0 },
  { amount: 10000, bonusPct: 0 },
  { amount: 20000, bonusPct: 5 },
  { amount: 50000, bonusPct: 10, isPopular: true },
  { amount: 100000, bonusPct: 15 },
  { amount: 200000, bonusPct: 20 },
];
const KEYWORDS = ['whatsapp', 'telegram', 'paytm', 'gpay', 'phonepe', 'upi', 'instagram', 'snapchat'];

async function essentials() {
  await db.insert(categories).values(CATEGORIES.map((c, i) => ({ ...c, sortOrder: i }))).onConflictDoNothing();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(rechargePacks);
  if (n === 0) await db.insert(rechargePacks).values(PACKS.map((p, i) => ({ ...p, sortOrder: i })));
  await db.insert(blockedKeywords).values(KEYWORDS.map((word) => ({ word }))).onConflictDoNothing();
  const [{ b }] = await db.select({ b: sql<number>`count(*)::int` }).from(banners);
  if (b === 0)
    await db.insert(banners).values([
      { title: 'Koi hai jo sunega', subtitle: 'Trained listeners se private baat, 24x7', link: 'listeners', sortOrder: 0 },
      { title: 'Pehli recharge par 10% extra', subtitle: 'Rs 500 ya usse zyada ke recharge par', link: 'wallet', sortOrder: 1 },
      { title: 'Experts se seedhi salah', subtitle: 'Career, legal, finance aur bahut kuch', link: 'experts', sortOrder: 2 },
    ]);
  console.log('✅ Zaroori data');
}

const DEMO = [
  { name: 'Ananya Verma', headline: 'Trained listener · bina judgement sunti hoon', cats: ['listener', 'relationships'], exp: 4, langs: ['Hindi', 'English'], tags: ['Akelapan', 'Stress', 'Breakup'], rate: 800, rating: 4.9, count: 1260, min: 41000, online: true, gender: 'FEMALE' as const },
  { name: 'Rohan Mehta', headline: 'Career coach · 10 saal HR experience', cats: ['career'], exp: 10, langs: ['Hindi', 'English'], tags: ['Interview', 'Resume', 'Job switch'], rate: 2500, rating: 4.8, count: 830, min: 27000, online: true, gender: 'MALE' as const },
  { name: 'Adv. Kavita Rao', headline: 'Advocate · property aur family law', cats: ['legal'], exp: 14, langs: ['Hindi', 'English', 'Kannada'], tags: ['Property', 'Divorce', 'Agreement'], rate: 4000, rating: 4.9, count: 610, min: 22000, online: true, gender: 'FEMALE' as const },
  { name: 'Sameer Khan', headline: 'Listener · raat ko bhi uplabdh', cats: ['listener'], exp: 3, langs: ['Hindi', 'Urdu'], tags: ['Neend', 'Akelapan', 'Exam stress'], rate: 600, rating: 4.7, count: 940, min: 35000, online: true, gender: 'MALE' as const },
  { name: 'CA Priya Nair', headline: 'Chartered Accountant · tax aur bachat', cats: ['finance'], exp: 9, langs: ['English', 'Malayalam', 'Hindi'], tags: ['Income tax', 'Investment', 'GST'], rate: 3000, rating: 4.8, count: 420, min: 15000, online: false, gender: 'FEMALE' as const },
  { name: 'Neha Joshi', headline: 'Relationship listener · shaadi aur parivar', cats: ['relationships', 'parenting'], exp: 6, langs: ['Hindi', 'Marathi'], tags: ['Shaadi', 'Sasural', 'Parenting'], rate: 1000, rating: 4.8, count: 700, min: 26000, online: true, gender: 'FEMALE' as const },
  { name: 'Vikram Singh', headline: 'Startup mentor · 3 startups bana chuke', cats: ['business'], exp: 15, langs: ['Hindi', 'English', 'Punjabi'], tags: ['Startup', 'Funding', 'Marketing'], rate: 5000, rating: 4.7, count: 260, min: 9000, online: true, gender: 'MALE' as const },
  { name: 'Arjun Iyer', headline: 'Fitness coach · diet aur workout plan', cats: ['fitness'], exp: 8, langs: ['English', 'Tamil', 'Hindi'], tags: ['Weight loss', 'Diet', 'Gym'], rate: 1500, rating: 4.6, count: 350, min: 11000, online: false, gender: 'MALE' as const },
  { name: 'Ritika Sharma', headline: 'Study mentor · UPSC/SSC guidance', cats: ['education', 'career'], exp: 5, langs: ['Hindi', 'English'], tags: ['UPSC', 'Study plan', 'Motivation'], rate: 1200, rating: 4.8, count: 510, min: 17000, online: true, gender: 'FEMALE' as const },
];

async function demo() {
  if (isProd) throw new Error('Demo data production mein nahi daala ja sakta');
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(vendors);
  if (n > 0) {
    console.log('ℹ️  Demo vendors pehle se hain, skip');
    return;
  }
  const allCats = await db.select().from(categories);
  let i = 0;
  for (const d of DEMO) {
    i++;
    const [u] = await db
      .insert(users)
      .values({ phone: `+9100000000${String(i).padStart(2, '0')}`, name: d.name, role: 'VENDOR', gender: d.gender, referralCode: randomReferralCode(), ageConfirmedAt: new Date() })
      .returning();
    await db.insert(wallets).values({ userId: u.id });
    const [v] = await db
      .insert(vendors)
      .values({
        userId: u.id,
        status: 'APPROVED',
        displayName: d.name,
        headline: d.headline,
        bio: `Namaste! Main ${d.name.split(' ')[0]} hoon. ${d.exp} saal se logon ki madad kar rahi/raha hoon. Aap bina jhijhak apni baat keh sakte hain; aapki baat poori tarah private rahegi.`,
        gender: d.gender,
        experienceYears: d.exp,
        languages: d.langs,
        tags: d.tags,
        chatRatePerMin: d.rate,
        callRatePerMin: Math.round(d.rate * 1.2),
        videoRatePerMin: Math.round(d.rate * 1.5),
        videoEnabled: i % 3 === 0,
        isOnline: d.online,
        ratingAvg: d.rating,
        ratingCount: d.count,
        totalMinutes: d.min,
        totalSessions: Math.round(d.count * 1.4),
        submittedAt: new Date(),
        approvedAt: new Date(),
        kycDocType: 'AADHAAR',
      })
      .returning();
    const cs = allCats.filter((c) => d.cats.includes(c.slug));
    if (cs.length) await db.insert(vendorCategories).values(cs.map((c) => ({ vendorId: v.id, categoryId: c.id })));
  }
  console.log(`✅ Demo data: ${DEMO.length} vendors (phone +910000000001 ... )`);
}

async function main() {
  await essentials();
  if (process.argv.includes('--demo')) await demo();
  await pool.end();
}

main().catch(async (e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  await pool.end();
  process.exit(1);
});
