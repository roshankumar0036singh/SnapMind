import chalk from 'chalk';

/**
 * Streams a LangChain LLM session to the terminal.
 * @param {AsyncIterable} stream - The stream object from llm.stream()
 * @param {string} color - The chalk color to use for the output
 * @returns {Promise<string>} - The full accumulated response
 */
export async function streamToTerminal(stream, color = 'cyan') {
  let fullText = '';
  process.stdout.write('\n'); // Start on a new line
  
  for await (const chunk of stream) {
    const content = chunk.content || chunk; // Handle both message objects and strings
    if (content) {
      process.stdout.write(chalk[color](content));
      fullText += content;
    }
  }
  
  process.stdout.write('\n\n'); // End with double line break
  return fullText;
}
