// Karakter çizimi (react-native-svg). HTML prototipindeki svgChar fonksiyonunun karşılığı.
import React, { useEffect, useState } from "react";
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from "react-native-svg";
import { Look } from "../engine/types";
import { C } from "./theme";

export const BACK_LOOK: Look = { kind: "back", skin: "#d4a27c", hair: "#2a2220" };

function HairBack({ L }: { L: Look }) {
  if (L.style === "long") return <Path d="M44 82 Q38 30 80 31 Q122 30 116 82 L119 134 Q80 142 41 134 Z" fill={L.hair} />;
  if (L.style === "bun") return <Circle cx={80} cy={35} r={13} fill={L.hair} />;
  return null;
}

function HairFront({ L }: { L: Look }) {
  switch (L.style) {
    case "short": return <Path d="M48 80 Q43 35 80 35 Q117 35 112 80 Q110 59 97 54 Q80 59 63 54 Q50 59 48 80 Z" fill={L.hair} />;
    case "long": return <Path d="M50 76 Q49 42 80 42 Q111 42 110 76 Q103 55 80 56 Q60 55 50 76 Z" fill={L.hair} />;
    case "bun": return <Path d="M50 74 Q50 43 80 43 Q110 43 110 74 Q104 56 80 55 Q56 56 50 74 Z" fill={L.hair} />;
    case "bald": return <Path d="M49 92 Q45 70 53 60 Q54 76 57 94 Z M111 92 Q115 70 107 60 Q106 76 103 94 Z" fill={L.hair} />;
    case "curly":
      return <G>{[[50,66,11],[57,50,12],[70,41,12],[90,41,12],[103,50,12],[110,66,11],[80,38,11]].map(([x,y,r], i) =>
        <Circle key={i} cx={x} cy={y} r={r} fill={L.hair} />)}</G>;
    default: return null;
  }
}

/** Konuşurken ağız açılıp kapanır. */
function useMouth(talking: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!talking) { setOpen(false); return; }
    const t = setInterval(() => setOpen(o => !o), 140);
    return () => clearInterval(t);
  }, [talking]);
  return open;
}

export default function Character({ look, talking = false }: { look: Look; talking?: boolean }) {
  const open = useMouth(talking);
  const L = look;
  if (L.kind === "back") {
    return (
      <Svg viewBox="0 0 160 200" width="100%" height="100%">
        <Rect x={69} y={104} width={22} height={24} fill={L.skin} />
        <Path d="M6 200 Q10 138 80 122 Q150 138 154 200 Z" fill={C.robe} />
        <Path d="M52 130 Q80 116 108 130 L103 139 Q80 127 57 139 Z" fill={C.avukat} />
        <Path d="M80 142 L80 200" stroke="#0a0b0d" strokeWidth={2} />
        <Ellipse cx={50} cy={84} rx={5} ry={8} fill={L.skin} />
        <Ellipse cx={110} cy={84} rx={5} ry={8} fill={L.skin} />
        <Ellipse cx={80} cy={78} rx={31} ry={38} fill={L.hair} />
      </Svg>
    );
  }
  const robe = L.kind === "robe";
  const collar = L.collarColor || (L.collar === "hakim" ? C.hakim : C.avukat);
  const brow = L.style === "bald" ? "#2a2523" : L.hair;
  return (
    <Svg viewBox="0 0 160 200" width="100%" height="100%">
      <Rect x={69} y={106} width={22} height={24} fill={L.skin} />
      <Rect x={69} y={106} width={22} height={10} fill="rgba(0,0,0,0.18)" />
      <Path d="M6 200 Q10 138 80 124 Q150 138 154 200 Z" fill={robe ? L.robe || C.robe : L.shirt || "#55657a"} />
      {robe ? (
        <G>
          <Polygon points="70,122 80,146 90,122" fill={C.shirt} />
          <Path d="M54 130 Q80 114 106 130 L101 136 Q80 124 59 136 Z" fill={collar} />
          <Polygon points="59,134 71,124 79,200 61,200" fill={collar} />
          <Polygon points="101,134 89,124 81,200 99,200" fill={collar} />
        </G>
      ) : (
        <Polygon points="66,124 80,162 94,124" fill={L.inner || "#d9d4c8"} />
      )}
      <HairBack L={L} />
      <Ellipse cx={50} cy={84} rx={5} ry={8} fill={L.skin} />
      <Ellipse cx={110} cy={84} rx={5} ry={8} fill={L.skin} />
      <Ellipse cx={80} cy={80} rx={30} ry={36} fill={L.skin} />
      <HairFront L={L} />
      {L.beard && <Path d="M51 92 Q53 124 80 128 Q107 124 109 92 Q104 113 92 111 Q80 107 68 111 Q56 113 51 92 Z" fill={L.hair} />}
      <Path d="M61 72 Q68 68 75 72 M85 72 Q92 68 99 72" stroke={brow} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <Ellipse cx={68} cy={82} rx={3} ry={3.6} fill="#1d1a19" />
      <Ellipse cx={92} cy={82} rx={3} ry={3.6} fill="#1d1a19" />
      <Path d="M80 85 Q76 95 81 96" stroke="rgba(0,0,0,0.28)" strokeWidth={2} fill="none" strokeLinecap="round" />
      <Ellipse cx={80} cy={104} rx={7} ry={open ? 5 : 2} fill={C.mouth} />
      {L.glasses && (
        <G fill="none" stroke="#1b1b1b" strokeWidth={2.2}>
          <Circle cx={68} cy={82} r={9} />
          <Circle cx={92} cy={82} r={9} />
          <Path d="M77 82 H83" />
        </G>
      )}
    </Svg>
  );
}
