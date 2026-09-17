import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { QuestionRevision } from '../../contracts/types';

type Props = {
  reference?: QuestionRevision['currentReference'];
};

export const CurrentReferenceNotice: React.FC<Props> = ({ reference }) => {
  if (!reference) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>최신 공식 근거 · {reference.referenceDate} 기준</Text>
      <Text style={styles.status}>현재 시행 중인 자료로 출제되었습니다.</Text>
      <TouchableOpacity onPress={() => void Linking.openURL(reference.sourceUrl)} activeOpacity={0.75}>
        <Text style={styles.link}>{reference.sourceAgency} · {reference.sourceTitle} ↗</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F4F8F6',
    borderWidth: 1,
    borderColor: '#CFE2D8',
  },
  title: { fontSize: 12, fontWeight: '800', color: '#315C49' },
  status: { marginTop: 3, fontSize: 11, color: '#52645B' },
  link: { marginTop: 6, fontSize: 11, fontWeight: '700', color: '#296B52', textDecorationLine: 'underline' },
});
