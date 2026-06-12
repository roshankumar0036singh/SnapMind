import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

import { CACHE_DIR } from './constants.js';

const SCHEDULE_FILE = path.join(CACHE_DIR, 'schedules.json');
const REPORTS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'snapmind_reports'
);

// ──────────────────────────────────────────────
// Schedule Persistence
// ──────────────────────────────────────────────

export async function loadSchedules() {
  await fs.ensureFile(SCHEDULE_FILE);
  try {
    return await fs.readJson(SCHEDULE_FILE);
  } catch {
    return [];
  }
}

export async function saveSchedules(schedules) {
  await fs.ensureDir(CACHE_DIR);
  await fs.writeJson(SCHEDULE_FILE, schedules, { spaces: 2 });
}

export async function addSchedule({ query, cron, persona, namespace }) {
  const schedules = await loadSchedules();
  const id = Date.now().toString(36);
  schedules.push({ id, query, cron, persona: persona || 'scholar', namespace: namespace || 'default', createdAt: new Date().toISOString() });
  await saveSchedules(schedules);
  return id;
}

export async function removeSchedule(id) {
  const schedules = await loadSchedules();
  const updated = schedules.filter(s => s.id !== id);
  await saveSchedules(updated);
  return schedules.length !== updated.length;
}

// ──────────────────────────────────────────────
// Report Runner
// ──────────────────────────────────────────────

/**
 * Runs a scheduled RAG query and saves the result as a markdown report.
 * @param {object} schedule - { id, query, persona, namespace }
 * @param {object} options - { llm, vectorStore }
 */
export async function runScheduledReport(schedule, { llm, vectorStore }) {
  const { query, id, persona } = schedule;

  console.log(chalk.cyan(`\n[Scheduler] Running report: "${query}" (id: ${id})`));

  try {
    const results = await vectorStore.similaritySearch(query, 5);
    const context = results
      .map((r, i) => `[Source ${i + 1}]: ${r.pageContent}`)
      .join('\n\n---\n\n');

    const response = await llm.invoke([
      ['system', `You are SnapMind ${persona}. Generate a comprehensive intelligence report from the context below. Use markdown headers.`],
      ['user', `Context:\n${context}\n\nQuery: ${query}`],
    ]);

    const fullReport = response.content;

    // Save to ~/snapmind_reports/
    await fs.ensureDir(REPORTS_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `report_${id}_${timestamp}.md`;
    const reportPath = path.join(REPORTS_DIR, filename);
    await fs.writeFile(reportPath, `# SnapMind Intelligence Report\n**Query:** ${query}\n**Date:** ${timestamp}\n\n---\n\n${fullReport}`);

    console.log(chalk.green(`\n[Scheduler] Report saved: ${reportPath}`));
    return reportPath;
  } catch (e) {
    console.error(chalk.red(`[Scheduler] Report failed: ${e.message}`));
    return null;
  }
}

/**
 * Starts the cron scheduler. Registers all saved schedules using node-cron.
 */
export async function startScheduler(options = {}) {
  let cron;
  try {
    cron = (await import('node-cron')).default;
  } catch {
    console.log(chalk.yellow('[Scheduler] node-cron not installed. Run: npm install node-cron'));
    return;
  }

  const { getLLM, getEmbeddings } = await import('./llm.js');
  const { getVectorStore } = await import('./vector_storage.js');

  const schedules = await loadSchedules();
  if (schedules.length === 0) {
    console.log(chalk.gray('[Scheduler] No schedules defined. Use: snapmind-ai schedule add'));
    return;
  }

  console.log(chalk.bold.cyan(`\nSnapMind Scheduler — ${schedules.length} active reports\n`));

  for (const schedule of schedules) {
    console.log(chalk.gray(` [${schedule.id}] "${schedule.query}" @ ${schedule.cron}`));

    if (!cron.validate(schedule.cron)) {
      console.log(chalk.red(`  Invalid cron expression: ${schedule.cron}`));
      continue;
    }

    cron.schedule(schedule.cron, async () => {
      const llm = await getLLM(options);
      const embeddings = await getEmbeddings(options);
      const vectorStore = await getVectorStore(schedule.namespace, embeddings);
      await runScheduledReport(schedule, { llm, vectorStore });
    });
  }

  console.log(chalk.green('\nScheduler running. Press Ctrl+C to exit.'));
  // Keep process alive
  await new Promise(() => {});
}
