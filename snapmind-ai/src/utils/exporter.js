import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';

export async function exportSession(history, format = 'markdown') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `snapmind-session-${timestamp}.md`;
  const exportDir = path.join(process.cwd(), 'snapmind_exports');
  
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
