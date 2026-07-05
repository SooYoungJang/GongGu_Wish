declare module '@expo/vector-icons' {
  import { Component } from 'react';
  import { TextProps } from 'react-native';

  interface IconProps extends TextProps {
    name: string;
    size?: number;
    color?: string;
    allowFontScaling?: boolean;
  }

  export class Ionicons extends Component<IconProps> {}
  export class MaterialIcons extends Component<IconProps> {}
  export class Feather extends Component<IconProps> {}
  export class FontAwesome extends Component<IconProps> {}
}
