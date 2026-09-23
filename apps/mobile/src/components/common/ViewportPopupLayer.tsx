import React from 'react';
import { UniversalModal } from './UniversalModal';

export interface ViewportPopupLayerProps {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
}

/**
 * 화면 전체 기준으로 띄우는 작은 팝업 레이어.
 * 네이티브(Android/iOS)는 기존 UniversalModal(네이티브 Modal)을 그대로 사용하며
 * Android 뒤로가기는 onRequestClose로 닫힌다. 웹 구현은 ViewportPopupLayer.web.tsx.
 */
export const ViewportPopupLayer: React.FC<ViewportPopupLayerProps> = ({ visible, onRequestClose, children }) => (
  <UniversalModal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose}>
    {children}
  </UniversalModal>
);
