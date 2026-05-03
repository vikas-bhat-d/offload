/**
 * Offload — On-Device Embedding Test App
 *
 * This app tests ONNX Runtime React Native on Android by:
 * 1. Downloading a small quantized ONNX model (~23MB)
 * 2. Creating an ONNX InferenceSession
 * 3. Running dummy embedding inference
 * 4. Displaying the results
 */

import React, {useState, useCallback} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import {
  downloadModel,
  runEmbeddingTest,
  DownloadProgress,
  EmbeddingResult,
} from './src/services/embedding';

// Use @dr.pogodin/react-native-fs DocumentDirectoryPath for model storage
const RNFS = require('@dr.pogodin/react-native-fs');
const MODEL_FILENAME = 'model_quantized.onnx';

type AppState = 'idle' | 'downloading' | 'loading' | 'running' | 'done' | 'error';

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runTest = useCallback(async () => {
    try {
      setState('downloading');
      setResult(null);
      setErrorMsg('');
      setLogs([]);
      setProgress(null);

      const modelPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
      addLog('Starting model download...');
      addLog(`Destination: ${modelPath}`);

      const downloaded = await downloadModel(modelPath, (p) => {
        setProgress(p);
      });

      if (!downloaded) {
        throw new Error('Model download failed');
      }
      addLog('✅ Model downloaded successfully');

      setState('loading');
      addLog('Creating ONNX InferenceSession...');

      setState('running');
      addLog('Running embedding inference...');

      const embeddingResult = await runEmbeddingTest(modelPath);

      if (embeddingResult.success) {
        setState('done');
        setResult(embeddingResult);
        addLog(`✅ Inference complete in ${embeddingResult.inferenceTimeMs}ms`);
        addLog(`Embedding dim: ${embeddingResult.embeddingDim}`);
        addLog(`Sample values: [${embeddingResult.sampleValues.map(v => v.toFixed(4)).join(', ')}]`);
      } else {
        throw new Error(embeddingResult.error || 'Inference failed');
      }
    } catch (err: any) {
      setState('error');
      const msg = err?.message || String(err);
      setErrorMsg(msg);
      addLog(`❌ Error: ${msg}`);
    }
  }, [addLog]);

  const deleteModel = useCallback(async () => {
    try {
      const modelPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
      const exists = await RNFS.exists(modelPath);
      if (exists) {
        await RNFS.unlink(modelPath);
        addLog('🗑️ Model file deleted');
      } else {
        addLog('No model file to delete');
      }
      setState('idle');
      setResult(null);
      setProgress(null);
    } catch (err: any) {
      addLog(`❌ Delete error: ${err?.message}`);
    }
  }, [addLog]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Offload</Text>
        <Text style={styles.subtitle}>On-Device Embedding Test</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ONNX Runtime Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor:
                state === 'done' ? '#4ade80' :
                state === 'error' ? '#f87171' :
                state === 'idle' ? '#6b7280' :
                '#facc15',
            }]} />
            <Text style={styles.statusText}>
              {state === 'idle' && 'Ready to test'}
              {state === 'downloading' && 'Downloading model...'}
              {state === 'loading' && 'Loading ONNX session...'}
              {state === 'running' && 'Running inference...'}
              {state === 'done' && 'Test passed ✓'}
              {state === 'error' && 'Test failed ✗'}
            </Text>
          </View>

          {/* Download Progress */}
          {state === 'downloading' && progress && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, {width: `${progress.percent}%`}]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress.percent}% — {(progress.bytesWritten / 1024 / 1024).toFixed(1)} / {(progress.contentLength / 1024 / 1024).toFixed(1)} MB
              </Text>
            </View>
          )}

          {/* Loading Spinner */}
          {(state === 'loading' || state === 'running') && (
            <ActivityIndicator
              size="large"
              color="#818cf8"
              style={styles.spinner}
            />
          )}
        </View>

        {/* Results Card */}
        {result && (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.cardTitle}>Embedding Results</Text>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Dimensions</Text>
              <Text style={styles.resultValue}>{result.embeddingDim}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Inference Time</Text>
              <Text style={styles.resultValue}>{result.inferenceTimeMs}ms</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Sample Values</Text>
              <Text style={styles.resultValueSmall}>
                [{result.sampleValues.map(v => v.toFixed(4)).join(', ')}]
              </Text>
            </View>
          </View>
        )}

        {/* Error Card */}
        {state === 'error' && errorMsg && (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>Error Details</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Log Console */}
        {logs.length > 0 && (
          <View style={[styles.card, styles.logCard]}>
            <Text style={styles.cardTitle}>Console</Text>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>{log}</Text>
            ))}
          </View>
        )}

        {/* Test Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Test Configuration</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>all-MiniLM-L6-v2 (quantized)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Size</Text>
            <Text style={styles.infoValue}>~23 MB</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Runtime</Text>
            <Text style={styles.infoValue}>ONNX Runtime React Native</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Provider</Text>
            <Text style={styles.infoValue}>CPU</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Purpose</Text>
            <Text style={styles.infoValue}>Validate embedding pipeline</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            (state === 'downloading' || state === 'loading' || state === 'running') &&
              styles.buttonDisabled,
          ]}
          onPress={runTest}
          disabled={state === 'downloading' || state === 'loading' || state === 'running'}>
          <Text style={styles.buttonText}>
            {state === 'idle' ? '🚀 Run Embedding Test' :
             state === 'done' ? '🔄 Run Again' :
             state === 'error' ? '🔄 Retry' :
             '⏳ Running...'}
          </Text>
        </TouchableOpacity>

        {(state === 'done' || state === 'error') && (
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={deleteModel}>
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
              🗑️ Delete Model
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#111118',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#e2e8f0',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    fontFamily: 'monospace',
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#111118',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e1e2e',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#818cf8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    color: '#e2e8f0',
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#1e1e2e',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#818cf8',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  spinner: {
    marginTop: 16,
  },
  resultCard: {
    borderColor: '#22543d',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  resultLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  resultValue: {
    fontSize: 16,
    color: '#4ade80',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  resultValueSmall: {
    fontSize: 11,
    color: '#4ade80',
    fontFamily: 'monospace',
    maxWidth: '60%',
    textAlign: 'right',
  },
  errorCard: {
    borderColor: '#7f1d1d',
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f87171',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#fca5a5',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  logCard: {
    borderColor: '#1e293b',
  },
  logLine: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
    lineHeight: 18,
    marginBottom: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2e',
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 13,
    color: '#cbd5e1',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: '#1e1e2e',
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#818cf8',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    flex: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonTextSecondary: {
    color: '#94a3b8',
  },
});

export default App;
