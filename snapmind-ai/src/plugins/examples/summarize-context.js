export default {
  name: 'summarize',
  description: 'Summarize retrieved context (/summarize-context [query])',
  async execute({ vectorStore, llm, args, streamToTerminal }) {
    const query = args || 'key points overview';
    const results = await vectorStore.similaritySearch(query, 8);
    const context = results.map((r) => r.pageContent).join('\n---\n');
    const stream = await llm.stream([
      ['system', 'Summarize the following retrieved context in 3-5 bullet points.'],
      ['user', context],
    ]);
    await streamToTerminal(stream, 'cyan');
  },
};
