/**
 * Programmatic API for embedding SnapMind AI in other Node.js applications.
 *
 * @example
 * import { getLLM, retrieveContext, resolveNamespace } from 'snapmind-ai/api';
 */

export { getLLM, getEmbeddings, buildCliOptions, detectPersona } from './utils/llm.js';
export {
  getVectorStore,
  globalSearch,
  generateNamespace,
  legacyNamespace,
  resolveNamespace,
  retrieveContext,
  personaSearch,
  listNamespaces,
  namespaceExists,
  sortSearchResults,
} from './utils/vector_storage.js';
export { getIndexStats, clearNamespace, clearAllNamespaces } from './utils/index_manager.js';
export { loadSession, saveSession, loadSessionForPath, listSnapshots } from './utils/session.js';
export { loadAnalystDocuments, loadAnalystFile, isAnalystDataFile, ANALYST_EXTENSIONS } from './utils/data_loaders.js';
export { exportSession } from './utils/exporter.js';
export { SnapMindError, handleError } from './utils/errors.js';
export { default as config } from './utils/config.js';
export { apiClient } from './utils/api_client.js';
export { CACHE_DIR, LANCE_DIR, SESSION_DIR, EXPORT_DIR } from './utils/paths.js';

export { startScholar } from './personas/scholar.js';
export { startCoder } from './personas/coder.js';
export { startAnalyst } from './personas/analyst.js';
export { startWriter } from './personas/writer.js';
export { startCustomPersona } from './personas/custom_runner.js';
export { runCollaboration } from './personas/orchestrator.js';

export { savePersona, loadPersona, listCustomPersonas, deletePersona } from './utils/persona_store.js';
export { addSchedule, loadSchedules, removeSchedule, runScheduledReport, startScheduler } from './utils/scheduler.js';
export { ingestSource, INGEST_TYPES } from './utils/ingest.js';
export { trimHistory, buildMessages } from './utils/memory.js';
export { assessRetrieval, formatGroundingRefusal } from './utils/grounding.js';
export { syncRepoIndex, getRepoChanges, indexCodeFile } from './utils/repo_sync.js';
export { listCatalogPlugins, installCatalogPlugin, searchCatalogPlugins } from './utils/plugin_registry.js';
