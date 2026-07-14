import type { StyleProp, TextStyle } from "react-native";

import { useTheme } from "../../context/ThemeContext";
import { formatPriceKrw } from "../../utils/price";
import { SText, type STextVariant } from "./SText";

export type PriceTextProps = {
  priceKrw: unknown;
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
  valueStyle?: StyleProp<TextStyle>;
  variant?: STextVariant;
};

/**
 * Consistent price presentation for the mobile app.
 *
 * The label stays in the active surface text color while only the formatted
 * amount is emphasized. Invalid API values deliberately render as "가격 미정"
 * instead of leaking raw data into the UI.
 */
export function PriceText({
  color,
  numberOfLines = 1,
  priceKrw,
  style,
  testID,
  valueStyle,
  variant = "caption",
}: PriceTextProps) {
  const { colors } = useTheme();
  const textColor = color ?? colors.textPrimary;
  const formattedPrice = formatPriceKrw(priceKrw);

  return (
    <SText
      numberOfLines={numberOfLines}
      style={[style, { color: textColor, fontWeight: "500" }]}
      testID={testID}
      variant={variant}
    >
      가격{" "}
      <SText
        style={[
          style,
          { color: textColor, fontWeight: formattedPrice ? "900" : "500" },
          valueStyle,
        ]}
        variant={variant}
      >
        {formattedPrice ?? "미정"}
      </SText>
    </SText>
  );
}
