# Sunlo Admin Panel (React web)

**Stack:** React 19, React Router 7, TanStack Query, TypeScript. Build esbuild se hota hai (tez, bina extra config).

## Chalana

```bash
npm install
npm run dev                                                   # http://localhost:5173 (API: localhost:4000)
SUNLO_API_URL=https://api.yourdomain.com/api/v1 npm run build # dist/ ko kisi bhi static host par daalein
```

Production mein admin panel ko alag subdomain par rakhein (jaise `admin.yourdomain.com`). Server ki `.env` ke `CORS_ORIGINS` mein yahi domain dalein.

## Login

Admin account sirf server par banta hai:

```bash
npm run create-admin -- you@yourdomain.com
```

Koi default ya demo admin nahi hai. Refresh token `sessionStorage` mein rehta hai, isliye tab band karte hi logout ho jaata hai.

## Pages

| Page | Kaam |
|---|---|
| Dashboard | Platform kamai, recharge, live sessions, users; 14 din ke charts; "aaj ke kaam" |
| Vendors | Review baaki / approved / rejected / suspended; ID document dekhna; approve, reject (wajah ke saath), suspend |
| Users | Khojna, block/unblock (turant logout), wallet adjust (note zaroori) |
| Sessions | Saare sessions; transcript (flag kiye messages ke saath); refund |
| Payments | Recharge ka hisaab (GST, bonus) |
| Withdrawals | Poora account number dekhna (audit), UTR darj karke paid mark karna, reject |
| Reports / Tickets / Reviews | Shikayat resolve, support jawab, review chhupana |
| Categories & packs | Topics, recharge packs, banners, chat mein band shabd |
| Settings | Commission, GST, vendor rate seema, min withdrawal... (galat value server reject karta hai) |
| Audit log | Har admin ne kya kiya aur kya dekha |
