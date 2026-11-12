/**
 * Bondty Terms of Use: sections (title + points).
 * DHYAN: ise lagane se pehle kisi vakeel se dikhwa lein aur niche ke COMPANY wale fields bharein.
 */
export const COMPANY = {
  name: 'Bondty',
  // Registered company ka naam/pata aur court ka shehar yahan bharein (khaali rahe to line nahi dikhti)
  legalName: '',
  address: '',
  jurisdictionCity: '',
  supportEmail: '',
};

export type LegalSection = { title: string; points: string[] };

export const LAST_UPDATED = '10 November 2026';

export const TERMS_INTRO =
  'Yeh Terms of Use ("Terms") Bondty app aur usse jude saare features ke istemaal par lagu hote hain. App istemaal karne se pehle inhe dhyan se padhein. App istemaal karna yaani in Terms ko maan lena.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Bondty kya hai (seva ka swaroop)',
    points: [
      'Bondty ek baat-cheet (interaction) ka platform hai. Yahan aap "Listeners" aur "Experts" (jinhe aage "Vendor" kaha gaya hai) se chat, audio call ya video call par baat kar sakte hain.',
      'Bondty sirf aapko doosre insaan se jodne ka madhyam hai. Vendor Bondty ke karmchari nahi, swatantra vyakti hain.',
      'Yeh app sirf baat-cheet, sunne-sunane aur halka mehsoos karne ke liye hai. Yeh dating, shaadi, rozgar, loan ya kisi aur sauda-banane ki seva nahi hai.',
    ],
  },
  {
    title: 'Aap apni marzi se aa rahe hain',
    points: [
      'Aap yeh app poori tarah apni swechha se istemaal kar rahe hain. Kisi ne aap par dabaav, laalach, dhokha ya zabardasti nahi ki hai.',
      'Aap samajhte hain ki yahan jo bhi baat-cheet hogi wo aapke apne faisle aur zimmedari par hogi.',
      'Aap kabhi bhi app istemaal karna band kar sakte hain.',
    ],
  },
  {
    title: 'Paatrata (kaun istemaal kar sakta hai)',
    points: [
      'App istemaal karne ke liye aapki umar kam se kam 18 saal honi chahiye. 18 saal se kam umar ke log app istemaal na karein.',
      'Aap kaanoon ke hisaab se anubandh karne yogya hon, aur pehle kabhi Bondty se prathibandhit (ban) na kiye gaye hon.',
      'Aapko apna sahi mobile number aur sahi jaankari deni hogi. Doosre ke number ya naam se account na banayein.',
    ],
  },
  {
    title: 'Yeh professional salah nahi hai',
    points: [
      'Listeners aur Experts jo kehte hain wo unka apna vyaktigat vichar hai. Yeh doctor, mansik swasthya visheshagya (therapist/counsellor), vakeel, chartered accountant ya kisi bhi licensed professional ki salah ka vikalp nahi hai.',
      'Medical, kanooni, vitteey ya kisi bhi gambhir faisle ke liye hamesha yogya professional se milein. Bondty ki baat-cheet par bharosa karke liye gaye faisle ki zimmedari aapki hogi.',
      'Bondty emergency seva nahi hai. Agar aap ya koi aur khatre mein hai, ya aapko khud ko nuksan pahunchane ke vichar aa rahe hain, to turant 112 par call karein ya apne najdeeki aspataal jayein. Mansik swasthya madad ke liye Tele-MANAS helpline 14416 par sampark kar sakte hain.',
    ],
  },
  {
    title: 'Aapka account aur suraksha',
    points: [
      'Login mobile number aur OTP se hota hai. OTP kisi ko na batayein. Aapke account se hui har gatividhi ke liye aap zimmedar hain.',
      'Agar aapko lage ki aapka account koi aur chala raha hai, to turant Help section se humein batayein.',
      'Ek vyakti ke liye ek hi account. Jhoota ya nakli account banana mana hai.',
    ],
  },
  {
    title: 'Wallet, coins aur payment',
    points: [
      'Bondty mein sabhi sevayein wallet ke coins se hoti hain. 1 coin ki keemat ₹1 maani jaati hai.',
      'Coins sirf Bondty ke andar istemaal ho sakte hain. Inhe kisi doosre account mein bheja, becha ya bank mein nahi nikala ja sakta, aur inpar byaaj nahi milta.',
      'Recharge ke liye payment doosri adhikrit payment company ke zariye hota hai. Payment fail hone par ya paisa kat kar coins na aane par humein Help section mein batayein, hum jaanch karke theek karenge.',
      'Refund Bondty ki refund niti ke anusaar hi hoga. Jo samay baat-cheet mein pehle hi istemaal ho chuka hai uska paisa wapas nahi hoga.',
      'Bina istemaal hue recharge ka refund sirf usi card/UPI/bank account mein jata hai jisse payment hua tha. Coins kabhi cash mein nahi badle jaate.',
      'Coins ki keemat GST se pehle ki hai. 18% GST recharge ke waqt lagta hai, isliye "₹10/min" ka matlab GST sahit ₹11.80/min hai. Yeh keemat har call se pehle dikhayi jaati hai.',
    ],
  },
  {
    title: 'Call/chat ka billing',
    points: [
      'Har Vendor ka rate "coins per minute" mein dikhta hai. Baat-cheet shuru hote hi samay ginna shuru ho jata hai.',
      'Billing minute ke hisaab se hoti hai. Adha minute bhi poora ek minute ginaa jaata hai.',
      'Aapke wallet ke balance jitne hi minute ki baat ho sakti hai. Balance khatam hone par call/chat apne aap band ho jaati hai. Isliye lambi baat se pehle wallet mein kaafi coins rakhein.',
      'Agar Vendor ne request accept nahi ki, ya baat-cheet shuru nahi hui, to koi paisa nahi katta.',
      'Naye user ko pehle kuch minute free mil sakte hain (har mobile number par ek hi baar). Free minute ki shart call se pehle saaf dikhayi jaati hai.',
      'Balance khatam hone se lagbhag 1 minute pehle aapko chetavani milti hai, aur har session ke baad raseed (kitne minute, rate, kitna kata) dikhti hai.',
    ],
  },
  {
    title: 'Gifts',
    points: [
      'Aap baat-cheet ke dauran Vendor ko coins se gift bhej sakte hain. Gift bhejna poori tarah aapki marzi hai.',
      'Bheja hua gift wapas nahi hota aur uske coins refund nahi hote. Galti se bheje gift ke liye bhi yehi niyam lagu hai.',
      'Har gift par Bondty apna commission kaat-ta hai aur bacha hua hissa Vendor ko milta hai. Commission ka percentage Bondty samay-samay par badal sakta hai.',
      'Gift koi jua, lottery ya inaam ki yojana nahi hai. Gift se aapko koi aarthik laabh ka haq nahi banta.',
    ],
  },
  {
    title: 'Aapke liye niyam (kya mana hai)',
    points: [
      'Gaali-galoch, dhamki, pareshaan karna, peecha karna, apmaan, ya kisi dharm, jaati, ling ya kshetra ke khilaaf nafrat failana.',
      'Ashleel, yaun ya nagn baatein/tasveerein/video maangna ya bhejna. Bondty yaun sambandhi seva ke liye nahi hai.',
      'Kisi bhi naabalig (18 saal se kam) ke saath galat vyavhaar. Aisa kuch dikhe to turant report karein.',
      'Dhokha, thagi, paise maangna, nivesh/loan/lottery ka laalach, ya kisi ko bahkana.',
      'Vendor ya kisi aur ka number, UPI, address ya social media maangna ya Bondty se bahar paise ka len-den karna.',
      'Nashe, hathiyaar, jua ya kisi bhi gair-kanooni cheez ki baat ya prachaar.',
      'Kisi ki ijazat ke bina uski baat-cheet record karna, screenshot ya recording failana, ya kisi ki nijta bhang karna.',
      'Kisi aur ka roop dharna, app mein hack/chhed-chhaad karna, bots ya anya automatic tareeke se app chalana.',
      'Bharat ke kisi bhi kaanoon ke khilaaf kuch bhi karna.',
    ],
  },
  {
    title: 'Vendors ke baare mein',
    points: [
      'Vendor ki profile par likhi jaankari (jaise anubhav, vishay, rating) unhi ki di hui ya users ke feedback par aadhaarit hoti hai. Hum kisi Vendor ke vichar, salah ya parinaam ki guarantee nahi dete.',
      'Vendor aur user ke beech ki baat-cheet ke liye dono khud zimmedar hain. Bondty kisi vivaad mein sirf madhyastha ki bhoomika nibha sakta hai, bandhan nahi.',
    ],
  },
  {
    title: 'Chat ki nigrani aur suraksha',
    points: [
      'Surakshit mahaul banaye rakhne ke liye chat mein phone number, link jaisi jaankari apne aap chhupayi ja sakti hai.',
      'Report kiye gaye ya sandehaspad maamlon mein Bondty ki team chat ka record dekh sakti hai. Isse sirf suraksha, dhokhadhadi rokne aur kaanoon ke paalan ke liye hi istemaal kiya jaata hai.',
    ],
  },
  {
    title: 'Report aur karwai',
    points: [
      'Koi bhi baat-cheet ya Vendor galat lage to app mein "Report" ka option istemaal karein. Hum 36 ghante ke andar jaanch karke zaroorat par warning, rok ya account band karne jaisi karwai karenge.',
      'Jhoothi ya durbhavna se ki gayi report karna Terms ka ullanghan hai.',
    ],
  },
  {
    title: 'Aapki jaankari aur privacy',
    points: [
      'Hum aapka mobile number, naam, janm-tithi (18+ ki jaanch ke liye), profile ki jaankari, wallet len-den, baat-cheet ka record (sampark ka samay, avadhi, chat sandesh) aur device ki zaroori jaankari jama karte hain.',
      'Audio/video call record nahi hoti. Chat sandesh lagbhag 90 din baad apne aap mita diye jaate hain; sirf wahi rakhe jaate hain jinpar shikayat ki jaanch chal rahi ho.',
      'Mood check-in aur uska note sirf aapko dikhta hai, encrypted rehta hai, aur ads ya kisi doosre kaam mein istemaal nahi hota.',
      'Yeh jaankari app chalane, login/OTP bhejne, payment karne, calls jodne, suraksha banaye rakhne, dhokhadhadi rokne aur seva behtar karne ke liye istemaal hoti hai. Hum aapki jaankari bechte nahi hain.',
      'Seva dene ke liye hum bharosemand teesre paksh jaise OTP/login, payment, aur call (audio/video) seva dene wali companies ki madad lete hain. Unhe sirf zaroori jaankari hi milti hai.',
      'Kaanoon ya adaalat ke aadesh par, ya kisi ki suraksha ke liye zaroori hone par hum sarkari agencies ko jaankari de sakte hain.',
      'Aapko apni jaankari dekhne, lene (download), sudharne, sahmati wapas lene aur account hatane ka adhikaar hai (Digital Personal Data Protection Act, 2023 aur Rules, 2025 ke anusaar). App mein Account > Data aur privacy se yeh khud kar sakte hain. Kaanoon (jaise tax) ke liye zaroori len-den ka record bina naam ke rakha ja sakta hai.',
      'Aapki baat-cheet aapke aur Vendor ke beech ki hai, lekin intezaam aur suraksha ke liye Bondty ke paas uska record reh sakta hai.',
    ],
  },
  {
    title: 'Intellectual property',
    points: [
      'Bondty ka naam, logo, design, software, gifts ki animation aur baaki saari samagri Bondty ya uske licence dene walon ki hai. Bina likhit ijazat ke inhe copy, badalna ya vyavsayik istemaal mana hai.',
      'Aap jo likhte ya bhejte hain uske liye aap khud zimmedar hain.',
    ],
  },
  {
    title: 'Zimmedari ki seema (Disclaimer)',
    points: [
      'Bondty app "jaisa hai waisa" aur "jaisa uplabdh hai" ke aadhaar par diya jaata hai. Hum yeh guarantee nahi dete ki app hamesha bina rukawat ya galti ke chalega, ya network/call hamesha sahi hogi.',
      'Kaanoon ki anumati ki seema tak, Bondty kisi Vendor ki salah, vyavhaar ya baat-cheet se hone wale nuksan, bhaavnaatmak ya aarthik haani, ya teesre paksh ki galti ke liye zimmedar nahi hoga.',
      'Kisi bhi sthiti mein Bondty ki kul zimmedari aapke dwara pichle 3 mahine mein diye gaye paise tak hi seemit rahegi, jahan kaanoon isse rokta nahi.',
    ],
  },
  {
    title: 'Aapki zimmedari (Indemnity)',
    points: [
      'Agar aapke Terms todne, kaanoon todne ya doosron ke adhikar todne se Bondty ko koi nuksan, daava ya kharcha hota hai, to uski bharpai karne ki zimmedari aapki hogi.',
    ],
  },
  {
    title: 'Account band karna',
    points: [
      'Aap kabhi bhi account hatane ka anurodh kar sakte hain. Bacha hua wallet balance Bondty ki refund niti ke anusaar hi lautaya jayega.',
      'Terms todne, dhokhadhadi, galat vyavhaar ya kaanoon ke paalan ke liye zaroori hone par Bondty bina poorv suchna ke aapka account rok sakta hai ya hata sakta hai. Aisi sthiti mein bacha hua balance jaanch ke baad hi lautaya jayega, aur gambhir ullanghan mein roka bhi ja sakta hai.',
    ],
  },
  {
    title: 'Terms mein badlav',
    points: [
      'Hum samay-samay par in Terms ko badal sakte hain. Bade badlav hone par app mein dobara aapki sahmati maangi ja sakti hai. Badlav ke baad app istemaal karte rehne ka matlab hai ki aap naye Terms maante hain.',
    ],
  },
  {
    title: 'Lagu kanoon aur shikayat',
    points: [
      'Yeh Terms Bharat ke kaanoon ke adheen hain. Kisi bhi vivaad ke liye Bharat ki adaalatein adhikar kshetra rakhti hain.',
      'Kisi bhi shikayat ke liye app mein Account > Shikayat / Grievance Officer dekhein. Grievance Officer ka naam aur sampark wahan diya hai.',
      'Shikayat milte hi ticket number milta hai. Aam shikayat ka samadhan 7 din mein, aur ashleel/ghair-kanooni content ki shikayat par 36 ghante mein karwai hoti hai (Information Technology (Intermediary Guidelines) Amendment Rules, 2026).',
      'Jawab se santusht na hon to 30 din ke andar Grievance Appellate Committee (gac.gov.in) mein appeal kar sakte hain.',
      'Hum kam se kam har 3 mahine aapko in niyamon aur unke todne ke nateejon ki yaad dilayenge.',
    ],
  },
];

/** Sahmati ke 3 tick-box */
export const CONSENTS = [
  'Main apni marzi se yeh app istemaal kar raha/rahi hoon. Mujh par kisi ka dabaav ya laalach nahi hai.',
  'Meri umar 18 saal ya usse zyada hai.',
  'Main samajhta/samajhti hoon ki Bondty sirf baat-cheet (interaction) ke liye hai, koi professional salah ya emergency seva nahi, aur maine saare Terms padh kar maan liye hain.',
];
