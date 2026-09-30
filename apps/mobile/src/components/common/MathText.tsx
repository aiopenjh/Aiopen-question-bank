import React from 'react';
import { Platform, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { colors, radius } from '../../styles/designTokens';
import { MathBlock, MathTextNode, mayContainMathNotation, parseMathText } from '../../domain/math_notation';
import { hasCodeBlock, splitCodeBlocks } from '../../domain/code_block';

export interface MathTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

const DEFAULT_FONT_SIZE = 14;
// 중첩된 분수/제곱근 안쪽 글자는 교재처럼 살짝 작게 표시한다(무한히 작아지지 않도록 하한 유지).
const NESTED_SHRINK = 0.86;
const MIN_FONT_SIZE = 9;
const MIN_CODE_FONT_SIZE = 12;
const CODE_FONT_FAMILY = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
});
// 코드블록이 있으면 바깥 View가 배치를 맡는다. 이 속성은 View로 옮기고 안쪽 글자에는 남기지 않는다.
const CONTAINER_STYLE_KEYS = [
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
] as const;

function splitContainerStyle(style: StyleProp<TextStyle>): { container: ViewStyle; text: TextStyle } {
  const text = { ...(StyleSheet.flatten(style) || {}) } as Record<string, unknown>;
  const container: Record<string, unknown> = {};
  for (const key of CONTAINER_STYLE_KEYS) {
    if (key in text) {
      container[key] = text[key];
      delete text[key];
    }
  }
  return { container: container as ViewStyle, text: text as TextStyle };
}

/** ```코드블록``` 구간은 줄바꿈·들여쓰기를 보존한 고정폭 상자로, 나머지 문장은 MathText로 렌더링한다. */
function renderWithCodeBlocks(text: string, style: StyleProp<TextStyle>) {
  const { container, text: textStyle } = splitContainerStyle(style);
  const baseFontSize = typeof textStyle.fontSize === 'number' ? textStyle.fontSize : DEFAULT_FONT_SIZE;
  const codeFontSize = Math.max(MIN_CODE_FONT_SIZE, Math.round(baseFontSize * 0.88));
  return (
    <View style={[container, styles.codeAwareColumn]}>
      {splitCodeBlocks(text).map((segment, idx) =>
        segment.type === 'code' ? (
          <View key={`code-${idx}`} style={styles.codeBlock}>
            <Text
              selectable
              style={[styles.codeText, { fontSize: codeFontSize, lineHeight: Math.round(codeFontSize * 1.5) }]}
            >
              {segment.value}
            </Text>
          </View>
        ) : (
          <MathText key={`text-${idx}`} text={segment.value} style={textStyle} />
        )
      )}
    </View>
  );
}

function renderInlineNodes(nodes: MathTextNode[], baseFontSize: number, keyPrefix: string) {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.type === 'text') return <Text key={key}>{node.value}</Text>;
    const sizeStyle = { fontSize: Math.max(MIN_FONT_SIZE, baseFontSize * 0.64) };
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

function hasBlockLevelMath(blocks: MathBlock[]): boolean {
  return blocks.some((b) => b.type === 'frac' || b.type === 'sqrt');
}

/**
 * 블록 배열(수식 트리의 한 층)을 렌더링한다. \frac/\sqrt가 전혀 없으면(단순 텍스트·
 * 기호·위아래첨자) 하나의 <Text>로, 있으면 줄바꿈 가능한 행(View)으로 렌더링한다.
 * \frac의 분자/분모, \sqrt의 내용물도 이 함수로 재귀 호출되어 중첩 수식을 표현한다.
 */
function renderBlockSequence(
  blocks: MathBlock[],
  baseFontSize: number,
  textStyle: StyleProp<TextStyle>,
  keyPrefix: string
): React.ReactNode {
  if (!hasBlockLevelMath(blocks)) {
    const runNodes = blocks.flatMap((b) => (b as { type: 'run'; nodes: MathTextNode[] }).nodes);
    return (
      <Text key={keyPrefix} style={textStyle}>
        {renderInlineNodes(runNodes, baseFontSize, keyPrefix)}
      </Text>
    );
  }
  return (
    <View key={keyPrefix} style={[textStyle as StyleProp<TextStyle>, styles.mathRow]}>
      {blocks.map((block, idx) => renderBlock(block, baseFontSize, textStyle, `${keyPrefix}-${idx}`))}
    </View>
  );
}

function renderBlock(block: MathBlock, baseFontSize: number, textStyle: StyleProp<TextStyle>, key: string): React.ReactNode {
  if (block.type === 'run') {
    return (
      <Text key={key} style={[textStyle, styles.mathRunItem]}>
        {renderInlineNodes(block.nodes, baseFontSize, key)}
      </Text>
    );
  }

  const dividerColor = (textStyle && (StyleSheet.flatten(textStyle) as TextStyle)?.color) || colors.ink;

  if (block.type === 'frac') {
    const innerFontSize = Math.max(MIN_FONT_SIZE, baseFontSize * NESTED_SHRINK);
    return (
      <View key={key} style={styles.fracContainer}>
        {renderBlockSequence(block.numerator, innerFontSize, [textStyle, styles.fracLine], `${key}-num`)}
        <View style={[styles.fracDivider, { borderTopColor: dividerColor }]} />
        {renderBlockSequence(block.denominator, innerFontSize, [textStyle, styles.fracLine], `${key}-den`)}
      </View>
    );
  }

  // sqrt
  const innerFontSize = Math.max(MIN_FONT_SIZE, baseFontSize * NESTED_SHRINK);
  return (
    <View key={key} style={styles.sqrtRow}>
      <Text style={[textStyle, styles.sqrtGlyph]}>√</Text>
      <View style={[styles.sqrtOverline, { borderTopColor: dividerColor }]}>
        {renderBlockSequence(block.content, innerFontSize, textStyle, `${key}-inner`)}
      </View>
    </View>
  );
}

/**
 * 문제 지문/보기/해설/힌트에 섞인 \frac, \sqrt(중첩 포함), \bar, ^, _, 그리스 문자·
 * 부등호 등 LaTeX 유사 수식 표기를 외부 라이브러리 없이 RN View/Text 조합으로
 * 렌더링한다. (math_notation.ts 참고. 오프라인/CDN 불필요, Expo Web·Android·iOS 동일 코드.)
 *
 * 수식 구성이 전혀 없는 일반 문장은 기존과 동일하게 단일 <Text>로 렌더링해
 * numberOfLines 등 기존 동작을 그대로 보존한다. ```코드블록```이 있으면 코드 상자와
 * 문장을 세로로 나눠 표시하며, 이때 numberOfLines는 적용하지 않는다.
 */
export const MathText: React.FC<MathTextProps> = ({ text, style, numberOfLines }) => {
  if (text && hasCodeBlock(text)) return renderWithCodeBlocks(text, style);

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
  if (!hasBlockLevelMath(blocks)) {
    const runNodes = blocks.flatMap((b) => (b as { type: 'run'; nodes: MathTextNode[] }).nodes);
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {renderInlineNodes(runNodes, baseFontSize, 'run')}
      </Text>
    );
  }

  return <>{renderBlockSequence(blocks, baseFontSize, style, 'root')}</>;
};

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
  codeAwareColumn: {
    gap: 8,
  },
  codeBlock: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  codeText: {
    fontFamily: CODE_FONT_FAMILY,
    fontWeight: '400',
    color: colors.ink,
  },
});
