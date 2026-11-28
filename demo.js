'use strict';

const ELMOS_DEMO = {
 create(protocol, calibration, readStimulus) {
  const bootRegisters = [[16, 4], [17, 6], [18, 8], [19, 10], [20, 12], [22, 16], [calibration.SVDD_INDEX, 0x1A]];
  const nvm = Array(64).fill(0);
  nvm[0] = 0xDE01;
  nvm[1] = 0x600D;
  nvm[16] = typeof window!=='undefined'&&window.ELMOS_PTC_DEV?0x0212:0x0200;
  nvm[18] = 2 << 12;
  nvm[19] = 0x0980;
  nvm[calibration.SVDD_INDEX] = typeof window!=='undefined'&&window.ELMOS_PTC_DEV?0x0C42:0x0C40;
  if(typeof window!=='undefined'&&window.ELMOS_PTC_DEV){nvm[28]=0x0800;nvm[29]=0x1154;}
  nvm[15] = calibration.crc8(nvm) << 8;
  nvm[63] = calibration.crc16(nvm);

  const ram = new Map([[0x1C, 0x0800], [0x38, 0x0703], [0x50, nvm[0]], [0x52, nvm[1]]]);
  let opened = false;
  let readback = 0;
  let pendingWord = 0;
  let writeEnabled = false;
  let pressure;
  let temperature = 25;
  let ptc=null;
  const dev=typeof window!=='undefined'&&window.ELMOS_PTC_DEV===true;
  if(dev)bootRegisters.push([28,0x1C],[29,0x1E],[31,0x6C],[32,0x6E],[33,0x70],[34,0x72],...Array.from({length:16},(_,i)=>[35+i,0x74+2*i]),...Array.from({length:4},(_,i)=>[51+i,0x94+2*i]));
  const word = value => Math.max(-32768, Math.min(32767, Math.round(value))) & 0xFFFF;

  function reboot() {
   for (const [index, address] of bootRegisters) ram.set(address, nvm[index]);
   writeEnabled = false;
  }
  reboot();

  function read(address) {
   const {lower, upper, limit} = readStimulus();
   const span = upper - lower;
   const fraction = span > 0 ? ((pressure ?? (lower + upper) / 2) - lower) / span : 0.5;
   const gain = protocol.decAFE(ram.get(0x1C));
   if(dev&&ptc){
    const a=ELMOS_TEMPERATURE_AFE,v=a.SUPPLIES[(ram.get(0x1A)||0)&3],code=((ram.get(0x1A)||0)>>4)&15;
    const b=ptc.bridgeOhm*(1+(temperature-25)*(temperature<25?120:180)/1e6),p=ptc.parallelOhm*(1+(temperature-25)*ptc.ptcTcr/1e6);
    const t=ptc.source==='external'?ELMOS_EXTERNAL_AFE.signal(ELMOS_EXTERNAL_AFE.voltage(ptc,temperature),((ram.get(0x1E)||0)>>2)&3,((ram.get(0x1E)||0)>>4)&3):a.signal({resistanceOhm:a.equivalent(b,p),svdd:v,code}).adc;
    const s=(gain.bridgeInvert?-1:1)*(fraction-.5)*20000*(1+gain.pga1*.25+gain.pga2*.12)*(1+(temperature-25)*ptc.tke/1e6)+gain.offset*750+(temperature-25)*ptc.tk0;
    if(address===0x26)return word((temperature-25)*100);
    if(address===0x28)return word(t);
    if(address===0x2A)return word(s);
    if((address===0x30||address===0x2E)&&(ram.get(0x72)||0)){
     const q=(addr,bits)=>calibration.fromQ(ram.get(addr)||0,bits);
     const ns=q(0x72,12)*(word(s)>=32768?word(s)-65536:word(s))/32768+q(0x70,12),nt=q(0x6E,12)*(word(t)>=32768?word(t)-65536:word(t))/32768+q(0x6C,12);
     let value=0;
     if(address===0x30){for(let i=0;i<16;i++)value+=q(0x74+2*i,15)*ns**Math.floor(i/4)*nt**(i%4);}
     else {for(let i=0;i<4;i++)value+=q(0x94+2*i,15)*nt**i;}
     return word(value*32768);
    }
   }
   switch (address) {
    case 0x26:
    case 0x28:
    case 0x2E: return word(387.88 * temperature - 16485);
    case 0x2A: return word((gain.bridgeInvert?-1:1) * (fraction - 0.5) * 20000 * (1 + gain.pga1 * 0.25 + gain.pga2 * 0.12) + gain.offset * 750);
    case 0x30: return word((2 * fraction - 1) * limit);
    case 0x46: return writeEnabled ? 8 : 0;
    case 0x48: return readback;
    default: return ram.get(address) ?? 0;
   }
  }

  function write(address, value) {
   if (address === 0x4A) {
    pendingWord = value;
   } else if (address === 0x4E) {
    const index = (value & 0xFF) >> 1;
    if ((value >> 8) === 0x4C && index < 64) readback = nvm[index];
    else if ((value >> 8) === 0xA3 && index >= 16 && index < 64 && writeEnabled) nvm[index] = pendingWord;
    else if (value === 0x36D8) writeEnabled = true;
    else if (value === 0) writeEnabled = false;
   } else {
    ram.set(address, value);
   }
  }

  return {
   async open() { opened = true; },
   async close() { opened = false; },
   setReference(value, temp = temperature) { pressure = value; temperature = temp; },
   ptcConfigured(source){return !!ptc&&(!source||(ptc.source||'bridge')===source);},
   ptcWords(){return {afe0:ram.get(0x1A),afe2:ram.get(0x1E),cfgEn:ram.get(4)};},
   setPtcProfile(profile,code){
    if(!dev)throw Error('Nur DEV-Simulation');
    ptc={...profile,source:'bridge'};const words=ELMOS_TEMPERATURE_AFE.merge({afe0:ram.get(0x1A)||0,afe2:ram.get(0x1E)||0,cfgEn:ram.get(4)||0,code,svddCode:profile.svddCode});
    ram.set(0x1A,words.afe0);ram.set(0x1E,words.afe2);ram.set(4,words.cfgEn);
    for(const addr of [0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A])ram.set(addr,0);
   },
   setExternalProfile(profile,gain){
    if(!dev)throw Error('Nur DEV-Simulation');
    const best=ELMOS_EXTERNAL_AFE.plan(profile).best;
    if(!best||best.i!==gain.i||best.j!==gain.j)throw Error('Ungültige externe AFE-Auswahl.');
    ptc={...profile,source:'external'};ram.set(0x1E,ELMOS_EXTERNAL_AFE.merge(ram.get(0x1E)||0,profile,gain));ram.set(4,((ram.get(4)||0)&~0x100c)|0x1004);
    for(const addr of [0x6C,0x6E,0x70,0x72,...Array.from({length:16},(_,i)=>0x74+2*i),0x94,0x96,0x98,0x9A])ram.set(addr,0);
   },
   clearPtcProfile(){if(dev){ptc=null;ram.set(0x1A,nvm[27]);ram.set(0x1E,nvm[29]);ram.set(4,nvm[16]);}},

   reboot,
   exchange(command) {
    if (!opened) throw Error('Demo-Verbindung ist geschlossen');
    const reply = value => value + '\r\n:\r\n';
    if (command === '.VERSION') return reply('ELMOS Demo');
    if (['IF_CFG 7 0 0', 'PLC P', 'PLC T'].includes(command)) return reply('# OK');
    const frame = /^PLC 02(6[CD])([0-9A-F]{2})([0-9A-F]{2})(\.|[0-9A-F]{6})$/.exec(command);
    if (!frame) throw Error('Unbekannter Demo-Befehl: ' + command);
    const address = parseInt(frame[2], 16);
    if (frame[1] === '6D') {
     const value = read(address);
     const bytes = [value >> 8, value & 0xFF];
     const crc = protocol.crc8PLC([address, parseInt(frame[3],16), 2, ...bytes]);
     return reply([...bytes, crc].map(byte => protocol.hx(byte)).join(' '));
    }
    write(address, parseInt(frame[4].slice(0, 4), 16));
    return reply('# OK');
   }
  };
 }
};
