import { useEffect, useRef, useMemo } from 'react';
import { Animated, View, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Three color waves matching the 3-note chime (warm → cool → pastel)
const WAVE_COLORS = [
  ['#FF6B6B','#FF8E53','#FFD93D','#FF3B58','#FF6F00'],   // wave 1 — warm
  ['#4ECDC4','#2563EB','#45B7D1','#10B981','#06B6D4'],   // wave 2 — cool
  ['#BB8FCE','#F7DC6F','#FFEAA7','#DDA0DD','#98D8C8'],   // wave 3 — pastel
];

function Piece({ x, size, color, duration, delay, isCircle, swing }) {
  const y   = useRef(new Animated.Value(-60)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const opc = useRef(new Animated.Value(1)).current;
  const dx  = useRef(new Animated.Value(x)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y,   { toValue: height + 60, duration, delay, useNativeDriver: true }),
      Animated.timing(rot, { toValue: 12,           duration, delay, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(dx, { toValue: x + swing,      duration: duration * 0.5, delay,        useNativeDriver: true }),
        Animated.timing(dx, { toValue: x - swing * 0.4, duration: duration * 0.5,               useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(delay + duration - 450),
        Animated.timing(opc, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    ]).start();

    return () => { y.stopAnimation(); rot.stopAnimation(); opc.stopAnimation(); dx.stopAnimation(); };
  }, []);

  const rotate = rot.interpolate({ inputRange: [0, 12], outputRange: ['0deg', '2160deg'] });

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0,
      width: size,
      height: isCircle ? size : size * 0.42,
      borderRadius: isCircle ? size / 2 : 2,
      backgroundColor: color,
      opacity: opc,
      transform: [{ translateX: dx }, { translateY: y }, { rotate }],
    }} />
  );
}

export default function Confetti({ visible, onDone }) {
  // Three waves: delays timed to match the 3 chime notes (0ms, 130ms, 260ms)
  const pieces = useMemo(() => {
    const result = [];
    WAVE_COLORS.forEach((palette, waveIdx) => {
      const waveDelay = waveIdx * 130;
      for (let i = 0; i < 28; i++) {
        result.push({
          id: `${waveIdx}-${i}`,
          x:        Math.random() * width,
          size:     7 + Math.random() * 10,
          color:    palette[Math.floor(Math.random() * palette.length)],
          duration: 1600 + Math.random() * 1000,
          delay:    waveDelay + Math.random() * 80,
          isCircle: Math.random() > 0.55,
          swing:    25 + Math.random() * 70,
        });
      }
    });
    return result;
  }, []);

  useEffect(() => {
    if (!visible) return;
    const maxMs = Math.max(...pieces.map(p => p.delay + p.duration)) + 200;
    const t = setTimeout(() => onDone?.(), maxMs);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map(p => <Piece key={p.id} {...p} />)}
    </View>
  );
}
