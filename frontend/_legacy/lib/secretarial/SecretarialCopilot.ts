// Secretarial AI Copilot & Compliance Risk Engine
export interface RiskFactors {
  overdueFilings: string[];
  kycPendingDirectors: string[];
  expiredDscs: string[];
  missingAgm: boolean;
  missingResolutions: string[];
  missingRegisters: string[];
  lateFilingsCount: number;
}

export interface RiskAnalysisResult {
  score: number; // 0-100
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  penaltyExposure: number; // in INR
  recommendations: string[];
}

export const COPILOT_KNOWLEDGE_BASE = [
  {
    topic: 'Section 188',
    keywords: ['rpt', 'related party', 'relatives', 'arm\'s length'],
    answer: 'Section 188 of the Companies Act, 2013 deals with Related Party Transactions (RPT). Transactions that are NOT in the ordinary course of business or NOT at arm\'s length require prior Board approval. If transaction values exceed limits specified under Rule 15 of Companies (Meetings of Board and its Powers) Rules, 2014, ordinary resolution in a general meeting of shareholders is required.'
  },
  {
    topic: '21 Clear Days',
    keywords: ['agm notice', 'notice period', 'clear days', 'notice duration'],
    answer: 'Under Section 101(1) of the Act, a general meeting (AGM/EGM) requires at least 21 clear days\' notice. "Clear days" excludes the day of serving the notice (normally +48 hours if sent by post/email under rules) and the day of the meeting itself. Thus, physically count at least 23-24 calendar days between date of dispatch and date of meeting.'
  },
  {
    topic: 'Quorum',
    keywords: ['quorum', 'board meeting quorum', 'attendance minimum'],
    answer: 'Section 174 of the Companies Act, 2013 mandates that the quorum for a Board Meeting shall be 1/3rd of the total strength or 2 directors, whichever is higher. For public listed companies under SEBI LODR, the quorum is 1/3rd or 3 directors, whichever is higher, including at least one independent director.'
  },
  {
    topic: 'AOC-4',
    keywords: ['aoc-4', 'aoc4', 'financial filing', 'filing balance sheet'],
    answer: 'Form AOC-4 is used for filing financial statements with the ROC. Under Section 137, it must be filed within 30 days of the AGM. For companies falling under XBRL mandates (paid-up capital >= ₹5 crore or turnover >= ₹100 crore), AOC-4 XBRL must be filed.'
  },
  {
    topic: 'MGT-7',
    keywords: ['mgt-7', 'mgt7', 'annual return', 'mgt-7a'],
    answer: 'Form MGT-7 is the Annual Return of a company. Under Section 92, it must be filed within 60 days of the AGM. Small companies and One Person Companies (OPCs) file an abridged annual return in Form MGT-7A.'
  },
  {
    topic: 'DIR-3 KYC',
    keywords: ['dir-3 kyc', 'dir3 kyc', 'director kyc', 'kyc din'],
    answer: 'Every director holding a DIN as of March 31st must file DIR-3 KYC (or verify DIR-3 KYC web) on or before September 30th of the immediate next financial year. Failure to file results in a deactivated DIN status and a standard late fee penalty of ₹5,000.'
  }
];

export const MCA_FORM_CATALOG = [
  { form: 'AOC-4', purpose: 'Filing Financial Statements and Board\'s Report', dueRule: 'Within 30 days of the AGM' },
  { form: 'MGT-7', purpose: 'Filing Annual Return (Regular Companies)', dueRule: 'Within 60 days of the AGM' },
  { form: 'MGT-7A', purpose: 'Filing Annual Return (Small Companies / OPCs)', dueRule: 'Within 60 days of the AGM' },
  { form: 'DIR-3 KYC', purpose: 'Director DIN KYC verification', dueRule: 'On or before September 30th annually' },
  { form: 'DIR-12', purpose: 'Particulars of Appointment / Resignation of Directors & KMPs', dueRule: 'Within 30 days of change' },
  { form: 'ADT-1', purpose: 'Notice of Appointment of Auditor', dueRule: 'Within 15 days of AGM/Board meeting' },
  { form: 'MGT-14', purpose: 'Filing of Board Resolutions / Special Resolutions', dueRule: 'Within 30 days of passing' },
  { form: 'SH-7', purpose: 'Notice of Alteration of Share Capital (Increase/Split)', dueRule: 'Within 30 days of change' },
  { form: 'INC-22A', purpose: 'ACTIVE (Active Company Tagging Identities and Verification)', dueRule: 'One-time reporting with photos of registered office' },
  { form: 'CHG-1', purpose: 'Creation / Modification of Charge (Secured Loans)', dueRule: 'Within 30 days of creation' },
  { form: 'CHG-4', purpose: 'Satisfaction of Charge (Loan Closure)', dueRule: 'Within 30 days of satisfaction' },
  { form: 'LLP-8', purpose: 'LLP Statement of Account & Solvency', dueRule: 'Within 30 days from end of 6 months of FY (Oct 30th)' },
  { form: 'LLP-11', purpose: 'LLP Annual Return', dueRule: 'Within 60 days of FY close (May 30th)' }
];

export function calculateSecretarialRisk(factors: RiskFactors): RiskAnalysisResult {
  let score = 10; // base score (perfect health is 0, highest risk is 100)
  const recommendations: string[] = [];
  let penaltyExposure = 0;

  // 1. Overdue Filings
  if (factors.overdueFilings.length > 0) {
    score += factors.overdueFilings.length * 20;
    penaltyExposure += factors.overdueFilings.length * 5000; // standard late filing fee is ₹100 per day or standard penalties
    recommendations.push(`Filing Overdue: Instantly file pending forms: ${factors.overdueFilings.join(', ')}.`);
  }

  // 2. KYC status
  if (factors.kycPendingDirectors.length > 0) {
    score += factors.kycPendingDirectors.length * 15;
    penaltyExposure += factors.kycPendingDirectors.length * 5000; // standard ₹5000 penalty for DIN KYC delay
    recommendations.push(`DIR-3 KYC: File KYC for DIN holders: ${factors.kycPendingDirectors.join(', ')} to prevent DIN deactivation.`);
  }

  // 3. Expired DSC
  if (factors.expiredDscs.length > 0) {
    score += factors.expiredDscs.length * 10;
    recommendations.push(`DSC Renewal: Renew digital signatures for: ${factors.expiredDscs.join(', ')} to authorize filings.`);
  }

  // 4. Missing AGM
  if (factors.missingAgm) {
    score += 30;
    penaltyExposure += 50000; // compounding penalty for failure to hold AGM
    recommendations.push(`AGM Overdue: Hold the annual general meeting immediately or file an extension request (Form GNL-1) with the ROC.`);
  }

  // 5. Missing Resolutions or Registers
  if (factors.missingResolutions.length > 0) {
    score += factors.missingResolutions.length * 5;
    recommendations.push(`Missing Resolutions: Draft and sign minutes resolutions for ${factors.missingResolutions.join(', ')}.`);
  }
  if (factors.missingRegisters.length > 0) {
    score += factors.missingRegisters.length * 8;
    recommendations.push(`Incomplete Registers: Update Statutory Registers: ${factors.missingRegisters.join(', ')}.`);
  }

  // Cap the score
  score = Math.min(100, score);
  let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score > 75) level = 'CRITICAL';
  else if (score > 50) level = 'HIGH';
  else if (score > 25) level = 'MEDIUM';

  return {
    score,
    level,
    penaltyExposure,
    recommendations
  };
}

export function queryCopilotEngine(question: string): { answer: string; topicMatched?: string; suggestedForms?: string[] } {
  const query = question.toLowerCase();
  
  // Find matching knowledge base entry
  const match = COPILOT_KNOWLEDGE_BASE.find(kb => 
    kb.keywords.some(kw => query.includes(kw))
  );

  // Suggest relevant forms
  const suggestedForms = MCA_FORM_CATALOG.filter(form => 
    form.form.toLowerCase().includes(query) || 
    form.purpose.toLowerCase().includes(query) ||
    form.dueRule.toLowerCase().includes(query)
  ).map(f => `${f.form} (${f.purpose})`);

  if (match) {
    return {
      answer: match.answer,
      topicMatched: match.topic,
      suggestedForms: suggestedForms.length > 0 ? suggestedForms : undefined
    };
  }

  if (suggestedForms.length > 0) {
    return {
      answer: `Based on your query regarding compliance filing forms, the following ROC Forms appear relevant:\n\n` + 
        suggestedForms.map(f => `• **${f}**`).join('\n') + 
        `\n\nWould you like me to open the draft editor or check the filing checklist for any of these?`,
      suggestedForms
    };
  }

  return {
    answer: `I am your Secretarial AI Copilot. I can assist with Companies Act 2013 queries, SS-1 Board Meeting rules, notice calculations, or ROC filing preparations. \n\nFor example, try asking:\n• "How do we satisfy a mortgage charge?"\n• "What is the notice period for an AGM?"\n• "Suggest forms for appointing a director"`
  };
}
