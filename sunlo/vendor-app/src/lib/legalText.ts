/**
 * Bondty Partner (Vendor) Terms.
 * NOTE: Have a lawyer review this text before release, and fill in the COMPANY fields below.
 */
export const COMPANY = {
  name: 'Bondty',
  legalName: '',
  address: '',
  jurisdictionCity: '',
  supportEmail: '',
};

export type LegalSection = { title: string; points: string[] };

export const LAST_UPDATED = '10 November 2026';

export const TERMS_INTRO =
  "These Partner Terms (the \"Terms\") apply to the Listeners and Experts who talk to users through the Bondty Partner app. Please read them carefully before using the app. By using the app, you agree to be bound by these Terms.";

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Bondty and your role',
    points: [
      "Bondty is a conversation platform that connects users with Listeners and Experts through chat, audio calls or video calls. Bondty is only the intermediary.",
      "You are an independent partner of Bondty. You are not an employee, agent or partner (in the legal sense) of Bondty. These Terms do not create employment, a salary or any guarantee of earnings.",
      "When you go online and how much time you give is entirely your choice.",
    ],
  },
  {
    title: 'You are joining voluntarily',
    points: [
      "You are using this app entirely of your own free will. No one has pressured, induced or forced you to do so.",
      "You may go offline or stop using the app at any time.",
    ],
  },
  {
    title: 'Eligibility and accurate information',
    points: [
      "You must be at least 18 years old, legally capable of entering into a contract, and must not have been previously banned from Bondty.",
      "You must provide your correct name, mobile number, photo and profile details. Using a false or fake account, or another person's identity, is not allowed.",
      "Bondty may ask you for identity or other information (such as KYC). If you do not provide it, your account or earnings may be withheld.",
      "The experience, qualifications and topics you list on your profile must be true. Claiming a qualification you do not have is not allowed.",
    ],
  },
  {
    title: 'Nature of the service: conversation only',
    points: [
      "Bondty is only for conversation, listening and helping people feel a little better. There is no place here for dating, matrimony, drugs, gambling, or any sexual or illegal service.",
      "You may claim to be a doctor, therapist or counsellor, lawyer, CA or any other licensed professional only if you hold a valid degree or licence for it. Giving medical, mental health, legal or financial advice without a licence is not allowed.",
      "If a user talks about harming themselves or being in danger, ask them to call 112 immediately or go to the nearest hospital. You may suggest Tele-MANAS at 14416 for mental health support. Please also report such a conversation to Bondty using the Report option.",
    ],
  },
  {
    title: 'Earnings and commission',
    points: [
      "Each session's rate is set in coins per minute. Bondty deducts its commission and credits the remaining amount to your wallet. The commission percentage is shown in the app, and Bondty may change it from time to time (a change applies to later sessions).",
      "Bondty's commission also applies to gifts from users, and the remaining amount goes to you.",
      "Billing is per minute. If the user's wallet balance runs out, the session ends automatically. You do not earn from a session that did not start or that the user did not complete.",
      "Your earnings are shown in your wallet. Withdrawing money from the wallet is subject to Bondty's payout policy, timelines and conditions.",
      "You are responsible for any taxes on your earnings (such as income tax and, where applicable, GST).",
      "As required by the Income-tax Act (Section 393 / formerly Section 194-O), Bondty deducts TDS on the gross amount of every earning: 0.1% if you provide your PAN and 5% if you do not. The deducted TDS is deposited with the government and you can claim it in your income tax return. This is why providing your PAN is important.",
      "Bondty pays for the free trial minutes given to new users, so you receive your full earnings for those minutes.",
      "A monthly statement (gross amount, platform fee, TDS and net amount) is available in the app under Account > Mahine ka statement.",
      "Bondty may reduce or withhold earnings that result from fraud, improper means or a breach of these Terms.",
    ],
  },
  {
    title: 'Gifts',
    points: [
      "Users may send gifts of their own free will. You must not ask for gifts, pressure users for them, or promise any special conversation or service in return.",
      "Earnings from a gift are paid to you after commission is deducted. Bondty may deduct earnings from gifts that are refunded or obtained improperly.",
    ],
  },
  {
    title: 'Rules for you (what is not allowed)',
    points: [
      "Abusing, threatening, harassing or insulting anyone, or spreading hatred against any religion, caste, gender or region.",
      "Asking for or sending obscene, sexual or nude messages, photos or videos, or encouraging a user to do so.",
      "If you suspect you are talking to a minor (under 18), stop the session immediately and report it.",
      "Fraud, cheating, asking for money, luring anyone with investment, loan or lottery offers, or misleading a user.",
      "Asking a user for their number, UPI ID, address or social media details, giving out your own, or exchanging money or contact details outside Bondty.",
      "Promoting drugs, weapons, gambling or anything illegal.",
      "Recording a user's conversation, taking screenshots, or showing or sharing them with anyone else.",
      "Impersonating another person, hacking or tampering with the app, or running the app using bots or other automated means.",
      "Appearing online without actually talking, or deliberately keeping a session running to increase billing.",
      "Doing anything that violates any law of India.",
    ],
  },
  {
    title: 'Confidentiality of users',
    points: [
      "Everything users tell you is confidential. You must not tell it to anyone else, save, copy or share it anywhere, or use it for your own benefit.",
      "Disclosing information to Bondty where required by law or to protect safety (for example, a threat to someone's life) is not a breach of this rule.",
      "This obligation continues after your account is closed.",
    ],
  },
  {
    title: 'Chat monitoring and safety',
    points: [
      "To keep the platform safe, information such as phone numbers and links may be hidden automatically in chats.",
      "In reported or suspicious cases, the Bondty team may review session and chat records. This is done only for safety, fraud prevention and legal compliance.",
    ],
  },
  {
    title: 'Reports and enforcement',
    points: [
      "Users or the Bondty team may report you. After an investigation, Bondty may warn you, take you offline, withhold earnings or close your account, and in serious cases may do so without prior notice.",
      "Making a false or malicious report is a violation of these Terms.",
      "If something wrong happens to you (for example, a user behaves inappropriately), you can also use Report in the app.",
    ],
  },
  {
    title: 'Your information and privacy',
    points: [
      "We collect your mobile number, name, profile and photo, earnings and wallet records, session records (time, duration and chat messages) and essential device information.",
      "We use this information to run the app, send login OTPs, calculate earnings, connect calls, keep the platform safe, prevent fraud and improve the service. We do not sell your information.",
      "Your name and profile details (such as photo, topics and rating) are visible to users.",
      "To provide the service, we use trusted third parties such as providers of OTP/login and calls (audio/video). They receive only the information they need.",
      "We may share information with government agencies where required by law or a court order, or where necessary to protect someone's safety.",
      "Under the Digital Personal Data Protection Act, 2023, you have the right to view and correct your information and to delete your account. To exercise these rights, contact us through the Help section. Records required for legal or safety reasons may be retained for some time.",
    ],
  },
  {
    title: 'Intellectual property',
    points: [
      "The Bondty name, logo, design, software, gift animations and all other content belong to Bondty or its licensors. You may not copy, modify or use them commercially without written permission.",
      "You permit Bondty to use your photo and profile text to operate the app.",
    ],
  },
  {
    title: 'Limitation of liability (disclaimer)',
    points: [
      "The Bondty app is provided on an \"as is\" and \"as available\" basis. We do not guarantee that the app will always run without interruption or errors, that you will receive users, or that the network or calls will always work properly.",
      "To the extent permitted by law, Bondty is not liable for any user's conduct, any shortfall in earnings, or any loss caused by a third party's fault.",
      "In any case, Bondty's total liability to you is limited to the earnings you received in the previous 3 months, except where the law does not permit such a limit.",
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
      "You may request to stop being a partner at any time. Any remaining earnings will be paid according to Bondty's payout policy, and may be held during an investigation or dispute.",
      "Bondty may suspend or delete your account if you breach these Terms, if users complain, if there is fraud, or where required to comply with the law.",
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
      "For any complaint, use the Help section of the app. You receive a ticket number as soon as you file a complaint. Ordinary complaints are resolved within 7 days, and complaints about obscene or illegal content within 36 hours (Information Technology (Intermediary Guidelines) Amendment Rules, 2026).",
      "On a court or government order, Bondty may remove a profile, message or room immediately (within 3 hours).",
    ],
  },
];

/** The 3 consent checkboxes */
export const CONSENTS = [
  "I am becoming an independent partner of Bondty of my own free will. No one has pressured or induced me.",
  "I am 18 years of age or older, and the information I have provided is correct.",
  "I understand that Bondty is only for conversation. I will not give professional advice without a licence, I will keep users' conversations confidential, and I have read and accept all of these Terms, including the commission.",
];
