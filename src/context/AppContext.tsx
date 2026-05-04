/**
 * Offload — AppContext
 *
 * Global app state: model readiness, DB initialization status.
 * Wraps the app and provides context to all screens.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { modelManager } from '../services/modelManager';
import { setupDatabase, checkSqliteVec } from '../services/storage';

// ─── Types ───────────────────────────────────────────

interface AppState {
  /** Whether the database has been initialized */
  dbReady: boolean;
  /** Whether sqlite-vec extension is available */
  vecAvailable: boolean;
  /** Whether the required embedding model is ready */
  embeddingReady: boolean;
  /** Whether the optional LLM model is ready */
  llmReady: boolean;
  /** Whether initial app loading is complete */
  appInitialized: boolean;
  /** Any initialization error */
  initError?: string;
  /** Re-check model statuses */
  refreshModelStatus: () => Promise<void>;
}

const defaultState: AppState = {
  dbReady: false,
  vecAvailable: false,
  embeddingReady: false,
  llmReady: false,
  appInitialized: false,
  refreshModelStatus: async () => {},
};

const AppContext = createContext<AppState>(defaultState);

// ─── Provider ────────────────────────────────────────

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [dbReady, setDbReady] = useState(false);
  const [vecAvailable, setVecAvailable] = useState(false);
  const [embeddingReady, setEmbeddingReady] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [appInitialized, setAppInitialized] = useState(false);
  const [initError, setInitError] = useState<string | undefined>();

  const refreshModelStatus = useCallback(async () => {
    await modelManager.initialize();
    setEmbeddingReady(modelManager.isReady('nomic-embed-text'));
    setLlmReady(modelManager.isReady('qwen-0.5b'));
  }, []);

  // Initialize everything on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // 1. Initialize database
        await setupDatabase();
        if (cancelled) return;
        setDbReady(true);

        // 2. Check sqlite-vec
        const hasVec = await checkSqliteVec();
        if (cancelled) return;
        setVecAvailable(hasVec);

        // 3. Check model files on disk
        await modelManager.initialize();
        if (cancelled) return;
        setEmbeddingReady(modelManager.isReady('nomic-embed-text'));
        setLlmReady(modelManager.isReady('qwen-0.5b'));

        // Done
        setAppInitialized(true);
      } catch (err: any) {
        if (!cancelled) {
          setInitError(err?.message || 'Failed to initialize app');
          setAppInitialized(true); // still mark initialized so we can show error
        }
      }
    }

    init();

    // Subscribe to model status changes
    const unsubscribe = modelManager.subscribe((id) => {
      if (id === 'nomic-embed-text') {
        setEmbeddingReady(modelManager.isReady('nomic-embed-text'));
      } else if (id === 'qwen-0.5b') {
        setLlmReady(modelManager.isReady('qwen-0.5b'));
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        dbReady,
        vecAvailable,
        embeddingReady,
        llmReady,
        appInitialized,
        initError,
        refreshModelStatus,
      }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────

export function useAppContext(): AppState {
  return useContext(AppContext);
}
