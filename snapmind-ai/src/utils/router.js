import chalk from 'chalk';

/**
 * Routes a request to the appropriate model based on complexity.
 * @param {string} prompt - The user prompt
 * @param {Object} options - CLI options
 * @returns {string} - The selected model name
 */
export function routeModel(prompt, options = {}) {
  // If user explicitly chose a model, respect it
  if (options.model) return options.model;

  const complexityScore = calculateComplexity(prompt);
  
  // Logic: 
  // - Short/Simple -> gpt-4o-mini (fast/cheap)
  // - Long/Complex -> gpt-4o (powerful)
  
  if (complexityScore > 15 || prompt.length > 500) {
    if (!options.silent) {
       console.log(chalk.gray('  [Router] Routing to powerful model (High Complexity)'));
    }
    return 'gpt-4o';
  }

  if (!options.silent) {
    console.log(chalk.gray('  [Router] Routing to fast model (Low Complexity)'));
  }
  return 'gpt-4o-mini';
}

function calculateComplexity(prompt) {
  let score = 0;
  
  // Complexity markers
  const complexKeywords = [
    'refactor', 'architect', 'summarize this entire', 'analyze the relationship',
    'complex', 'optimize', 'debug', 'trace', 'comprehensive'
  ];

  complexKeywords.forEach(word => {
    if (prompt.toLowerCase().includes(word)) score += 5;
  });

  // Question marks often imply reasoning
  const questionCount = (prompt.match(/\?/g) || []).length;
  score += questionCount * 2;

  return score;
}
