import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';

export default function Mascot({ size = 80 }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1,    duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1,   duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0.7,  duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -0.7, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0,    duration: 200, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.delay(2200),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-28deg', '28deg'],
  });

  const fontSize = size * 0.82;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          transform: [
            { translateY: size * 0.32 },
            { rotate },
            { translateY: -size * 0.32 },
          ],
        }}
      >
        <Text style={{ fontSize, lineHeight: size, textAlign: 'center' }}>👋</Text>
      </Animated.View>
    </View>
  );
}
