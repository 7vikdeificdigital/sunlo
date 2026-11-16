/**
 * Bondty Terms of Use: sections (title + points).
 * NOTE: Have a lawyer review this text before release, and fill in the COMPANY fields below.
 */
export const COMPANY = {
  name: 'Bondty',
  // Registered company name/address and the city of jurisdiction (a line is hidden when left empty)
  legalName: '',
  address: '',
  jurisdictionCity: '',
  supportEmail: '',
};

export type LegalSection = { title: string; points: string[] };

export const LAST_UPDATED = '10 November 2026';

export const TERMS_INTRO =
  "These Terms of Use (the \"Terms\") govern your use of the Bondty app and all related features. Please read them carefully before using the app. By using the app, you agree to be bound by these Terms.";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'About Bondty (nature of the service)',
    points: [
      "Bondty is a conversation platform. It lets you talk to \"Listeners\" and \"Experts\" (referred to below as \"Vendors\") through chat, audio calls or video calls.",
      "Bondty only connects you with another person. Vendors are independent individuals and are not employees of Bondty.",
      "The app is meant only for conversation, listening and feeling a little better. It is not a dating, matrimonial, employment, loan or any other deal-making service.",
    ],
  },
  {
    title: 'You are using the app voluntarily',
    points: [
      "You are using this app entirely of your own free will. No one has pressured, induced, deceived or forced you to do so.",
      "You understand that any conversation on the app takes place at your own discretion and responsibility.",
      "You may stop using the app at any time.",
    ],
  },
  {
    title: 'Eligibility (who can use the app)',
    points: [
      "You must be at least 18 years old to use the app. People under 18 must not use it.",
      "You must be legally capable of entering into a contract and must not have been previously banned from Bondty.",
      "You must provide your own correct mobile number and accurate information. Do not create an account using someone else's number or name.",
    ],
  },
  {
    title: 'Not professional advice',
    points: [
      "What Listeners and Experts say is their personal opinion. It is not a substitute for the advice of a doctor, mental health professional (therapist or counsellor), lawyer, chartered accountant or any other licensed professional.",
      "For medical, legal, financial or any other serious decision, always consult a qualified professional. You are solely responsible for any decision you make based on conversations on Bondty.",
      "Bondty is not an emergency service. If you or someone else is in danger, or you are having thoughts of harming yourself, call 112 immediately or go to the nearest hospital. For mental health support, you can contact the Tele-MANAS helpline at 14416.",
    ],
  },
  {
    title: 'Your account and security',
    points: [
      "You log in with your mobile number and an OTP. Never share your OTP with anyone. You are responsible for all activity on your account.",
      "If you believe someone else is using your account, tell us immediately through the Help section.",
      "One person may hold only one account. Creating a false or fake account is not allowed.",
    ],
  },
  {
    title: 'Wallet, coins and payments',
    points: [
      "All services on Bondty are paid for with wallet coins. One coin is valued at ₹1.",
      "Coins can be used only within Bondty. They cannot be transferred to another account, sold or withdrawn to a bank account, and they do not earn interest.",
      "Recharge payments are processed through authorised third-party payment providers. If a payment fails, or money is debited but coins are not credited, please tell us through the Help section and we will investigate and resolve it.",
      "Refunds are governed by Bondty's refund policy. Time that has already been used in a conversation is not refundable.",
      "A refund for an unused recharge is made only to the same card, UPI or bank account that was used for the payment. Coins are never exchanged for cash.",
      "Coin prices are shown before GST. 18% GST is charged at the time of recharge, so a rate of \"₹10/min\" means ₹11.80/min including GST. The rate is shown before every call.",
    ],
  },
  {
    title: 'Call and chat billing',
    points: [
      "Each Vendor's rate is shown in coins per minute. The clock starts as soon as the conversation begins.",
      "Billing is per minute. Any part of a minute is counted as a full minute.",
      "You can talk only for as many minutes as your wallet balance allows. When your balance runs out, the call or chat ends automatically, so please keep enough coins in your wallet before a long conversation.",
      "If a Vendor does not accept your request, or the conversation does not start, you are not charged.",
      "New users may receive a few free minutes (once per mobile number). The conditions of any free minutes are clearly shown before the call.",
      "You receive a warning about 1 minute before your balance runs out, and a receipt (minutes, rate and amount charged) is shown after every session.",
    ],
  },
  {
    title: 'Gifts',
    points: [
      "You may send coin gifts to a Vendor during a conversation. Sending a gift is entirely your choice.",
      "A gift cannot be taken back and its coins are not refundable. This also applies to gifts sent by mistake.",
      "Bondty deducts a commission on every gift and the remaining amount goes to the Vendor. Bondty may change the commission percentage from time to time.",
      "Gifts are not gambling, a lottery or a prize scheme. Sending a gift gives you no right to any financial benefit.",
    ],
  },
  {
    title: 'Rules for you (what is not allowed)',
    points: [
      "Abusing, threatening, harassing, stalking or insulting anyone, or spreading hatred against any religion, caste, gender or region.",
      "Asking for or sending obscene, sexual or nude messages, photos or videos. Bondty is not meant for any sexual service.",
      "Any inappropriate conduct involving a minor (under 18). If you see anything of this kind, report it immediately.",
      "Fraud, cheating, asking for money, luring anyone with investment, loan or lottery offers, or misleading anyone.",
      "Asking for a Vendor's or anyone's number, UPI ID, address or social media details, or making any payment outside Bondty.",
      "Discussing or promoting drugs, weapons, gambling or anything illegal.",
      "Recording someone's conversation without their permission, sharing screenshots or recordings, or violating anyone's privacy.",
      "Impersonating another person, hacking or tampering with the app, or running the app using bots or other automated means.",
      "Doing anything that violates any law of India.",
    ],
  },
  {
    title: 'About Vendors',
    points: [
      "The information on a Vendor's profile (such as experience, topics and ratings) is provided by the Vendor or based on user feedback. We do not guarantee any Vendor's views, advice or results.",
      "The user and the Vendor are each responsible for their own conversation. In any dispute, Bondty may act only as a mediator and is not bound by either party's position.",
    ],
  },
  {
    title: 'Chat monitoring and safety',
    points: [
      "To keep the platform safe, information such as phone numbers and links may be hidden automatically in chats.",
      "In reported or suspicious cases, the Bondty team may review chat records. This is done only for safety, fraud prevention and legal compliance.",
    ],
  },
  {
    title: 'Reports and enforcement',
    points: [
      "If any conversation or Vendor seems wrong to you, use the \"Report\" option in the app. We will investigate within 36 hours and, where needed, take action such as a warning, a suspension or closing the account.",
      "Making a false or malicious report is a violation of these Terms.",
    ],
  },
  {
    title: 'Your information and privacy',
    points: [
      "We collect your mobile number, name, date of birth (to verify that you are 18+), profile details, wallet transactions, conversation records (contact time, duration and chat messages) and essential device information.",
      "Audio and video calls are not recorded. Chat messages are deleted automatically after about 90 days, except those under review in a complaint.",
      "Your mood check-ins and notes are visible only to you, are stored encrypted, and are never used for advertising or any other purpose.",
      "We use this information to run the app, send login OTPs, process payments, connect calls, keep the platform safe, prevent fraud and improve the service. We do not sell your information.",
      "To provide the service, we use trusted third parties such as providers of OTP/login, payments and calls (audio/video). They receive only the information they need.",
      "We may share information with government agencies where required by law or a court order, or where necessary to protect someone's safety.",
      "Under the Digital Personal Data Protection Act, 2023 and the Rules, 2025, you have the right to view, download and correct your information, withdraw consent and delete your account. You can do all of this yourself in the app under Account > Data aur privacy. Transaction records that the law requires us to keep (for example for tax) may be retained in de-identified form.",
      "Your conversation is between you and the Vendor, but Bondty may keep a record of it for administration and safety.",
    ],
  },
  {
    title: 'Intellectual property',
    points: [
      "The Bondty name, logo, design, software, gift animations and all other content belong to Bondty or its licensors. You may not copy, modify or use them commercially without written permission.",
      "You are solely responsible for what you write or send.",
    ],
  },
  {
    title: 'Limitation of liability (disclaimer)',
    points: [
      "The Bondty app is provided on an \"as is\" and \"as available\" basis. We do not guarantee that the app will always run without interruption or errors, or that the network or calls will always work properly.",
      "To the extent permitted by law, Bondty is not liable for any loss arising from a Vendor's advice, conduct or conversation, any emotional or financial harm, or the fault of any third party.",
      "In any case, Bondty's total liability to you is limited to the amount you paid in the previous 3 months, except where the law does not permit such a limit.",
    ],
  },
  {
    title: 'Your responsibility (indemnity)',
    points: [
      "If Bondty suffers any loss, claim or expense because you broke these Terms, broke the law or violated anyone else's rights, you are responsible for compensating Bondty.",
    ],
  },
  {
    title: 'Account closure and termination',
    points: [
      "You may request deletion of your account at any time. Any remaining wallet balance will be returned only in accordance with Bondty's refund policy.",
      "Bondty may suspend or delete your account without prior notice if you breach these Terms, commit fraud or misconduct, or where required to comply with the law. In such cases, any remaining balance will be returned only after investigation, and may be withheld in serious violations.",
    ],
  },
  {
    title: 'Changes to these Terms',
    points: [
      "We may change these Terms from time to time. For major changes, we may ask for your consent again in the app. By continuing to use the app after a change, you accept the updated Terms.",
    ],
  },
  {
    title: 'Governing law and complaints',
    points: [
      "These Terms are governed by the laws of India, and the courts in India have jurisdiction over any dispute.",
      "For any complaint, see Account > Shikayat / Grievance Officer in the app. The Grievance Officer's name and contact details are provided there.",
      "You receive a ticket number as soon as you file a complaint. Ordinary complaints are resolved within 7 days, and complaints about obscene or illegal content are acted on within 36 hours (Information Technology (Intermediary Guidelines) Amendment Rules, 2026).",
      "If you are not satisfied with the response, you may appeal to the Grievance Appellate Committee (gac.gov.in) within 30 days.",
      "At least once every 3 months, we will remind you of these rules and the consequences of breaking them.",
    ],
  },
];

/** The 3 consent checkboxes */
export const CONSENTS = [
  "I am using this app of my own free will. No one has pressured or induced me.",
  "I am 18 years of age or older.",
  "I understand that Bondty is only for conversation, and is not a professional advice or emergency service. I have read and accept all of these Terms.",
];
