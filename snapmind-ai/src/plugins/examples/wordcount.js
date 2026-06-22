export default {
  name: 'wordcount',
  description: 'Count words in retrieved context (/wordcount)',
  async execute({ vectorStore, args, streamToTerminal }) {
    const query = args || 'overview summary content';
    const results = await vectorStore.similaritySearch(query, 5);
    const text = results.map((r) => r.pageContent).join('\n');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    await streamToTerminal(
      (async function* () {
        yield { content: `Word count across top ${results.length} snippets: ${words}` };
      })(),
      'cyan'
    );
  },
};
