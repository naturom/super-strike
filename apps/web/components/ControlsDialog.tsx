'use client';
import React,{useEffect,useRef} from 'react';

export function ControlsDialog({open,onClose,defusal,hasLadders,spectating,targetSite,moreFun}:{open:boolean;onClose:()=>void;defusal:boolean;hasLadders:boolean;spectating:boolean;targetSite?:'A'|'B';moreFun:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;if(!dialog)return;if(open&&!dialog.open)dialog.showModal();else if(!open&&dialog.open)dialog.close();},[open]);
 return <dialog ref={ref} className="controls-dialog" aria-labelledby="controls-title" onClose={onClose} onKeyDown={e=>e.stopPropagation()} onKeyUp={e=>e.stopPropagation()}>
  <header className="controls-dialog-heading"><div><span className="eyebrow">KEYBOARD + MOUSE</span><h2 id="controls-title">Controls</h2></div><button type="button" className="controls-close" onClick={onClose} autoFocus>CLOSE</button></header>
  {spectating?<section className="controls-section"><h3>Spectating</h3><div className="control-row"><kbd>SPACE</kbd><span>Next living player</span></div><div className="control-row"><kbd>TAB</kbd><span>Scoreboard</span></div><p>View only. You return when the next game starts.</p></section>:<div className="controls-sections">
   <section className="controls-section"><h3>Movement</h3><div className="control-row"><kbd>W A S D</kbd><span>Move</span></div><div className="control-row"><kbd>MOUSE</kbd><span>Look / aim</span></div><div className="control-row"><kbd>SPACE</kbd><span>Jump</span></div><div className="control-row"><kbd>SHIFT</kbd><span>Sprint</span></div><div className="control-row"><kbd>CTRL</kbd><span>Crouch (hold)</span></div>{moreFun&&<div className="control-row"><kbd>C</kbd><span>Play dead / get up</span></div>}{hasLadders&&<div className="control-row"><kbd>W / S</kbd><span>Climb ladder</span></div>}</section>
   <section className="controls-section"><h3>Combat</h3><div className="control-row"><kbd>LEFT CLICK</kbd><span>Fire / knife slash</span></div><div className="control-row"><kbd>RIGHT CLICK</kbd><span>Sniper scope · 3× / 8×</span></div><div className="control-row"><kbd>R</kbd><span>Reload</span></div><div className="control-row"><kbd>4 + HOLD CLICK</kbd><span>Grenade · release to throw</span></div></section>
   <section className="controls-section"><h3>Weapons</h3><div className="control-row"><kbd>1</kbd><span>Knife</span></div><div className="control-row"><kbd>2</kbd><span>Pistol</span></div><div className="control-row"><kbd>3</kbd><span>Primary gun</span></div><div className="control-row"><kbd>Q</kbd><span>Switch pistol / primary</span></div></section>
   <section className="controls-section"><h3>Interaction</h3><div className="control-row"><kbd>E</kbd><span>{defusal?'Pick up / hold to defuse':'Pick up gun'}</span></div>{defusal&&<div className="control-row"><kbd>5 + HOLD CLICK</kbd><span>Plant C4 at {targetSite??'your target site'}</span></div>}<div className="control-row"><kbd>T</kbd><span>Spray · wall, floor, box or car</span></div><div className="control-row"><kbd>TAB</kbd><span>Scoreboard</span></div><div className="control-row"><kbd>ESC</kbd><span>Release mouse</span></div></section>
  </div>}
 </dialog>;
}
