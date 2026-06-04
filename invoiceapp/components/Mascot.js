import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Rect, Circle, Path, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';

const P = {
  dark:   '#5B21B6',
  mid:    '#7C3AED',
  vivid:  '#8B5CF6',
  light:  '#A78BFA',
  pale:   '#C4B5FD',
  palest: '#EDE9FE',
};

const BODY = 'M22,15 Q22,9 28,9 L72,9 Q78,9 78,15 L78,82 L74,87 L70,82 L66,87 L62,82 L58,87 L54,82 L50,87 L46,82 L42,87 L38,82 L34,87 L30,82 L26,87 L22,82 Z';

export default function Mascot({ size = 80 }) {
  const bounceY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -10, duration: 270, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 3,   duration: 220, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: -7,  duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0,   duration: 200, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        Animated.delay(1800),
      ])
    ).start();
  }, []);

  return (
    <View style={{ width: size, height: size * 1.3 }}>
      <Animated.View
        style={{
          width: size,
          height: size * 1.3,
          transform: [{ translateY: bounceY }],
        }}
      >
        <Svg
          width={size}
          height={size * 1.3}
          viewBox="0 0 100 130"
        >
          <Defs>
            <LinearGradient id="bG" x1="0.1" y1="0" x2="0.9" y2="1">
              <Stop offset="0"   stopColor="#FFFFFF" />
              <Stop offset="0.5" stopColor="#F9F7FF" />
              <Stop offset="1"   stopColor="#EDE9FE" />
            </LinearGradient>
            <LinearGradient id="bD" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.35" stopColor={P.mid} stopOpacity="0"    />
              <Stop offset="1"    stopColor={P.mid} stopOpacity="0.15" />
            </LinearGradient>
            <LinearGradient id="bE" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0.75" stopColor={P.pale} stopOpacity="0"    />
              <Stop offset="1"    stopColor={P.pale} stopOpacity="0.65" />
            </LinearGradient>
          </Defs>

          {/* Body cast shadow */}
          <Path d={BODY} fill={P.dark} opacity="0.12" transform="translate(4,6)" />

          {/* Right-edge depth strip */}
          <Path
            d="M73,10 Q78,10 78,15 L78,82 L74,87 L70,82 L70,10 Z"
            fill={P.pale}
            opacity="0.5"
          />

          {/* Main paper body */}
          <Path d={BODY} fill="url(#bG)" />
          <Path d={BODY} fill="url(#bD)" />
          <Path d={BODY} fill="url(#bE)" />

          {/* Left-edge highlight */}
          <Path
            d="M22,15 L22,82 L24,86 L24,15 Q24,11 27,10 L24,10 Q22,10 22,15 Z"
            fill="white"
            opacity="0.7"
          />

          {/* Top highlight stripe */}
          <Rect x="22" y="9" width="56" height="5" rx="4" fill="white" opacity="0.65" />

          {/* Invoice text lines */}
          <Rect x="31" y="64" width="32" height="3.2" rx="1.6" fill={P.light} opacity="0.45" />
          <Rect x="31" y="71" width="20" height="3.2" rx="1.6" fill={P.light} opacity="0.45" />
          <Rect x="54" y="71" width="10" height="3.2" rx="1.6" fill={P.mid}   opacity="0.55" />

          {/* ── Eyes ── */}
          {/* Sclera */}
          <Ellipse cx="37.5" cy="36" rx="9" ry="9.5" fill="#F5F3FF" />
          <Ellipse cx="62.5" cy="36" rx="9" ry="9.5" fill="#F5F3FF" />
          {/* Top eye shadow */}
          <Ellipse cx="37.5" cy="30.5" rx="8" ry="4.5" fill={P.pale} opacity="0.28" />
          <Ellipse cx="62.5" cy="30.5" rx="8" ry="4.5" fill={P.pale} opacity="0.28" />
          {/* Iris */}
          <Circle cx="38.5" cy="37" r="7" fill={P.vivid} opacity="0.9" />
          <Circle cx="63.5" cy="37" r="7" fill={P.vivid} opacity="0.9" />
          <Circle cx="38.5" cy="37" r="5" fill={P.mid} />
          <Circle cx="63.5" cy="37" r="5" fill={P.mid} />
          {/* Pupil */}
          <Circle cx="39"   cy="37.5" r="3.8" fill={P.dark}  />
          <Circle cx="64"   cy="37.5" r="3.8" fill={P.dark}  />
          <Circle cx="39"   cy="37.5" r="2.3" fill="#1E1B4B" />
          <Circle cx="64"   cy="37.5" r="2.3" fill="#1E1B4B" />
          {/* Specular highlights */}
          <Ellipse cx="41"   cy="33.5" rx="3"   ry="2.3" fill="white" opacity="0.95" />
          <Ellipse cx="66"   cy="33.5" rx="3"   ry="2.3" fill="white" opacity="0.95" />
          <Circle  cx="37.5" cy="40"   r="1.2"            fill="white" opacity="0.55" />
          <Circle  cx="62.5" cy="40"   r="1.2"            fill="white" opacity="0.55" />

          {/* Eyebrows */}
          <Path d="M29.5,25.5 Q37,22.5 44.5,25.5"
                stroke={P.dark} strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.72" />
          <Path d="M55.5,25.5 Q63,22.5 70.5,25.5"
                stroke={P.dark} strokeWidth="2.8" fill="none" strokeLinecap="round" opacity="0.72" />

          {/* Rosy cheeks */}
          <Ellipse cx="26.5" cy="46" rx="7.5" ry="5.5" fill="#FB7185" opacity="0.27" />
          <Ellipse cx="73.5" cy="46" rx="7.5" ry="5.5" fill="#FB7185" opacity="0.27" />

          {/* Nose */}
          <Ellipse cx="50" cy="47" rx="3" ry="1.8" fill={P.pale} opacity="0.5" />

          {/* Smile */}
          <Path d="M35,55 Q50,70 65,55"
                stroke={P.mid} strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <Path d="M35,55 Q50,67.5 65,55 Q50,61.5 35,55 Z"
                fill={P.palest} opacity="0.5" />

        </Svg>
      </Animated.View>
    </View>
  );
}
