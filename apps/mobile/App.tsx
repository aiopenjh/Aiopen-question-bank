import React from 'react';
import { LogBox } from 'react-native';
import { AppView } from './src/components/AppView';
import { useAppController } from './src/hooks/useAppController';

LogBox.ignoreAllLogs(true);

export default function App() {
  const controller = useAppController();
  return <AppView controller={controller} />;
}
