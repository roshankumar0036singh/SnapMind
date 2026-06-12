import chalk from 'chalk';
import ora from 'ora';
import { getLLM } from '../utils/llm.js';
import { streamToTerminal } from '../utils/streamer.js';
import inquirer from 'inquirer';

// We need system prompts for the agents
const agentPrompts = {
  scholar: 'You are SnapMind Scholar. You excel at research, academic writing, and breaking down complex topics.',
  coder: 'You are SnapMind Coder. You excel at writing robust, clean, and efficient code.',
  analyst: 'You are SnapMind Analyst. You excel at data structures, trends, and extracting structured information.',
  writer: 'You are SnapMind Writer. You excel at synthesizing information into clear, readable documentation or articles.'
};

async function generatePlan(query, llm) {
  const spinner = ora('Orchestrating collaboration plan...').start();
  try {
    const prompt = `You are the SnapMind Orchestrator. 
The user has requested a complex task: "${query}"

Break this task down into a sequential pipeline of sub-tasks.
Assign each sub-task to one of the following personas:
- "scholar" (for research/planning)
- "coder" (for writing code/scripts)
- "analyst" (for data/structuring)
- "writer" (for documentation/synthesis)

Output ONLY a valid JSON array of objects, where each object has:
- "persona": The persona name (exact lowercase).
- "task": The specific instruction for that persona.

Ensure the output is parseable JSON without markdown backticks.`;

    const response = await llm.invoke([['user', prompt]]);
    spinner.stop();
    
    // Parse JSON
    let text = response.content.trim();
    if (text.startsWith('```json')) {
      text = text.replace(/```json/g, '').replace(/```/g, '');
    }
    const plan = JSON.parse(text);
    return plan;
  } catch (e) {
    spinner.fail('Failed to generate collaboration plan.');
    console.error(chalk.red(e.message));
    return null;
  }
}

export async function runCollaboration(query, options) {
  console.log(chalk.bold.magenta('\n🤝 Multi-Agent Collaboration Initiated'));
  console.log(chalk.gray(`Goal: "${query}"\n`));

  const llm = await getLLM(options);
  const plan = await generatePlan(query, llm);

  if (!plan || plan.length === 0) {
    console.log(chalk.red('Collaboration aborted.'));
    return { target: null, history: options.history };
  }

  console.log(chalk.cyan('📋 Orchestrator Plan:'));
  plan.forEach((step, i) => {
    console.log(chalk.white(`  ${i + 1}. [${chalk.bold(step.persona.toUpperCase())}]`) + chalk.gray(` ${step.task}`));
  });
  console.log('');

  let sharedContext = `Original User Goal: ${query}\n\n`;

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    console.log(chalk.bold.yellow(`\n🚀 Executing Step ${i + 1}: ${step.persona.toUpperCase()}`));
    console.log(chalk.gray(`Task: ${step.task}\n`));

    const systemPrompt = agentPrompts[step.persona] || 'You are a helpful AI assistant.';
    
    const messages = [
      ['system', `${systemPrompt}\n\nYou are part of a multi-agent collaboration pipeline. You will be given the shared context from previous steps, and your specific task for this step. Do not apologize or converse, just execute your task and output the result.`],
      ['user', `Shared Context:\n${sharedContext}\n\nYour Specific Task: ${step.task}`]
    ];

    try {
      const stream = await llm.stream(messages);
      const output = await streamToTerminal(stream, 'cyan');
      
      sharedContext += `\n--- Output from ${step.persona} ---\n${output}\n`;
      
      // Human-in-the-loop: ask if they want to proceed if it's not the last step
      if (i < plan.length - 1) {
        const { proceed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: `Step ${i + 1} complete. Proceed to next step (${plan[i+1].persona.toUpperCase()})?`,
            default: true
          }
        ]);
        if (!proceed) {
           console.log(chalk.yellow('\nCollaboration halted by user.'));
           break;
        }
      }
    } catch (e) {
      console.error(chalk.red(`\nError during ${step.persona}'s execution: ${e.message}`));
      break;
    }
  }

  console.log(chalk.bold.green('\n✅ Collaboration Complete!'));
  
  // Save to history so the user can continue talking about it
  let history = options.history || [];
  history.push({ role: 'user', content: `/collaborate ${query}` });
  history.push({ role: 'assistant', content: `Collaboration pipeline executed successfully.\n\nFinal Output Context:\n${sharedContext.substring(0, 1000)}...` });

  return { target: null, history };
}
