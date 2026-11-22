import React, { useEffect, useState } from 'react';
import { StyleProp, Text, TextStyle, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

export const MarqueeText: React.FC<MarqueeTextProps> = ({
  text,
  style,
  duration = 9000,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (textWidth > containerWidth && containerWidth > 0) {
      translateX.value = 0;
      translateX.value = withDelay(
        1400,
        withRepeat(
          withTiming(-(textWidth - containerWidth + 32), {
            duration,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true
        )
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
    }
    return () => cancelAnimation(translateX);
  }, [textWidth, containerWidth, text, duration, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const shouldScroll = textWidth > containerWidth && containerWidth > 0;

  return (
    <View
      style={{ overflow: 'hidden', width: '100%', alignItems: shouldScroll ? 'flex-start' : 'center' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Animated.View style={[animatedStyle, { flexDirection: 'row' }]}>
        <Text
          style={[style, { flexShrink: 0 }]}
          onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
          numberOfLines={1}
        >
          {text}
        </Text>
      </Animated.View>
    </View>
  );
};
