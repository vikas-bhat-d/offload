/**
 * Offload — On-Device AI Sorting App
 *
 * Root component. Wraps everything with:
 * - AppProvider (global state: DB, models)
 * - AppNavigator (conditional routing)
 * - ToastProvider (notification overlay)
 */

import React from 'react';
import { AppProvider } from './src/context/AppContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ToastProvider } from './src/components/Toast';

function App(): React.JSX.Element {
  return (
    <AppProvider>
      <AppNavigator />
      <ToastProvider />
    </AppProvider>
  );
}

export default App;
