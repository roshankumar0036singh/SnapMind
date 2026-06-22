import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import nodeCron from 'node-cron';

import { CACHE_DIR } from './constants.js';
import { generateNamespace, namespaceExists, retrieveContext, listNamespaces } from './vector_storage.js';
import config from './config.js';

const SCHEDULE_FILE = path.join(CACHE_DIR, 'schedules.json');
const REPORTS_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE,
  'snapmind_reports'
);

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

export async function addSchedule({ query, cron, persona, namespace, mount }) {
  if (!nodeCron.validate(cron)) {
    throw new Error(`Invalid cron expression: ${cron}`);
  }

  let resolvedNamespace = namespace;

  if (mount) {
    resolvedNamespace = generateNamespace(mount);
  }

  if (!resolvedNamespace || resolvedNamespace === 'default') {
    throw new Error('Provide --namespace for an indexed dataset or --mount for a source path.');
  }

  const mode = config.get('mode') || 'local';
  if (mode !== 'remote') {
    const exists = await namespaceExists(resolvedNamespace);
    if (!exists) {
      const available = await listNamespaces();
      throw new Error(
        `Namespace "${resolvedNamespace}" is not indexed. Available: ${available.length ? available.join(', ') : '(none)'}`
      );
    }
  }

  const schedules = await loadSchedules();
  const id = Date.now().toString(36);
  schedules.push({
    id,
    query,
    cron,
    persona: persona || 'scholar',
    namespace: resolvedNamespace,
    mount: mount || null,
    createdAt: new Date().toISOString(),
  });
  await saveSchedules(schedules);
  return id;
}

export async function removeSchedule(id) {
  const schedules = await loadSchedules();
  const updated = schedules.filter((s) => s.id !== id);
  await saveSchedules(updated);
  return schedules.length !== updated.length;
}

export async function runScheduledReport(schedule, { llm, embeddings, options = {} }) {
  const { query, id, persona, namespace } = schedule;

  console.log(chalk.cyan(`\n[Scheduler] Running report: "${query}" (id: ${id})`));

  try {
    const results = await retrieveContext(query, namespace, embeddings, 5, options);
    const context = results
      .map((r, i) => `[Source ${i + 1}]: ${r.pageContent}`)
      .join('\n\n---\n\n');

    const response = await llm.invoke([
      ['system', `You are SnapMind ${persona}. Generate a comprehensive intelligence report from the context below. Use markdown headers.`],
      ['user', `Context:\n${context}\n\nQuery: ${query}`],
    ]);

    await fs.ensureDir(REPORTS_DIR);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `report_${id}_${timestamp}.md`;
    const reportPath = path.join(REPORTS_DIR, filename);
    await fs.writeFile(
      reportPath,
      `# SnapMind Intelligence Report\n**Query:** ${query}\n**Date:** ${timestamp}\n\n---\n\n${response.content}`
    );

    console.log(chalk.green(`\n[Scheduler] Report saved: ${reportPath}`));
    return reportPath;
  } catch (e) {
    console.error(chalk.red(`[Scheduler] Report failed: ${e.message}`));
    return null;
  }
}

export async function startScheduler(options = {}) {
  const { getLLM, getEmbeddings } = await import('./llm.js');

  const schedules = await loadSchedules();
  if (schedules.length === 0) {
    console.log(chalk.gray('[Scheduler] No schedules defined. Use: snapmind-ai schedule add'));
    return;
  }

  console.log(chalk.bold.cyan(`\nSnapMind Scheduler — ${schedules.length} active reports\n`));

  for (const schedule of schedules) {
    console.log(chalk.gray(` [${schedule.id}] "${schedule.query}" @ ${schedule.cron} (ns: ${schedule.namespace})`));

    if (!nodeCron.validate(schedule.cron)) {
      console.log(chalk.red(`  Invalid cron expression: ${schedule.cron}`));
      continue;
    }

    nodeCron.schedule(schedule.cron, async () => {
      const llm = await getLLM(options);
      const embeddings = await getEmbeddings(options);
      await runScheduledReport(schedule, { llm, embeddings, options });
    });
  }

  console.log(chalk.green('\nScheduler running. Press Ctrl+C to exit.'));
  await new Promise(() => {});
}
