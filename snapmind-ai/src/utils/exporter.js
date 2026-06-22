import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import { EXPORT_DIR } from './paths.js';

export async function exportSession(history, format = 'markdown') {
  if (!history || history.length === 0) {
    console.log(chalk.yellow('\nNo session history to export.\n'));
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `snapmind-session-${timestamp}.md`;
  const exportDir = EXPORT_DIR;
  
  await fs.ensureDir(exportDir);
  const filePath = path.join(exportDir, fileName);

  let content = `# SnapMind AI Session Export\nDate: ${new Date().toLocaleString()}\n\n`;
  
  history.forEach(item => {
    const role = item.role === 'user' ? '### 👤 You' : '### 🤖 SnapMind';
    content += `${role}\n${item.content}\n\n`;
  });

  await fs.writeFile(filePath, content);
  console.log(chalk.green(`\n✅ Session exported to: ${filePath}\n`));
}
