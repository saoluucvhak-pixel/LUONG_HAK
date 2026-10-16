'use strict';
// Presentation-only decimal formatter. Accepts decimal strings or BigInt to avoid IEEE-754 precision loss.
// Input convention: ungrouped ASCII decimal, dot as decimal separator. No exponent notation.
function formatExact(value,{digits=2,mode='decimal',trimTrailingZeros=false}={}){
 if(!Number.isInteger(digits)||digits<0||digits>6||!['integer','decimal'].includes(mode))throw RangeError('Invalid precision');
 if(typeof value==='bigint')value=value.toString();
 if(typeof value!=='string'||!/^[+-]?\d+(?:\.\d+)?$/.test(value))throw TypeError('Expected ungrouped decimal string or bigint');
 const negative=value.startsWith('-');const clean=value.replace(/^[+-]/,'');let [whole,fraction='']=clean.split('.');
 const places=mode==='integer'?0:digits;
 const next=fraction[places]||'0';
 let kept=fraction.slice(0,places).padEnd(places,'0');
 // half-up rounding on decimal digits; rounding policy is display-only.
 if(next>='5'){
  let n=(BigInt(whole+kept||'0')+1n).toString().padStart(whole.length+places,'0');
  whole=places?n.slice(0,-places):n;kept=places?n.slice(-places):'';
 }
 whole=whole.replace(/^0+(?=\d)/,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
 if(trimTrailingZeros)kept=kept.replace(/0+$/,'');
 const zero=/^0+$/.test(whole.replace(/\./g,''))&&!/[1-9]/.test(kept);
 return (negative&&!zero?'-':'')+whole+(kept?','+kept:'');
}
module.exports={formatExact};
