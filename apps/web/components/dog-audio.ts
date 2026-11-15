/** Two short, breathy barks, pitched above the much larger ambient creatures. */
export function dogBarkSignal(rate:number){
 const out=new Float32Array(Math.ceil(rate*.48));let seed=82391,noise=0,phase=0;
 for(let i=0;i<out.length;i++){const t=i/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise+=.24*(seed/2147483648-1-noise);const at=t<.22?t:t-.25,env=at<0?0:(1-Math.exp(-at*350))*Math.exp(-at*24);phase+=Math.PI*2*(210+70*Math.exp(-Math.max(at,0)*18))/rate;out[i]=Math.tanh((Math.sin(phase)*.35+Math.sin(phase*2.13)*.16+noise*.8)*env)*.65;}
 out[0]=out[out.length-1]=0;return out;
}
