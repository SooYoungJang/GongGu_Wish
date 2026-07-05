import React from 'react';
import { Text } from 'react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  [key: string]: unknown;
};

export function Ionicons({ name, size, color, ...rest }: IconProps) {
  return React.createElement(Text, { testID: `ionicon-${name}`, style: { fontSize: size, color }, ...rest }, name);
}

export function MaterialIcons({ name, size, color, ...rest }: IconProps) {
  return React.createElement(Text, { testID: `ionicon-${name}`, style: { fontSize: size, color }, ...rest }, name);
}

export function Feather({ name, size, color, ...rest }: IconProps) {
  return React.createElement(Text, { testID: `ionicon-${name}`, style: { fontSize: size, color }, ...rest }, name);
}

export function FontAwesome({ name, size, color, ...rest }: IconProps) {
  return React.createElement(Text, { testID: `ionicon-${name}`, style: { fontSize: size, color }, ...rest }, name);
}
