import { StyleSheet, View } from 'react-native';

type SearchGlyphProps = {
  color: string;
  size?: number;
};

type CrownGlyphProps = {
  color: string;
  size?: number;
};

export function SearchGlyph({ color, size = 18 }: SearchGlyphProps) {
  const lensSize = Math.round(size * 0.62);
  const stroke = Math.max(1.6, size * 0.1);
  const handleWidth = Math.round(size * 0.4);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          left: 1,
          top: 1,
          width: lensSize,
          height: lensSize,
          borderRadius: lensSize / 2,
          borderWidth: stroke,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 1,
          top: Math.round(size * 0.67),
          width: handleWidth,
          height: 2,
          borderRadius: 999,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

export function CrownGlyph({ color, size = 18 }: CrownGlyphProps) {
  const stroke = Math.max(1.6, size * 0.1);
  const baseWidth = Math.round(size * 0.82);
  const sideHeight = Math.round(size * 0.42);
  const midHeight = Math.round(size * 0.6);

  return (
    <View style={[styles.frame, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          bottom: 2,
          left: Math.round((size - baseWidth) / 2),
          width: baseWidth,
          height: 2,
          borderRadius: 999,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 2,
          bottom: 4,
          width: Math.round(size * 0.36),
          height: stroke,
          borderRadius: 999,
          backgroundColor: color,
          transform: [{ translateY: -sideHeight / 2 }, { rotate: '-38deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: Math.round(size * 0.31),
          bottom: 4,
          width: Math.round(size * 0.38),
          height: stroke,
          borderRadius: 999,
          backgroundColor: color,
          transform: [{ translateY: -midHeight / 2 }, { rotate: '-90deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 2,
          bottom: 4,
          width: Math.round(size * 0.36),
          height: stroke,
          borderRadius: 999,
          backgroundColor: color,
          transform: [{ translateY: -sideHeight / 2 }, { rotate: '38deg' }],
        }}
      />
      <View style={[styles.dot, { backgroundColor: color, left: 1, top: Math.round(size * 0.38) }]} />
      <View style={[styles.dot, { backgroundColor: color, left: Math.round(size * 0.44), top: 1 }]} />
      <View style={[styles.dot, { backgroundColor: color, right: 1, top: Math.round(size * 0.38) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 999,
  },
});
