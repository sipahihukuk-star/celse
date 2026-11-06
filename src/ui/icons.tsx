// Ön yüzdeki kartların çizgi simgeleri (emoji yerine): aynı çizgi kalınlığı, yuvarlak uçlar, tema rengi.
// Her simge 24×24 ızgarada çizilir; IconBadge onu yuvarlak köşeli, ince çerçeveli bir rozetin içine koyar.
import React from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { C } from "./theme";

export type IconName = "scales" | "trophy" | "folder" | "cart";

export function Icon({ name, size = 24, color = C.brass, stroke = 1.6 }: { name: IconName; size?: number; color?: string; stroke?: number }) {
  const p = { stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "scales" && (
        <>
          <Path d="M12 3.5v16" {...p} />
          <Path d="M8 20.5h8" {...p} />
          <Path d="M4.5 7h15" {...p} />
          <Circle cx={12} cy={5} r={1.3} {...p} />
          <Path d="M5.5 7 3 13h5L5.5 7Z" {...p} />
          <Path d="M3 13a2.5 2.5 0 0 0 5 0" {...p} />
          <Path d="M18.5 7 16 13h5l-2.5-6Z" {...p} />
          <Path d="M16 13a2.5 2.5 0 0 0 5 0" {...p} />
        </>
      )}
      {name === "trophy" && (
        <>
          <Path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" {...p} />
          <Path d="M7.5 6H5a2.5 2.5 0 0 0 2.6 3.6" {...p} />
          <Path d="M16.5 6H19a2.5 2.5 0 0 1-2.6 3.6" {...p} />
          <Path d="M12 13.5V17" {...p} />
          <Path d="M8.5 20h7l-.8-3h-5.4l-.8 3Z" {...p} />
        </>
      )}
      {name === "folder" && (
        <>
          <Path d="M3.5 7.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 19 8h-7l-2-2.5H5A1.5 1.5 0 0 0 3.5 7v.5Z" {...p} />
          <Path d="M8 12.5h8M8 15.5h5" {...p} />
        </>
      )}
      {name === "cart" && (
        <>
          <Path d="M3 4.5h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20 8H6" {...p} />
          <Circle cx={9.5} cy={19.5} r={1.2} {...p} />
          <Circle cx={17} cy={19.5} r={1.2} {...p} />
        </>
      )}
    </Svg>
  );
}

/** Kartlardaki simge rozeti: yuvarlak köşeli kare, ince çerçeve, hafif dolgu. */
export function IconBadge({ name, size = 44 }: { name: IconName; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, borderWidth: 1, borderColor: C.brassDim, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={size * 0.56} />
    </View>
  );
}
