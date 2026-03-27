import asciichart from 'asciichart';
import chalk from 'chalk';

/**
 * Renders an ASCII line chart for a set of data points.
 * @param {Array<number>} data - The data points to chart
 * @param {Object} options - Chart options (label, height, padding)
 */
export function renderLineChart(data, options = {}) {
  const config = {
    height: options.height || 10,
    colors: [options.color === 'green' ? asciichart.green : asciichart.cyan]
  };

  console.log(chalk.bold(`\n📈 ${options.label || 'Data Trend'}`));
  console.log(asciichart.plot(data, config));
  console.log('');
}

/**
 * Renders a simple ASCII bar chart.
 * @param {Object} dataMap - Key-value pairs for bars
 */
export function renderBarChart(dataMap) {
  const keys = Object.keys(dataMap);
  const maxVal = Math.max(...Object.values(dataMap));
  const scale = 40 / maxVal;

  console.log(chalk.bold('\n📊 Distribution Analysis'));
  keys.forEach(key => {
    const bars = '█'.repeat(Math.round(dataMap[key] * scale));
    console.log(`${key.padEnd(20)} | ${bars} ${dataMap[key]}`);
  });
  console.log('');
}
