import fs from 'fs';
import path from 'path';

export function computeFinalScore(allHandoffs: Record<string, any>): number {
  let score = 100;
  
  // Phase B security findings
  const secFindings = allHandoffs['B']?.security_findings || [];
  for (const bug of secFindings) {
    if (bug.severity === 'critical') score -= 20;
    else if (bug.severity === 'high') score -= 8;
    else if (bug.severity === 'medium') score -= 3;
    else if (bug.severity === 'low') score -= 1;
  }

  // Phase C bugs
  const phaseCBugs = allHandoffs['C']?.bugs_found || [];
  for (const bug of phaseCBugs) {
    if (bug.severity === 'critical') score -= 20;
    else if (bug.severity === 'high') score -= 8;
    else if (bug.severity === 'medium') score -= 3;
    else if (bug.severity === 'low') score -= 1;
  }

  // Phase D platform bugs or all_bugs
  const phaseDBugs = allHandoffs['D']?.all_bugs || [];
  for (const bug of phaseDBugs) {
    if (bug.severity === 'critical') score -= 20;
    else if (bug.severity === 'high') score -= 8;
    else if (bug.severity === 'medium') score -= 3;
    else if (bug.severity === 'low') score -= 1;
  }

  // Manifest MV3 Compliance bonus (+5)
  if (allHandoffs['E']?.mv3_compliance?.passed === true) {
    score += 5;
  }

  // UX dimensions score >= 7 bonus (+5)
  const uxScores = allHandoffs['E']?.ux_scores || {};
  const uxDimensions = Object.values(uxScores) as Array<{ score: number }>;
  if (uxDimensions.length > 0 && uxDimensions.every(d => d.score >= 7)) {
    score += 5;
  }

  return Math.max(0, Math.min(110, score));
}

export function buildReadinessReport(score: number, allHandoffs: Record<string, any>) {
  const blockers: string[] = [];
  const niceToHave: string[] = [];
  
  const secFindings = allHandoffs['B']?.security_findings || [];
  for (const bug of secFindings) {
    if (['critical', 'high'].includes(bug.severity)) {
      blockers.push(`Phase B Security Finding (${bug.id}): ${bug.description}`);
    } else {
      niceToHave.push(`Phase B Security Finding (${bug.id}): ${bug.description}`);
    }
  }

  const phaseCBugs = allHandoffs['C']?.bugs_found || [];
  for (const bug of phaseCBugs) {
    if (['critical', 'high'].includes(bug.severity)) {
      blockers.push(`Phase C Bug (${bug.id}): ${bug.description}`);
    } else {
      niceToHave.push(`Phase C Bug (${bug.id}): ${bug.description}`);
    }
  }

  const phaseDBugs = allHandoffs['D']?.all_bugs || [];
  for (const bug of phaseDBugs) {
    if (['critical', 'high'].includes(bug.severity)) {
      blockers.push(`Phase D Bug (${bug.id}): ${bug.description}`);
    } else {
      niceToHave.push(`Phase D Bug (${bug.id}): ${bug.description}`);
    }
  }

  for (const phase of ['A', 'B', 'C', 'D', 'E']) {
    const cb = allHandoffs[phase]?.critical_blockers || [];
    for (const blocker of cb) {
      blockers.push(`Phase ${phase} Blocker: ${blocker}`);
    }
  }

  // Subscores calculation:
  // Stability subscore: starts at 100, drops by unresolved non-security bugs
  let stabilitySub = 100;
  for (const bug of phaseCBugs) {
    if (bug.severity === 'critical') stabilitySub -= 20;
    else if (bug.severity === 'high') stabilitySub -= 8;
    else if (bug.severity === 'medium') stabilitySub -= 3;
    else if (bug.severity === 'low') stabilitySub -= 1;
  }
  for (const bug of phaseDBugs) {
    if (bug.severity === 'critical') stabilitySub -= 20;
    else if (bug.severity === 'high') stabilitySub -= 8;
    else if (bug.severity === 'medium') stabilitySub -= 3;
    else if (bug.severity === 'low') stabilitySub -= 1;
  }
  stabilitySub = Math.max(0, Math.min(100, stabilitySub));

  // Security subscore: starts at 100, drops by security findings
  let securitySub = 100;
  for (const bug of secFindings) {
    if (bug.severity === 'critical') securitySub -= 20;
    else if (bug.severity === 'high') securitySub -= 8;
    else if (bug.severity === 'medium') securitySub -= 3;
    else if (bug.severity === 'low') securitySub -= 1;
  }
  securitySub = Math.max(0, Math.min(100, securitySub));

  // Performance subscore: default 100, can deduct if peak CPU or leak found
  let perfSub = 100;
  const leaks = allHandoffs['E']?.performance?.leaks_found || [];
  if (leaks.length > 0) perfSub -= 10 * leaks.length;
  const peakCpu = allHandoffs['E']?.performance?.cpu_peak_pct || 0;
  if (peakCpu > 30) perfSub -= 15;
  perfSub = Math.max(0, Math.min(100, perfSub));

  // UX subscore: average of scores * 10
  let uxSub = 100;
  const uxScores = allHandoffs['E']?.ux_scores || {};
  const uxDimensions = Object.values(uxScores) as Array<{ score: number }>;
  if (uxDimensions.length > 0) {
    const sum = uxDimensions.reduce((acc, d) => acc + d.score, 0);
    uxSub = Math.round((sum / uxDimensions.length) * 10);
  }

  // MV3 compliance subscore: 100 if passed, otherwise 0
  const mv3Sub = allHandoffs['E']?.mv3_compliance?.passed === true ? 100 : 0;

  const productionReady = score >= 90 && blockers.length === 0;
  const webStoreReady = productionReady && allHandoffs['E']?.mv3_compliance?.passed === true;

  const recommendedNextActions = [];
  if (productionReady) {
    recommendedNextActions.push("Deploy the SJA platform workspaces to production environment.");
  } else {
    recommendedNextActions.push("Resolve all remaining critical and high blockers.");
  }
  if (webStoreReady) {
    recommendedNextActions.push("Submit extension to the Chrome Web Store for review.");
  }

  return {
    overall_score: score,
    subscores: {
      stability: stabilitySub,
      security: securitySub,
      performance: perfSub,
      ux: uxSub,
      mv3_compliance: mv3Sub,
    },
    production_ready: productionReady,
    web_store_ready: webStoreReady,
    blockers,
    nice_to_have: niceToHave,
    recommended_next_actions: recommendedNextActions,
  };
}

if (require.main === module) {
  const HANDOFF_DIR = './handoffs';
  fs.mkdirSync(HANDOFF_DIR, { recursive: true });
  const PHASES = ['A', 'B', 'C', 'D', 'E'];
  const allHandoffs: Record<string, any> = {};
  for (const phase of PHASES) {
    const p = path.join(HANDOFF_DIR, `phase_${phase}.json`);
    if (fs.existsSync(p)) {
      allHandoffs[phase] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  }
  const score = computeFinalScore(allHandoffs);
  const report = buildReadinessReport(score, allHandoffs);
  fs.writeFileSync('./handoffs/FINAL_REPORT.json', JSON.stringify(report, null, 2));
  console.log(`Score calculated: ${score} / 100`);
  console.log(`Report written to ./handoffs/FINAL_REPORT.json`);
}
