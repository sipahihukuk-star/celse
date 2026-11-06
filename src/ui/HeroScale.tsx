// Ön yüzün büyük terazisi: pirinç (altın) metal görünümlü, ayaklı, zincirli kefeler; kefeler oyuncu renginde ince bir yansıma taşır.
// Oyundaki küçük Scale gibi eğilir (angle > 0 sağ kefe aşağı). Arkada hafif bir ışık halesi vardır.
import React from "react";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTween } from "./kit";

const GOLD = ["#fff3c4", "#e9c46a", "#b9862f", "#7a5418"];

export function HeroScale({ angle, size = 300, left, right }: { angle: number; size?: number; left: string; right: string }) {
  const a = useTween(angle);
  const pan = (cx: number, tint: string, id: string) => (
    <G rotation={-a} origin={`${cx}, 62`}>
      {/* zincirler */}
      <Path d={`M${cx} 62 L${cx - 27} 126 M${cx} 62 L${cx + 27} 126 M${cx} 62 L${cx} 124`} stroke="url(#chain)" strokeWidth={1.2} />
      <Circle cx={cx} cy={62} r={3.2} fill="url(#metal)" />
      {/* kefe */}
      <Path d={`M${cx - 34} 126 Q${cx} 158 ${cx + 34} 126 Z`} fill="url(#pan)" />
      <Path d={`M${cx - 34} 126 Q${cx} 158 ${cx + 34} 126`} fill={tint} opacity={0.28} />
      <Ellipse cx={cx} cy={126} rx={34} ry={4.2} fill={`url(#${id})`} />
      <Path d={`M${cx - 24} 133 Q${cx - 6} 145 ${cx + 10} 140`} stroke="#fff6d6" strokeWidth={1.4} strokeLinecap="round" opacity={0.55} fill="none" />
    </G>
  );
  return (
    <Svg width={size} height={size * 0.84} viewBox="0 0 240 202">
      <Defs>
        <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="metal" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GOLD[2]} />
          <Stop offset="0.45" stopColor={GOLD[0]} />
          <Stop offset="0.7" stopColor={GOLD[1]} />
          <Stop offset="1" stopColor={GOLD[3]} />
        </LinearGradient>
        <LinearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GOLD[0]} />
          <Stop offset="0.55" stopColor={GOLD[1]} />
          <Stop offset="1" stopColor={GOLD[3]} />
        </LinearGradient>
        <LinearGradient id="pan" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GOLD[1]} />
          <Stop offset="1" stopColor={GOLD[3]} />
        </LinearGradient>
        <LinearGradient id="chain" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={GOLD[0]} />
          <Stop offset="1" stopColor={GOLD[2]} />
        </LinearGradient>
        <LinearGradient id="rimL" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GOLD[2]} />
          <Stop offset="0.5" stopColor={GOLD[0]} />
          <Stop offset="1" stopColor={left} />
        </LinearGradient>
        <LinearGradient id="rimR" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={right} />
          <Stop offset="0.5" stopColor={GOLD[0]} />
          <Stop offset="1" stopColor={GOLD[2]} />
        </LinearGradient>
      </Defs>
      <Circle cx={120} cy={100} r={92} fill="url(#halo)" />
      {/* ayak */}
      <Ellipse cx={120} cy={193} rx={58} ry={5} fill="#000000" opacity={0.25} />
      <Rect x={70} y={180} width={100} height={11} rx={5} fill="url(#metal)" />
      <Rect x={86} y={170} width={68} height={11} rx={4} fill="url(#metal)" />
      {/* sütun */}
      <Path d="M115 60 L125 60 L128 170 L112 170 Z" fill="url(#metal)" />
      <Rect x={108} y={92} width={24} height={6} rx={3} fill="url(#metal)" />
      <Rect x={109} y={134} width={22} height={5} rx={2.5} fill="url(#metal)" />
      {/* kol ve kefeler */}
      <G rotation={a} origin="120, 50">
        <Path d="M30 48.5 Q120 42 210 48.5 L210 53.5 Q120 58 30 53.5 Z" fill="url(#beam)" />
        <Circle cx={30} cy={51} r={4.5} fill="url(#metal)" />
        <Circle cx={210} cy={51} r={4.5} fill="url(#metal)" />
        <Path d="M30 51 L30 62 M210 51 L210 62" stroke="url(#chain)" strokeWidth={1.6} />
        {pan(30, left, "rimL")}
        {pan(210, right, "rimR")}
      </G>
      {/* mil ve tepe */}
      <Circle cx={120} cy={50} r={9} fill="url(#metal)" />
      <Circle cx={120} cy={50} r={4} fill={GOLD[3]} opacity={0.6} />
      <Path d="M120 22 L126 34 L120 40 L114 34 Z" fill="url(#beam)" />
      <Circle cx={120} cy={19} r={4} fill="url(#metal)" />
    </Svg>
  );
}
