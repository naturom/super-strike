import {ISLAND_COAST,dustPoint,SCOUT_TOWER,type MapId} from '@sirocco/shared';
export const MAP_TOUR=[
  {name:'MID · SCOUT TOWER',description:'Enter from Catwalk and climb the enclosed ladder to a lookout above the rooftops.',eye:dustPoint(563,563,SCOUT_TOWER.deck+1.6),target:dustPoint(480,300,7)},
  {name:'A · CT COURTYARD',description:'Team B defends Site A just beside its starting area, with approaches from Mid and CT.',eye:dustPoint(590,264,2.1),target:dustPoint(548,248,.35)},
  {name:'LONG · BLUE',description:'Double doors open into the street, with Blue to one side and Pit beyond.',eye:dustPoint(866,520,3.8),target:dustPoint(710,554,4)},
  {name:'MID · DOUBLE DOORS',description:'The central sightline connects Top Mid to the CT side.',eye:dustPoint(473,510,2.8),target:dustPoint(464,300,1.9)},
  {name:'B · T TERRACE',description:'Team A defends Site B on its home terrace, close to all four starting positions.',eye:dustPoint(405,943,5.3),target:dustPoint(355,905,3.5)},
  {name:'UPPER TUNNELS',description:'A covered flank, a sunlit roof opening and stairs down to Lower Tunnels.',eye:dustPoint(200,465,4.8),target:dustPoint(118,380,4.8)},
  {name:'SHORT · CATWALK',description:'Climb from Mid to the raised hotel platform above the CT approach.',eye:dustPoint(645,280,5.4),target:dustPoint(786,168,5.6)},
  {name:'CT · DEFEND A',description:'The lower CT route passes Site A, then beneath Short toward Long.',eye:dustPoint(590,230,1.6),target:dustPoint(548,248,.8)},
  {name:'T · SPAWN',description:'The terrace splits toward tunnels, Top Mid and the Long entrance.',eye:dustPoint(320,932,4.8),target:dustPoint(610,879,5.1)},
];
export const DEPOT_TOUR=[
 {name:'DEPOT · OVERVIEW',description:'A 40 × 35 metre loading yard with two warehouses, three routes and one low catwalk.',eye:{x:27,y:27,z:30},target:{x:0,y:0,z:0}},
 {name:'YARD · CONTAINERS',description:'Cargo containers and low pallet cover split the central yard into short, connected fights.',eye:{x:-4.7,y:1.65,z:10},target:{x:2,y:1.3,z:-5}},
 {name:'WEST · DEFEND B',description:'Team A starts inside Goods In, close to Site B. Two loading doors and the stairs lead out.',eye:{x:-17,y:1.6,z:10},target:{x:-8,y:1.45,z:6}},
 {name:'CATWALK · MID',description:'Stairs from either warehouse reach this 2.8 metre bridge. Walk underneath or fight over the yard.',eye:{x:-1,y:4.4,z:0},target:{x:2,y:.9,z:8}},
 {name:'NORTH · SERVICE LANE',description:'A fast flank along the back of the loading bays, with no direct line into the opposite spawn.',eye:{x:-17,y:1.6,z:-14.5},target:{x:10,y:1.4,z:-14.5}},
 {name:'EAST · DEFEND A',description:'Team B defends Dispatch and Site A. Attack through the yard, bridge or service doors.',eye:{x:8,y:1.6,z:-10},target:{x:14,y:1.2,z:-6}},
];
export const ISLAND_TOUR=[
 {name:'ISLAND · OVERVIEW',description:'A mid-sized island with dense jungle, sandy coves and three connected routes.',eye:{x:63,y:54,z:64},target:{x:0,y:0,z:0}},
 {name:'JUNGLE · CENTRAL CLEARING',description:'Large mossy rocks split the middle route. Ferns and saplings provide concealment along either flank.',eye:{x:-11,y:1.7,z:10},target:{x:9,y:2,z:2}},
 {name:'COAST · SOUTH COVE',description:'Follow the sandy edge around the forest and reconnect with the southern jungle trail.',eye:{x:-8,y:1.7,z:35},target:{x:16,y:2,z:27}},
 {name:'PALMS · NORTH TRAIL',description:'A quieter approach through palms, tall trees and fallen timber.',eye:{x:-24,y:1.7,z:-19},target:{x:2,y:3,z:-27}},
 {name:'WEST CAMP · DEFEND B',description:'Team A starts in a sheltered clearing beside Site B and its weapon supplies.',eye:{x:-40,y:1.7,z:18},target:{x:-25,y:2,z:13}},
 {name:'EAST CAMP · DEFEND A',description:'Team B protects Site A. Branch into the central clearing or circle through the coast.',eye:{x:40,y:1.7,z:-18},target:{x:24,y:2,z:-10}},
 {name:'COAST · WALKABLE SHALLOWS',description:'Wade off the beach and follow the stepped seabed back to dry land. Only full submersion starts the breath timer.',eye:{x:ISLAND_COAST[0][0]*.97,y:1.7,z:0},target:{x:ISLAND_COAST[0][0]*1.3,y:-.6,z:-4}},
 {name:'REEF · UNDERWATER',description:'A submerged view of the sandy seabed. Watch for a reef shark passing occasionally through the blue water.',eye:{x:ISLAND_COAST[0][0]*1.24,y:-1.12,z:0},target:{x:ISLAND_COAST[0][0]*1.28,y:-1.55,z:-12}},
];
export const MARKET_TOUR=[
 {name:'NIGHT MARKET · OVERVIEW',description:'Lantern streets, colourful shophouses and a covered food pavilion, with two back-alley flanks.',eye:{x:35,y:39,z:40},target:{x:0,y:0,z:0}},
 {name:'LANTERN STREET · FOOD PAVILION',description:'Move through the stalls or circle the covered pavilion. Warm lanterns keep the main street readable.',eye:{x:-10,y:1.7,z:8},target:{x:8,y:2.6,z:1}},
 {name:'WEST GATE · DEFEND B',description:'Team A protects Site B near its supplies. Delivery carts shelter the approach to the food hall.',eye:{x:-29,y:1.7,z:1},target:{x:-10,y:2,z:-7}},
 {name:'NORTH · TEA HOUSE ALLEY',description:'A quieter flank behind the shops connects through the gaps on either side of the tea house.',eye:{x:-19,y:1.7,z:-23.5},target:{x:16,y:2,z:-23.5}},
 {name:'FOOD HALL · COVERED AISLE',description:'Serving counters and kitchen equipment create close-range cover beneath the tiled pavilion roof.',eye:{x:-4.4,y:1.7,z:4},target:{x:-3,y:1.5,z:-4}},
 {name:'EAST GATE · DEFEND A',description:'Team B defends the east gate. Approach through Lantern Street or the arcade-side alley.',eye:{x:29,y:1.7,z:-1},target:{x:10,y:2,z:7}},
];
export const tourForMap=(map:MapId)=>map==='market'?MARKET_TOUR:map==='island'?ISLAND_TOUR:map==='relay'?DEPOT_TOUR:MAP_TOUR;
