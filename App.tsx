/**
 * Offload — On-Device Embedding & Vector Search App
 */

import React, {useState, useCallback, useEffect} from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';

import {
  downloadModel,
  runTextEmbedding,
  DownloadProgress,
} from './src/services/embedding';

import { 
  setupDatabase, 
  checkSqliteVec,
  insertItem,
  getAllItems,
  searchSimilarItems,
  deleteAllItems
} from './src/services/storage';

const RNFS = require('@dr.pogodin/react-native-fs');
const MODEL_FILENAME = 'nomic-text-quantized.onnx';

type ScreenState = 'home' | 'search' | 'settings';
type ProcessState = 'idle' | 'downloading' | 'loading' | 'running';

function App(): React.JSX.Element {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('home');
  const [processState, setProcessState] = useState<ProcessState>('idle');
  const [dbStatus, setDbStatus] = useState<string>('Not initialized');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Data States
  const [items, setItems] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Inputs
  const [inputText, setInputText] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  const loadItems = async () => {
    const data = await getAllItems();
    setItems(data);
  };

  useEffect(() => {
    setupDatabase()
      .then(async () => {
        const hasVec = await checkSqliteVec();
        setDbStatus(hasVec ? 'Ready (sqlite-vec available)' : 'Error (sqlite-vec missing)');
        loadItems();
      })
      .catch(err => {
        setDbStatus('Error: ' + err.message);
      });
  }, []);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  /**
   * Generates a simple ID
   */
  const generateId = () => Math.random().toString(36).substr(2, 9);

  /**
   * Helper to download/load the model and get embedding
   */
  const getEmbeddingForText = async (text: string) => {
    setProcessState('downloading');
    setLogs([]);
    setProgress(null);

    const modelPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
    
    const downloaded = await downloadModel(modelPath, (p) => setProgress(p));
    if (!downloaded) throw new Error('Model download failed');

    setProcessState('loading');
    addLog('Loading tokenizer & InferenceSession...');

    setProcessState('running');
    addLog('Running embedding inference...');

    const result = await runTextEmbedding(text, modelPath);
    if (!result.success || !result.vector) {
      throw new Error(result.error || 'Inference failed');
    }
    
    addLog(`✅ Inference complete in ${result.inferenceTimeMs}ms`);
    return result.vector;
  };

  /**
   * Save a new text item to the database
   */
  const handleSaveItem = async () => {
    if (!inputText.trim()) return;
    try {
      const vector = await getEmbeddingForText(inputText);
      
      const id = generateId();
      await insertItem(id, inputText, vector);
      addLog(`Saved item ${id} to database.`);
      
      setInputText('');
      setProcessState('idle');
      loadItems();
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setProcessState('idle');
    }
  };

  /**
   * Search similar items in the database
   */
  const handleSearch = async () => {
    if (!searchText.trim()) return;
    try {
      const vector = await getEmbeddingForText(searchText);
      addLog('Searching local vector database...');
      
      const results = await searchSimilarItems(vector, 5);
      setSearchResults(results);
      setProcessState('idle');
    } catch (err: any) {
      Alert.alert('Error', err.message);
      setProcessState('idle');
    }
  };

  /**
   * Delete all records
   */
  const handleDeleteAll = () => {
    Alert.alert(
      'Delete All Data',
      'Are you sure you want to delete all stored items and vectors?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAllItems();
              setItems([]);
              setSearchResults([]);
              addLog('All database records cleared.');
              Alert.alert('Success', 'All records deleted.');
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  const isBusy = processState !== 'idle';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0f" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Offload</Text>
        <Text style={styles.subtitle}>On-Device Semantic Sorter</Text>
        
        {/* Navigation Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setCurrentScreen('home')} style={[styles.tab, currentScreen === 'home' && styles.activeTab]}>
            <Text style={[styles.tabText, currentScreen === 'home' && styles.activeTabText]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen('search')} style={[styles.tab, currentScreen === 'search' && styles.activeTab]}>
            <Text style={[styles.tabText, currentScreen === 'search' && styles.activeTabText]}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setCurrentScreen('settings')} style={[styles.tab, currentScreen === 'settings' && styles.activeTab]}>
            <Text style={[styles.tabText, currentScreen === 'settings' && styles.activeTabText]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>

        {/* HOME SCREEN */}
        {currentScreen === 'home' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Add New Item</Text>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                multiline
                placeholder="Type a thought, quote, or note..."
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity style={[styles.actionBtn, isBusy && styles.btnDisabled]} onPress={handleSaveItem} disabled={isBusy}>
                <Text style={styles.actionBtnText}>{isBusy ? 'Processing...' : 'Embed & Save'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Saved Items ({items.length})</Text>
              {items.length === 0 ? (
                <Text style={styles.emptyText}>No items saved yet.</Text>
              ) : (
                items.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Text style={styles.itemPreview} numberOfLines={2}>{item.preview_text}</Text>
                    <Text style={styles.itemMeta}>Type: {item.content_type}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}

        {/* SEARCH SCREEN */}
        {currentScreen === 'search' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Semantic Vector Search</Text>
              <TextInput
                style={styles.textInput}
                value={searchText}
                onChangeText={setSearchText}
                placeholder="What are you looking for?"
                placeholderTextColor="#64748b"
              />
              <TouchableOpacity style={[styles.actionBtn, isBusy && styles.btnDisabled]} onPress={handleSearch} disabled={isBusy}>
                <Text style={styles.actionBtnText}>{isBusy ? 'Processing...' : 'Search Vector DB'}</Text>
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top Results (sqlite-vec)</Text>
                {searchResults.map((res, idx) => (
                  <View key={idx} style={styles.resultRow}>
                    <Text style={styles.itemPreview} numberOfLines={2}>{res.preview_text}</Text>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>Distance: {Number(res.distance).toFixed(4)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* SETTINGS SCREEN */}
        {currentScreen === 'settings' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>System Status</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Database</Text>
                <Text style={styles.infoValue}>{dbStatus}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Total Items</Text>
                <Text style={styles.infoValue}>{items.length}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Danger Zone</Text>
              <Text style={styles.infoLabel}>This will permanently delete all data from the local SQLite database.</Text>
              <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ef4444', marginTop: 15}]} onPress={handleDeleteAll}>
                <Text style={styles.actionBtnText}>Delete All Records</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* GLOBAL STATUS / LOGS (Shows when processing) */}
        {isBusy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AI Activity</Text>
            {processState === 'downloading' && progress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, {width: `${progress.percent}%`}]} />
                </View>
                <Text style={styles.progressText}>Downloading Model: {progress.percent}%</Text>
              </View>
            )}
            {(processState === 'loading' || processState === 'running') && (
              <ActivityIndicator size="small" color="#818cf8" style={styles.spinner} />
            )}
            {logs.map((log, i) => (
              <Text key={i} style={styles.logLine}>{log}</Text>
            ))}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { paddingTop: 56, paddingBottom: 0, backgroundColor: '#111118', borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  title: { fontSize: 24, fontWeight: '800', color: '#e2e8f0', paddingHorizontal: 24 },
  subtitle: { fontSize: 13, color: '#64748b', paddingHorizontal: 24, marginBottom: 16 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 12 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#818cf8' },
  tabText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  activeTabText: { color: '#818cf8' },
  content: { flex: 1 },
  contentInner: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#111118', borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e2e' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#818cf8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  textInput: { backgroundColor: '#1e1e2e', borderRadius: 8, color: '#e2e8f0', padding: 12, minHeight: 60, textAlignVertical: 'top', fontSize: 15, marginBottom: 12 },
  actionBtn: { backgroundColor: '#818cf8', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  itemRow: { borderBottomWidth: 1, borderBottomColor: '#1e1e2e', paddingVertical: 12 },
  itemPreview: { color: '#e2e8f0', fontSize: 15, lineHeight: 22 },
  itemMeta: { color: '#64748b', fontSize: 12, marginTop: 6, fontFamily: 'monospace' },
  emptyText: { color: '#64748b', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  resultRow: { borderBottomWidth: 1, borderBottomColor: '#1e1e2e', paddingVertical: 12 },
  scoreBadge: { backgroundColor: '#22543d', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginTop: 8 },
  scoreText: { color: '#4ade80', fontSize: 11, fontFamily: 'monospace', fontWeight: '700' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e2e' },
  infoLabel: { fontSize: 14, color: '#94a3b8', lineHeight: 20 },
  infoValue: { fontSize: 14, color: '#cbd5e1', fontFamily: 'monospace' },
  progressContainer: { marginVertical: 10 },
  progressBar: { height: 6, backgroundColor: '#1e1e2e', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#818cf8' },
  progressText: { fontSize: 11, color: '#64748b', marginTop: 6, fontFamily: 'monospace' },
  spinner: { marginVertical: 10 },
  logLine: { fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', lineHeight: 18, marginBottom: 2 },
});

export default App;
