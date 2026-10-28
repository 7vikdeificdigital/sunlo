/**
 * Bondty Partner (Vendor) Terms.
 * DHYAN: ise lagane se pehle kisi vakeel se dikhwa lein aur niche ke COMPANY wale fields bharein.
 */
export const COMPANY = {
  name: 'Bondty',
  legalName: '',
  address: '',
  jurisdictionCity: '',
  supportEmail: '',
};

export type LegalSection = { title: string; points: string[] };

export const LAST_UPDATED = '27 October 2026';

export const TERMS_INTRO =
  'Yeh Partner Terms ("Terms") un Listeners aur Experts par lagu hote hain jo Bondty ke Partner app se users se baat karte hain. App istemaal karne se pehle inhe dhyan se padhein. App istemaal karna yaani in Terms ko maan lena.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Bondty aur aapki bhoomika',
    points: [
      'Bondty ek baat-cheet (interaction) ka platform hai jo users ko Listeners aur Experts se chat, audio call ya video call par jodta hai. Bondty sirf madhyam hai.',
      'Aap Bondty ke swatantra partner hain. Aap Bondty ke karmchari, agent ya saajhedaar nahi hain. Is Terms se naukri, vetan ya kisi tarah ki kamai ki guarantee nahi banti.',
      'Aap kab online aayenge aur kitna samay denge, yeh aapki apni marzi hai.',
    ],
  },
  {
    title: 'Aap apni marzi se jud rahe hain',
    points: [
      'Aap yeh app poori tarah apni swechha se istemaal kar rahe hain. Kisi ne aap par dabaav, laalach ya zabardasti nahi ki hai.',
      'Aap kabhi bhi online hona ya app istemaal karna band kar sakte hain.',
    ],
  },
  {
    title: 'Paatrata aur sahi jaankari',
    points: [
      'Aapki umar kam se kam 18 saal honi chahiye. Aap kaanoon ke hisaab se anubandh karne yogya hon aur pehle Bondty se prathibandhit (ban) na kiye gaye hon.',
      'Aapko apna sahi naam, mobile number, photo aur profile ki jaankari deni hogi. Jhoota ya nakli account, ya doosre ki pehchaan istemaal karna mana hai.',
      'Bondty aapse pehchaan ya anya jaankari (jaise KYC) maang sakta hai. Na dene par account ya kamai rok di ja sakti hai.',
      'Profile par aap jo anubhav, yogyata ya vishay likhte hain wo sach hona chahiye. Jo yogyata aapke paas nahi hai uska dava mana hai.',
    ],
  },
  {
    title: 'Seva ka swaroop: sirf baat-cheet',
    points: [
      'Bondty sirf baat-cheet, sunne-sunane aur halka mehsoos karne ke liye hai. Yahan dating, shaadi, nashe, jua, ya kisi bhi yaun ya gair-kanooni seva ka koi sthan nahi.',
      'Aap doctor, therapist/counsellor, vakeel, CA ya kisi licensed professional hone ka dava tabhi kar sakte hain jab aapke paas uski vaidh degree/licence ho. Bina licence ke medical, mansik swasthya, kanooni ya vitteey salah dena mana hai.',
      'Agar koi user khud ko nuksan pahunchane ya khatre ki baat kare, to use turant 112 par call karne ya najdeeki aspataal jaane ko kahein. Mansik swasthya madad ke liye Tele-MANAS 14416 ka suggestion de sakte hain. Aisi baat Report option se Bondty ko bhi batayein.',
    ],
  },
  {
    title: 'Kamai aur commission',
    points: [
      'Har session ka rate "coins per minute" mein tay hota hai. Bondty apna commission kaat kar bacha hua hissa aapke wallet mein jodta hai. Commission ka percentage aapko app mein dikhta hai aur Bondty ise samay-samay par badal sakta hai (badlav aage ke sessions par lagu hoga).',
      'Users ke gifts par bhi Bondty ka commission lagta hai, bacha hua hissa aapko milta hai.',
      'Billing minute ke hisaab se hoti hai. Agar user ke wallet ka balance khatam ho jaye to session apne aap band ho jata hai. Jo session shuru nahi hua ya user ne poora nahi kiya uski kamai nahi hoti.',
      'Kamai wallet mein dikhti hai. Wallet se paise nikalna Bondty ki payout niti, samay aur shartein ke anusaar hoga.',
      'Aapki kamai par lagne wale kar (jaise income tax aur jahan lagu ho GST) ki zimmedari aapki apni hai. Bondty kaanoon ke anusaar zaroori hone par TDS jaise kat-outi kar sakta hai aur jaankari sarkar ko de sakta hai.',
      'Dhokhadhadi, galat tareeke se ki gayi kamai ya Terms todne par Bondty us kamai ko ghata ya rok sakta hai.',
    ],
  },
  {
    title: 'Gifts',
    points: [
      'Users apni marzi se gift bhej sakte hain. Aap gift maangne, mazboor karne, ya uske badle koi khaas baat/seva dene ka dabaav nahi bana sakte.',
      'Gift se milne wali kamai commission kaatne ke baad aapko milti hai. Wapas hue (refund) ya galat tareeke se liye gift ki kamai Bondty kaat sakta hai.',
    ],
  },
  {
    title: 'Aapke liye niyam (kya mana hai)',
    points: [
      'Gaali-galoch, dhamki, pareshaan karna, apmaan, ya kisi dharm, jaati, ling ya kshetra ke khilaaf nafrat.',
      'Ashleel, yaun ya nagn baatein, tasveerein ya video maangna/bhejna, ya user ko is tarah ki baat ke liye uksaana.',
      'Kisi naabalig (18 saal se kam) ke saath baat-cheet ka sandeh ho to turant sessions rok kar report karein.',
      'Dhokha, thagi, paise maangna, nivesh/loan/lottery ka laalach, ya user ko bahkana.',
      'User se number, UPI, address ya social media maangna, apna dena, ya Bondty se bahar paise ya sampark ka len-den karna.',
      'Nashe, hathiyaar, jua ya kisi gair-kanooni cheez ka prachaar.',
      'User ki baat-cheet record karna, screenshot lena ya kisi aur ko dikhana/failana.',
      'Kisi aur ka roop dharna, app mein hack/chhed-chhaad karna, ya bots/automatic tareeke se app chalana.',
      'Bina baat kiye online dikhna ya jaanboojh kar session chalu rakhna taaki billing badhe.',
      'Bharat ke kisi bhi kaanoon ke khilaaf kuch bhi karna.',
    ],
  },
  {
    title: 'Users ki gopniyata',
    points: [
      'Users jo bhi baatein aapko batate hain wo gopniya hain. Unhe aap kisi aur ko nahi bata sakte, kahin save, copy ya share nahi kar sakte, aur apne faayde ke liye istemaal nahi kar sakte.',
      'Sirf kaanoon ya suraksha ke liye zaroori hone par (jaise kisi ki jaan ko khatra) Bondty ko batana is niyam ka ullanghan nahi maana jayega.',
      'Yeh zimmedari account band hone ke baad bhi rehti hai.',
    ],
  },
  {
    title: 'Chat ki nigrani aur suraksha',
    points: [
      'Surakshit mahaul banaye rakhne ke liye chat mein phone number, link jaisi jaankari apne aap chhupayi ja sakti hai.',
      'Report kiye gaye ya sandehaspad maamlon mein Bondty ki team session aur chat ka record dekh sakti hai. Isse sirf suraksha, dhokhadhadi rokne aur kaanoon ke paalan ke liye hi istemaal kiya jaata hai.',
    ],
  },
  {
    title: 'Report aur karwai',
    points: [
      'Users ya Bondty ki team aapke khilaaf report kar sakte hain. Jaanch ke baad Bondty warning de sakta hai, aapko offline kar sakta hai, kamai rok sakta hai ya account band kar sakta hai. Gambhir maamlon mein bina poorv suchna ke bhi.',
      'Jhoothi ya durbhavna se ki gayi report karna Terms ka ullanghan hai.',
      'Aapke saath kuch galat ho (jaise koi user abhadra ho) to aap bhi app mein Report kar sakte hain.',
    ],
  },
  {
    title: 'Aapki jaankari aur privacy',
    points: [
      'Hum aapka mobile number, naam, profile aur photo, kamai/wallet ka record, session ka record (samay, avadhi, chat sandesh) aur device ki zaroori jaankari jama karte hain.',
      'Yeh jaankari app chalane, login/OTP bhejne, kamai ka hisaab, calls jodne, suraksha banaye rakhne, dhokhadhadi rokne aur seva behtar karne ke liye istemaal hoti hai. Hum aapki jaankari bechte nahi hain.',
      'Aapka naam aur profile ki jaankari (jaise photo, vishay, rating) users ko dikhti hai.',
      'Seva dene ke liye hum bharosemand teesre paksh jaise OTP/login, aur call (audio/video) seva dene wali companies ki madad lete hain. Unhe sirf zaroori jaankari hi milti hai.',
      'Kaanoon ya adaalat ke aadesh par, ya kisi ki suraksha ke liye zaroori hone par hum sarkari agencies ko jaankari de sakte hain.',
      'Aapko apni jaankari dekhne, sudharne aur account hatane ka adhikaar hai (Digital Personal Data Protection Act, 2023 ke anusaar). Iske liye Help section se sampark karein. Kaanoon ya suraksha ke liye zaroori record kuch samay tak rakhe ja sakte hain.',
    ],
  },
  {
    title: 'Intellectual property',
    points: [
      'Bondty ka naam, logo, design, software, gifts ki animation aur baaki saari samagri Bondty ya uske licence dene walon ki hai. Bina likhit ijazat ke inhe copy, badalna ya vyavsayik istemaal mana hai.',
      'Aap apna photo/profile text Bondty ko app chalane ke liye istemaal karne ki anumati dete hain.',
    ],
  },
  {
    title: 'Zimmedari ki seema (Disclaimer)',
    points: [
      'Bondty app "jaisa hai waisa" aur "jaisa uplabdh hai" ke aadhaar par diya jaata hai. Hum yeh guarantee nahi dete ki app hamesha bina rukawat ya galti ke chalega, ya users milenge, ya network/call hamesha sahi hogi.',
      'Kaanoon ki anumati ki seema tak, Bondty user ke vyavhaar, kamai ki kami ya teesre paksh ki galti se hone wali haani ke liye zimmedar nahi hoga.',
      'Kisi bhi sthiti mein Bondty ki kul zimmedari aapko pichle 3 mahine mein mili kamai tak hi seemit rahegi, jahan kaanoon isse rokta nahi.',
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
      'Aap kabhi bhi partner banna band karne ka anurodh kar sakte hain. Bachi hui kamai Bondty ki payout niti ke anusaar milegi, jaanch ya vivaad hone par ruk sakti hai.',
      'Terms todne, dhokhadhadi, users ki shikayat ya kaanoon ke paalan ke liye zaroori hone par Bondty aapka account rok sakta hai ya hata sakta hai.',
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
      'Kisi bhi shikayat ya sujhav ke liye app ke Help section ka istemaal karein. Hum shikayat ko Information Technology (Intermediary Guidelines) Rules ke anusaar nipatayenge.',
    ],
  },
];

/** Sahmati ke 3 tick-box */
export const CONSENTS = [
  'Main apni marzi se Bondty ka swatantra partner ban raha/rahi hoon. Mujh par kisi ka dabaav ya laalach nahi hai.',
  'Meri umar 18 saal ya usse zyada hai aur maine jo jaankari di hai wo sahi hai.',
  'Main samajhta/samajhti hoon ki Bondty sirf baat-cheet (interaction) ke liye hai, main bina licence professional salah nahi dunga/dungi, users ki baatein gopniya rakhunga/rakhungi, aur maine commission samet saare Terms padh kar maan liye hain.',
];
