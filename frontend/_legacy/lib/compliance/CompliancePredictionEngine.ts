// AI Compliance Prediction & Workload Optimization Engine
export interface StaffCapacity {
  id: string;
  name: string;
  department: string;
  assignedDeadlinesCount: number;
  maxCapacity: number;
  skills: string[]; // GST, ITR, TDS, ROC, etc.
}

export interface ClientFilingHistory {
  companyId: string;
  companyName: string;
  averageDelayDays: number;
  noticeFrequencyCount: number;
  unresponsiveIncidents: number;
  currentDocumentDelay: boolean;
}

export interface CapacityForecastResult {
  daysForecast: number;
  totalDeadlines: number;
  bottlenecksDetected: Array<{ date: string; loadPercentage: number; reason: string }>;
  departmentLoads: Record<string, number>;
}

export interface WorkloadRecommendation {
  eventId: string;
  eventTitle: string;
  currentAssigneeId?: string;
  recommendedAssigneeId: string;
  recommendedAssigneeName: string;
  reason: string;
}

export const MOCK_STAFF_CAPACITY: StaffCapacity[] = [
  { id: 'u1', name: 'Neha Roy', department: 'Indirect Tax', assignedDeadlinesCount: 14, maxCapacity: 20, skills: ['GST', 'TDS'] },
  { id: 'u2', name: 'Rohan Mehta', department: 'Audit & Corporate Law', assignedDeadlinesCount: 19, maxCapacity: 15, skills: ['ROC', 'Audit'] },
  { id: 'u3', name: 'Priya Sharma', department: 'Direct Tax', assignedDeadlinesCount: 8, maxCapacity: 15, skills: ['ITR', 'TDS'] },
  { id: 'u4', name: 'Amit Verma', department: 'Indirect Tax', assignedDeadlinesCount: 5, maxCapacity: 12, skills: ['GST'] }
];

export const MOCK_CLIENT_HISTORY: ClientFilingHistory[] = [
  { companyId: 'c1', companyName: 'Aegis Infotech Private Limited', averageDelayDays: 1.2, noticeFrequencyCount: 1, unresponsiveIncidents: 0, currentDocumentDelay: false },
  { companyId: 'c2', companyName: 'Zylos Pharma Limited', averageDelayDays: 5.4, noticeFrequencyCount: 4, unresponsiveIncidents: 3, currentDocumentDelay: true },
  { companyId: 'c3', companyName: 'Vortex Logistics LLP', averageDelayDays: 0.5, noticeFrequencyCount: 0, unresponsiveIncidents: 1, currentDocumentDelay: false }
];

export function get30_60_90DayForecast(eventsCount: number): CapacityForecastResult {
  return {
    daysForecast: 90,
    totalDeadlines: eventsCount * 3,
    bottlenecksDetected: [
      { date: '2026-07-07', loadPercentage: 112, reason: 'TDS deposit deadlines overlap with EPF filing schedules' },
      { date: '2026-07-15', loadPercentage: 125, reason: 'EPF ECR filing deadlines coincide with ESIC return updates' },
      { date: '2026-07-31', loadPercentage: 140, reason: 'ITR filing peak load for non-audit client profiles' }
    ],
    departmentLoads: {
      'Indirect Tax': 45,
      'Direct Tax': 80,
      'Audit & Corporate Law': 35
    }
  };
}

export function generateSmartWorkloadRecommendations(events: Array<{ id: string; title: string; category: string; companyId: string }>): WorkloadRecommendation[] {
  const recommendations: WorkloadRecommendation[] = [];

  events.forEach(evt => {
    // Find staff who have the skill matching the category and have the lowest load
    const matches = MOCK_STAFF_CAPACITY.filter(staff => 
      staff.skills.includes(evt.category)
    );

    if (matches.length > 0) {
      // Sort by assigned deadine count / max capacity (utilization percentage)
      const sorted = matches.sort((a, b) => 
        (a.assignedDeadlinesCount / a.maxCapacity) - (b.assignedDeadlinesCount / b.maxCapacity)
      );

      const best = sorted[0];
      const overloaded = sorted.find(s => s.assignedDeadlinesCount > s.maxCapacity);

      if (overloaded && best.id !== overloaded.id) {
        recommendations.push({
          eventId: evt.id,
          eventTitle: evt.title,
          currentAssigneeId: overloaded.id,
          recommendedAssigneeId: best.id,
          recommendedAssigneeName: best.name,
          reason: `Reassign from ${overloaded.name} (overloaded at ${((overloaded.assignedDeadlinesCount / overloaded.maxCapacity) * 100).toFixed(0)}% load) to ${best.name} who has matching skill [${evt.category}] and is under capacity.`
        });
      }
    }
  });

  return recommendations;
}

export function predictClientDelayRisk(clientHistory: ClientFilingHistory): { delayRiskScore: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  let score = 10;
  
  score += clientHistory.averageDelayDays * 8;
  score += clientHistory.noticeFrequencyCount * 12;
  score += clientHistory.unresponsiveIncidents * 15;
  if (clientHistory.currentDocumentDelay) score += 20;

  score = Math.min(100, score);
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (score > 75) riskLevel = 'CRITICAL';
  else if (score > 50) riskLevel = 'HIGH';
  else if (score > 25) riskLevel = 'MEDIUM';

  return {
    delayRiskScore: score,
    riskLevel
  };
}
