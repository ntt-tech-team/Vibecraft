// Hand-drawn pixel art for The Trial (original drawings in the style of the in-game items,
// not game texture files). Each row is one line of pixels; '.' is transparent.
import type { ReactElement } from 'react'

export interface Art {
  w: number
  h: number
  pal: Record<string, string>
  rows: string[]
}

const art = (pal: Record<string, string>, rows: string[]): Art => ({ w: rows[0].length, h: rows.length, pal, rows })

// ---------- memory cards (16×16) ----------------------------------------------------------------
export const ITEMS = {
  diamond: {
    name: 'Diamond',
    art: art({ k: '#0B3B37', d: '#1AAEA1', c: '#4AEDD9', l: '#A1FBE8', w: '#FFFFFF' }, [
      '................',
      '................',
      '....kkkkkkkk....',
      '...kwlcccccck...',
      '..kwlccccccdck..',
      '.klccccccccddck.',
      '.kccccccccdddck.',
      '..kcccccccdddk..',
      '...kcccccdddk...',
      '....kcccdddk....',
      '.....kccddk.....',
      '......kcdk......',
      '.......kk.......',
      '................',
      '................',
      '................',
    ]),
  },
  sword: {
    name: 'Diamond Sword',
    art: art({ k: '#0B2B28', l: '#C8FFF4', c: '#4AEDD9', d: '#1AAEA1', g: '#0E5C55', b: '#8A5A2B', B: '#4E331A' }, [
      '.............kkk',
      '............klck',
      '...........klcdk',
      '..........klcdk.',
      '.........klcdk..',
      '........klcdk...',
      '.......klcdk....',
      '......klcdk.....',
      '..kk.klcdk......',
      '..kgkkcdk.......',
      '...kgcdk........',
      '...kbgk.........',
      '..kbkkgk........',
      '.kbk..kgk.......',
      'kBk....kk.......',
      'kk..............',
    ]),
  },
  pickaxe: {
    name: 'Iron Pickaxe',
    art: art({ k: '#2E2E2E', w: '#F0F0F0', m: '#BDBDBD', s: '#8A8A8A', b: '#8A5A2B', B: '#4E331A' }, [
      '................',
      '....kkkkkk......',
      '...kwwwwwmkk....',
      '....kkkkkmmmk...',
      '.........kkmmk..',
      '........kbkkmk..',
      '.......kbk.kmsk.',
      '......kbk..kmsk.',
      '.....kbk....ksk.',
      '....kbk.....kk..',
      '...kbk..........',
      '..kbk...........',
      '.kBk............',
      'kBk.............',
      'kk..............',
      '................',
    ]),
  },
  tnt: {
    name: 'TNT',
    art: art({ r: '#DB3A2A', d: '#A51F14', g: '#BDBDBD', w: '#F4F4F4', k: '#1A1A1A' }, [
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
      'gggggggggggggggg',
      'wwwwwwwwwwwwwwww',
      'wwkkkwkwwkwkkkww',
      'wwwkwwkkwkwwkwww',
      'wwwkwwkwkkwwkwww',
      'wwwkwwkwwkwwkwww',
      'wwwwwwwwwwwwwwww',
      'gggggggggggggggg',
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
      'rrrdrrrdrrrdrrrd',
    ]),
  },
  creeper: {
    name: 'Creeper Head',
    art: art({ a: '#6ECF5B', b: '#4CAF3F', c: '#2F8A2A', e: '#A6E68F', k: '#111111' }, [
      'abacbaba',
      'baebacab',
      'akkbakkb',
      'bkkabkka',
      'cabkkbac',
      'abkkkkba',
      'bakkkkab',
      'abkbakba',
    ]),
  },
  apple: {
    name: 'Golden Apple',
    art: art({ k: '#5C3D0A', y: '#F7D23E', o: '#D9A21C', O: '#B07A10', w: '#FFF6B3', s: '#6B4A2B', S: '#4A3219' }, [
      '................',
      '.......kk.......',
      '.......ksk......',
      '........Sk......',
      '...kkkk.Skkkk...',
      '..kyywykkyyyyk..',
      '.kywwyyyyyyyyok.',
      '.kywyyyyyyyyyok.',
      '.kyyyyyyyyyyyok.',
      '.kyyyyyyyyyyook.',
      '.kyyyyyyyyyyook.',
      '..kyyyyyyyyook..',
      '..koyyyyyyoOOk..',
      '...kooyyooOOk...',
      '....kkkOOkkk....',
      '................',
    ]),
  },
  torch: {
    name: 'Torch',
    art: art({ o: '#FF8C1A', y: '#FFD83B', w: '#FFF8C4', b: '#8A5A2B', B: '#5E3A18' }, [
      '................',
      '.......oo.......',
      '......oyyo......',
      '......ywwy......',
      '......oyyo......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......bB.......',
      '.......BB.......',
      '................',
      '................',
    ]),
  },
  pearl: {
    name: 'Ender Pearl',
    art: art({ k: '#0B2B2A', D: '#0F4A45', t: '#1F7A6C', g: '#3DB39A', l: '#8EF0D8' }, [
      '................',
      '................',
      '......kkkk......',
      '....kkDDDDkk....',
      '...kDDttttDDk...',
      '...kDttggttDk...',
      '..kDttgllgttDk..',
      '..kDtgllggttDk..',
      '..kDtggggtttDk..',
      '..kDttggtttDDk..',
      '...kDtttttDDk...',
      '...kDDDtDDDDk...',
      '....kkDDDDkk....',
      '......kkkk......',
      '................',
      '................',
    ]),
  },
} satisfies Record<string, { name: string; art: Art }>

export type ItemId = keyof typeof ITEMS

// ---------- Hunter mobs (8×8 faces) -------------------------------------------------------------
export const MOBS: { name: string; art: Art }[] = [
  { name: 'Creeper', art: ITEMS.creeper.art },
  {
    name: 'Blaze',
    art: art({ y: '#FCD63F', o: '#E89A1B', O: '#A8580C', k: '#2B1A04', w: '#FFF3A8' }, [
      'yoyyoyyo',
      'oyywyyoy',
      'ywwyywwy',
      'ykkyykky',
      'yyyyyyyy',
      'yoOOOOoy',
      'oyyyyyyo',
      'yoyooyoy',
    ]),
  },
  {
    name: 'Wither Skeleton',
    art: art({ d: '#3A3A3A', l: '#565656', k: '#080808' }, [
      'dddldddd',
      'dldddddl',
      'dkkddkkd',
      'dkkddkkd',
      'dddkkddd',
      'dddddddd',
      'dkkkkkkd',
      'dddddddd',
    ]),
  },
  {
    name: 'Magma Cube',
    art: art({ r: '#6B1E0C', R: '#3A0E05', o: '#FF7A1A', y: '#FFD23F' }, [
      'RrRRrRRr',
      'roRRRRor',
      'RRRRRRRR',
      'RyoRRoyR',
      'rRRRRRRr',
      'RRooooRR',
      'rRRRRRRr',
      'RrRoRRrR',
    ]),
  },
  {
    name: 'Ghast',
    art: art({ w: '#F2F2F2', g: '#D0D0D0', k: '#2B2B2B', r: '#C0392B' }, [
      'wwwwwwww',
      'wgwwwwgw',
      'wkkwwkkw',
      'wrwwwwrw',
      'wwwwwwww',
      'wwkkkkww',
      'wwkkkkww',
      'wgwwwwgw',
    ]),
  },
]

// ---------- renderer -----------------------------------------------------------------------------
const cache = new Map<Art, ReactElement[]>()

/** One <rect> per horizontal run of same-coloured pixels. */
function rectsFor(a: Art): ReactElement[] {
  const hit = cache.get(a)
  if (hit) return hit
  const out: ReactElement[] = []
  a.rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      const fill = a.pal[ch]
      if (ch !== '.' && fill) out.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={fill} />)
      x = end
    }
  })
  cache.set(a, out)
  return out
}

export function Pixel({ art: a, className, label }: { art: Art; className?: string; label?: string }) {
  return (
    <svg
      viewBox={`0 0 ${a.w} ${a.h}`}
      shapeRendering="crispEdges"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {rectsFor(a)}
    </svg>
  )
}
