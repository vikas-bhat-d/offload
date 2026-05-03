/**
 * Offload — On-Device Embedding Test App
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
  TextInput,
} from 'react-native';

import {
  downloadModel,
  runTextEmbedding,
  DownloadProgress,
  EmbeddingResult,
} from './src/services/embedding';

import { setupDatabase, checkSqliteVec } from './src/services/storage';

const RNFS = require('@dr.pogodin/react-native-fs');
const MODEL_FILENAME = 'nomic-text-quantized.onnx';

type AppState = 'idle' | 'downloading' | 'loading' | 'running' | 'done' | 'error';

function App(): React.JSX.Element {
  const [state, setState] = useState<AppState>('idle');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const [inputText, setInputText] = useState<string>('Hello world, this is a test of local embeddings!');
  const [dbStatus, setDbStatus] = useState<string>('Not initialized');

  React.useEffect(() => {
    // Initialize DB on start
    setupDatabase()
      .then(async () => {
        const hasVec = await checkSqliteVec();
        setDbStatus(hasVec ? 'Ready (sqlite-vec available)' : 'Ready (sqlite-vec missing)');
      })
      .catch(err => {
        setDbStatus('Error: ' + err.message);
      });
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runTest = useCallback(async () => {
    try {
      if (!inputText.trim()) {
        throw new Error('Please enter some text to embed');
      }

      setState('downloading');
      setResult(null);
      setErrorMsg('');
      setLogs([]);
      setProgress(null);

      const modelPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
      addLog('Starting model download...');

      const downloaded = await downloadModel(modelPath, (p) => {
        setProgress(p);
      });

      if (!downloaded) {
        throw new Error('Model download failed');
      }
      addLog('✅ Model downloaded successfully');

      setState('loading');
      addLog('Loading tokenizer & InferenceSession...');

      setState('running');
      addLog('Running embedding inference...');

      const embeddingResult = await runTextEmbedding(inputText, modelPath);

      if (embeddingResult.success) {
        setState('done');
        setResult(embeddingResult);
        addLog(`✅ Inference complete in ${embeddingResult.inferenceTimeMs}ms`);
        addLog(`Embedding dim: ${embeddingResult.embeddingDim}`);
      } else {
        throw new Error(embeddingResult.error || 'Inference failed');
      }
    } catch (err: any) {
      setState('error');
      const msg = err?.message || String(err);
      setErrorMsg(msg);
      addLog(`❌ Error: ${msg}`);
    }
  }, [addLog, inputText]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Offload</Text>
        <Text style={styles.subtitle}>Nomic Text Embedding & SQLite Vec</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}>

        {/* Database Status */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Database Status</Text>
          <Text style={styles.infoValue}>{dbStatus}</Text>
        </View>

        {/* Input */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Input Text</Text>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            multiline
            placeholder="Type something to embed..."
            placeholderTextColor="#64748b"
          />
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status</Text>
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
              {state === 'loading' && 'Loading model/tokenizer...'}
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

        {/* Log Console */}
        {logs.length > 0 && (
          <View style={[styles.card, styles.logCard]}>
            <Text style={styles.cardTitle}>Console</Text>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>{log}</Text>
            ))}
          </View>
        )}
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
            {state === 'idle' ? '🚀 Run Embedding' :
             state === 'done' ? '🔄 Run Again' :
             state === 'error' ? '🔄 Retry' :
             '⏳ Running...'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  title: { fontSize: 28, fontWeight: '800', color: '#e2e8f0', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4, fontFamily: 'monospace' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#111118', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1e1e2e' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  textInput: { backgroundColor: '#1e1e2e', borderRadius: 8, color: '#e2e8f0', padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  statusText: { fontSize: 16, color: '#e2e8f0', fontWeight: '600' },
  progressContainer: { marginTop: 16 },
  progressBar: { height: 8, backgroundColor: '#1e1e2e', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#818cf8', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#64748b', marginTop: 8, fontFamily: 'monospace' },
  spinner: { marginTop: 16 },
  resultCard: { borderColor: '#22543d' },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  resultLabel: { fontSize: 14, color: '#94a3b8' },
  resultValue: { fontSize: 16, color: '#4ade80', fontWeight: '700', fontFamily: 'monospace' },
  resultValueSmall: { fontSize: 11, color: '#4ade80', fontFamily: 'monospace', maxWidth: '60%', textAlign: 'right' },
  errorCard: { borderColor: '#7f1d1d' },
  errorTitle: { fontSize: 14, fontWeight: '700', color: '#f87171', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  errorText: { fontSize: 13, color: '#fca5a5', fontFamily: 'monospace', lineHeight: 20 },
  logCard: { borderColor: '#1e293b' },
  logLine: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 18, marginBottom: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, color: '#cbd5e1', fontFamily: 'monospace' },
  buttonContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 32, backgroundColor: '#0a0a0f', borderTopWidth: 1, borderTopColor: '#1e1e2e', flexDirection: 'row', gap: 10 },
  button: { flex: 1, backgroundColor: '#818cf8', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#334155', opacity: 0.6 },
  buttonText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});

export default App;
