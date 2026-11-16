import {heightOf,type Vec3} from './index';
export interface Water {level:number;bed?:number;}
export const WATER_RULES={breathMs:10000,damage:5,damageIntervalMs:1000} as const;
export function inWater(p:Vec3,water?:Water){return !!water&&p.y<water.level-.02;}
/** The entire standing/crouched body must be below the fixed water surface. */
export function fullySubmerged(p:Vec3&{crouched?:boolean},water?:Water){return !!water&&p.y+heightOf(p)<water.level-.001;}
