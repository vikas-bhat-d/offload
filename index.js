/**
 * @format
 */

import 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
enableScreens();

import { AppRegistry } from 'react-native';
import 'fast-text-encoding';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
