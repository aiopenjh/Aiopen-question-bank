import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { colors } from '../../styles/designTokens';
import { MathBlock, MathTextNode, mayContainMathNotation, parseMathText } from '../../domain/math_notation';

export interface MathTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const DEFAULT_FONT_SIZE = 14;

function renderInlineNodes(nodes: MathTextNode[], baseFontSize: number, keyPrefix: string) {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.type === 'text') return <Text key={key}>{node.value}</Text>;
    const sizeStyle = { fontSize: Math.max(9, baseFontSize * 0.64) };
    return (
      <Text
        key={key}
        style={[sizeStyle, node.type === 'sup' ? { top: -baseFontSize * 0.32 } : { top: baseFontSize * 0.16 }]}
      >
        {node.value}
      </Text>
    );
  });
}

/**
 * 문제 지문/보기/해설/힌트에 섞인 \frac, \sqrt, ^, _, 그리스 문자 등 LaTeX 유사
 * 수식 표기를 외부 라이브러리 없이 RN View/Text 조합으로 렌더링한다.
 * (math_notation.ts 참고. 오프라인/CDN 불필요, Expo Web·Android·iOS 동일 코드.)
 *
 * 수식 구성이 전혀 없는 일반 문장은 기존과 동일하게 단일 <Text>로 렌더링해
 * numberOfLines 등 기존 동작을 그대로 보존한다.
 */
export const MathText: React.FC<MathTextProps> = ({ text, style, numberOfLines }) => {
  if (!text || !mayContainMathNotation(text)) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const flatStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const baseFontSize = typeof flatStyle?.fontSize === 'number' ? flatStyle.fontSize : DEFAULT_FONT_SIZE;
  const blocks = parseMathText(text);

  // \frac/\sqrt가 하나도 없다면(단순 기호·위아래첨자만) 굳이 줄바꿈 컨테이너를
  // 쓰지 않고 기존처럼 한 개의 <Text>로 렌더링해 레이아웃 변화를 최소화한다.
  const hasBlockLevelMath = blocks.some((b) => b.type === 'frac' || b.type === 'sqrt');
  if (!hasBlockLevelMath) {
    const runNodes = blocks.flatMap((b) => (b as { type: 'run'; nodes: MathTextNode[] }).nodes);
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {renderInlineNodes(runNodes, baseFontSize, 'run')}
      </Text>
    );
  }

  // 레이아웃 속성(flex, margin, width 등)이 style에 함께 들어올 수 있어 바깥 컨테이너에도
  // 그대로 적용한다. View가 이해하지 못하는 문자 스타일 키는 RN이 조용히 무시한다.
  return (
    <View style={[style as StyleProp<TextStyle>, styles.mathRow]}>
      {blocks.map((block, blockIdx) => renderBlock(block, baseFontSize, style, blockIdx))}
    </View>
  );
};

function renderBlock(block: MathBlock, baseFontSize: number, textStyle: StyleProp<TextStyle>, blockIdx: number) {
  const key = `block-${blockIdx}`;
  if (block.type === 'run') {
    return (
      <Text key={key} style={[textStyle, styles.mathRunItem]}>
        {renderInlineNodes(block.nodes, baseFontSize, key)}
      </Text>
    );
  }
  if (block.type === 'frac') {
    return (
      <View key={key} style={styles.fracContainer}>
        <Text style={[textStyle, styles.fracLine]}>{renderInlineNodes(block.numerator, baseFontSize, `${key}-num`)}</Text>
        <View style={[styles.fracDivider, { borderTopColor: (textStyle && (StyleSheet.flatten(textStyle) as TextStyle)?.color) || colors.ink }]} />
        <Text style={[textStyle, styles.fracLine]}>{renderInlineNodes(block.denominator, baseFontSize, `${key}-den`)}</Text>
      </View>
    );
  }
  // sqrt
  return (
    <View key={key} style={styles.sqrtRow}>
      <Text style={[textStyle, styles.sqrtGlyph]}>√</Text>
      <View style={styles.sqrtOverline}>
        <Text style={textStyle}>{renderInlineNodes(block.content, baseFontSize, `${key}-inner`)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mathRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  mathRunItem: {
    flexShrink: 1,
  },
  fracContainer: {
    alignItems: 'center',
    marginHorizontal: 3,
    marginVertical: 2,
  },
  fracLine: {
    paddingHorizontal: 2,
  },
  fracDivider: {
    borderTopWidth: 1.5,
    minWidth: 14,
    alignSelf: 'stretch',
    marginVertical: 1,
  },
  sqrtRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 2,
  },
  sqrtGlyph: {
    marginRight: 1,
  },
  sqrtOverline: {
    borderTopWidth: 1.5,
    paddingTop: 1,
    paddingHorizontal: 2,
  },
});
