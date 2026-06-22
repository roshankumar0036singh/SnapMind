/**
 * Assesses whether retrieved RAG context is sufficient for grounded answers.
 */

const DEFAULT_MAX_DISTANCE = 1.25;

export function assessRetrieval(results, options = {}) {
  const maxDistance = options.maxDistance ?? DEFAULT_MAX_DISTANCE;
  const minResults = options.minResults ?? 1;

  if (!results || results.length === 0) {
    return {
      ok: false,
      reason: 'No matching sources were found in the indexed knowledge base.',
      bestScore: Infinity,
    };
  }

  const scores = results.map((r) => r.score ?? Infinity);
  const bestScore = Math.min(...scores);

  if (results.length < minResults) {
    return {
      ok: false,
      reason: `Only ${results.length} source(s) found; need at least ${minResults}.`,
      bestScore,
    };
  }

  if (bestScore > maxDistance) {
    return {
      ok: false,
      reason: 'Retrieved sources are not sufficiently relevant to answer reliably.',
      bestScore,
    };
  }

  return { ok: true, reason: null, bestScore };
}

export function formatGroundingRefusal(reason) {
  return [
    'I cannot answer this from the indexed sources.',
    reason,
    'Try rephrasing, indexing more material, or disable strict grounding with `/grounding off`.',
  ].join(' ');
}
