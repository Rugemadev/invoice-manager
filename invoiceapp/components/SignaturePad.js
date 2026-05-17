import { useRef, useState, useCallback } from 'react';
import { View, PanResponder, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../constants/colors';
import { FontSize, Spacing, Radius } from '../constants/theme';

export default function SignaturePad({ onSave, onClear, onBeginDraw, onEndDraw, height: padHeight = 200 }) {
  const [paths, setPaths] = useState([]);
  const currentPath = useRef('');
  const isEmpty = paths.length === 0;

  const onBeginRef = useRef(onBeginDraw);
  const onEndRef = useRef(onEndDraw);
  onBeginRef.current = onBeginDraw;
  onEndRef.current = onEndDraw;

  const panResponder = useRef(
    PanResponder.create({
      // Capture phase — intercept before ScrollView can grab the gesture
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPaths(prev => [...prev, currentPath.current]);
        onBeginRef.current?.();
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPaths(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = currentPath.current;
          return updated;
        });
      },
      onPanResponderRelease: () => {
        currentPath.current = '';
        onEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        currentPath.current = '';
        onEndRef.current?.();
      },
    })
  ).current;

  const handleClear = useCallback(() => {
    setPaths([]);
    onClear?.();
  }, [onClear]);

  const handleSave = useCallback(() => {
    if (isEmpty) return;
    const svgPaths = paths
      .filter(Boolean)
      .map(d => `<path d="${d}" stroke="#1E293B" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
      .join('');
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="${padHeight}">${svgPaths}</svg>`;
    const b64 = btoa(unescape(encodeURIComponent(svgContent)));
    onSave?.(`data:image/svg+xml;base64,${b64}`);
  }, [paths, isEmpty, padHeight, onSave]);

  return (
    <View style={styles.wrapper}>
      <View
        style={[styles.pad, { height: padHeight }]}
        {...panResponder.panHandlers}
        collapsable={false}
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height={padHeight}>
          {paths.filter(Boolean).map((d, i) => (
            <Path
              key={i}
              d={d}
              stroke="#1E293B"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
        {isEmpty && (
          <Text style={styles.hint}>Sign here with your finger</Text>
        )}
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
          <Text style={styles.clearTxt}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, isEmpty && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={isEmpty}
          activeOpacity={0.85}
        >
          <Text style={styles.saveTxt}>Save Signature</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.sm },
  pad: {
    backgroundColor: '#FAFAFA',
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hint: { fontSize: FontSize.md, color: Colors.textMuted },
  buttons: { flexDirection: 'row', gap: Spacing.sm },
  clearBtn: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  clearTxt: { fontSize: FontSize.md, color: Colors.textSecondary },
  saveBtn: {
    flex: 2, backgroundColor: Colors.primary,
    borderRadius: Radius.md, paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveTxt: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
});
