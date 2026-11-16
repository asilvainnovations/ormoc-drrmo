// src/db/analytics.ts
import { db } from './index'; // Your existing Dexie instance

export const getShiftDelta = async (lastVisitTs: number) => {
  const [newLogs, newReports, openedReqs, closedReqs, newSitReps, eocChanges] = await Promise.all([
    db.logbookEntries.where('timestamp').above(lastVisitTs).count(),
    db.barangayReports.where('timestamp').above(lastVisitTs).count(),
    db.resourceRequests.where('timestamp').above(lastVisitTs).and(r => r.status === 'opened').count(),
    db.resourceRequests.where('timestamp').above(lastVisitTs).and(r => r.status === 'closed').count(),
    db.sitreps.where('timestamp').above(lastVisitTs).count(),
    db.eocLevels.where('timestamp').above(lastVisitTs).count()
  ]);
  return { newLogs, newReports, openedReqs, closedReqs, newSitReps, eocChanges };
};

export const getOperationalTrends = async () => {
  const now = Date.now();
  const dayAgo = now - 86400000;
  const weekAgo = now - 604800000;

  const [reports24h, reports7d, openReqs, campOccupancy] = await Promise.all([
    db.barangayReports.where('timestamp').above(dayAgo).count(),
    db.barangayReports.where('timestamp').above(weekAgo).count(),
    db.resourceRequests.where('status').equals('open').count(),
    db.evacuationCenters.filter(ec => ec.status === 'active').count() // ECHO camp occupancy proxy
  ]);

  return { reports24h, reports7d, openReqs, campOccupancy };
};

export const getReadinessTrend = async () => {
  // Fetch last two IAT assessment cycles
  const assessments = await db.iatAssessments.orderBy('cycleDate').reverse().limit(2).toArray();
  if (assessments.length < 2) return null;
  const [current, previous] = assessments;
  return {
    currentScore: current.maturityIndex,
    previousScore: previous.maturityIndex,
    delta: current.maturityIndex - previous.maturityIndex,
    metItemsDelta: current.metItemsCount - previous.metItemsCount
  };
};

export const getDataQualityFlags = async () => {
  const now = Date.now();
  const staleThreshold = now - 43200000; // 12 hours
  
  const [staleBarangays, oldestOutbox, syncConflicts, unconfirmedIAT] = await Promise.all([
    // Barangays with no report in 12h (assuming 85 barangays total)
    db.barangayReports
      .where('timestamp').below(staleThreshold)
      .distinct().toArray().then(reports => 85 - new Set(reports.map(r => r.psgcCode)).size),
    
    db.syncQueue.where('status').equals('pending').sortBy('timestamp').then(queue => queue[0]?.timestamp || null),
    db.syncConflicts.count(),
    db.iatAnswers.where('isPrefilled').equals(true).and(a => !a.isConfirmed).count()
  ]);

  return { staleBarangays, oldestOutbox, syncConflicts, unconfirmedIAT };
};

export const getHazardContext = async () => {
  // Cross DDRiVE high-susceptibility with missing reports (last 12h)
  const staleThreshold = Date.now() - 43200000;
  const highRiskBarangays = await db.barangayHazardProfile
    .where('floodSusceptibility').anyOf(['High', 'High-Very High', 'Very High'])
    .toArray();
  
  const recentReports = await db.barangayReports
    .where('timestamp').above(staleThreshold)
    .distinct().toArray();
    
  const reportedCodes = new Set(recentReports.map(r => r.psgcCode));
  const unreportedHighRisk = highRiskBarangays.filter(b => !reportedCodes.has(b.psgcCode));

  return {
    totalHighRisk: highRiskBarangays.length,
    unreportedCount: unreportedHighRisk.length,
    unreportedNames: unreportedHighRisk.slice(0, 3).map(b => b.barangayName) // Max 3 for UI
  };
};

export const getEvacuationSitesStatus = async () => {
  // Based on LDRRMP/CDP and IAT findings (e.g., Danhug in high-liquefaction zone)
  const sites = await db.evacuationCenters.toArray();
  const atRiskSites = sites.filter(s => s.hazardFlag === 'high-liquefaction' || s.retrofitStatus === 'pending');
  return { total: sites.length, atRisk: atRiskSites.length, atRiskNames: atRiskSites.map(s => s.name) };
};
