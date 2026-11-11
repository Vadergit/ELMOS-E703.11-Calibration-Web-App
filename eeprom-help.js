'use strict';
/* Read-only explanations for the E703.11 64-word customer memory.
   Address spaces are deliberately separate: CM word index, CM byte address, and RAM register.
   Only documented bitfields are decoded. Never use this module to write to the sensor.
   References: E703.11 production data 25DS0170E.04, the app's existing CM/RAM mapping.
*/
const ELMOS_EEPROM_HELP=(()=>{
 const hex=(v,width=2)=>Number(v).toString(16).toUpperCase().padStart(width,'0');
 const signed=v=>(v&0x8000)?v-65536:v;
 const labels={
  0:'SER0',1:'SER1',2:'RATIO_DAC01',3:'RATIO_DAC23',4:'RATIO_DAC45',
  5:'ABS_V_DAC01',6:'ABS_V_DAC23',7:'ABS_V_DAC45',
  8:'ABS_I_DAC01',9:'ABS_I_DAC23',10:'ABS_I_DAC45',
  11:'G01',12:'G2OFF',13:'CFG_CAL0',14:'CFG_CAL1',15:'CRC8 factory',
  16:'CFG_EN',17:'CFG_SPI_I2C',18:'CFG_PADS0',19:'CFG_PADS1',
  20:'CFG_PADS2',21:'CFG_PERIOD',22:'CFG_AODO',
  27:'CFG_AFE0',28:'CFG_AFE1',29:'CFG_AFE2',30:'USER',
  31:'T_O',32:'T_F',33:'S_O',34:'S_F',
  55:'ALARM_LO',56:'ALARM_HI',57:'AODO_O',58:'AODO_F',
  59:'LIMIT_LO',60:'LIMIT_HI',61:'ERR_MASK',62:'ERR_VAL_HI_LO',63:'CRC16'
 };
 const info={
  0:['Seriennummer, unteres Wort','Unterer 16-Bit-Teil der werkseitigen Chip-Seriennummer. Zusammen mit SER1 und VERSION bildet er die 48-Bit-Chipkennung.'],
  1:['Seriennummer, oberes Wort','Oberer 16-Bit-Teil der werkseitigen Chip-Seriennummer. Nicht mit einer Kalibrierkonfiguration überschreiben.'],
  11:['Werkseitiger Verstärkungsabgleich','Werkseitiger Abgleich der analogen Verstärkung. Bedeutung der einzelnen Teilfelder wird hier bewusst nicht geraten.'],
  12:['Werkseitiger Gain-/Offset-Abgleich','Werkseitige Korrekturparameter des Sensor-Frontends. Keine freie Benutzerkonfiguration.'],
  13:['Werkseitige Kalibrierkonfiguration 0','Herstellerseitig abgelegte Kalibrierparameter. Die einzelnen Bits werden hier nicht frei interpretiert.'],
  14:['Werkseitige Kalibrierkonfiguration 1','Zusätzliche herstellerseitige Kalibrierparameter. Nur zur Diagnose lesen.'],
  15:['Prüfsumme des Werksbereichs','Enthält im oberen Byte die CRC8 über den geschützten Factory-Bereich. Bei einer vollständigen EEPROM-Lesung wird die Prüfsumme separat verifiziert.'],
  16:['Betriebsarten und Freigaben','Steuert unter anderem die AODO-Ausgangsart und die Skalierungsfreigabe scale_en. Nur dokumentierte Bits werden interpretiert.'],
  17:['Digitale Schnittstellen','Konfiguriert die digitalen Schnittstellen. Das bekannte Bit plc_en bestimmt, ob 1-Wire dauerhaft aktiv ist.'],
  18:['Startbedingungen und Pins','Enthält die dokumentierte Einstellung startup_plc für das zeitlich begrenzte 1-Wire-Startfenster.'],
  19:['1-Wire-Richtung und Zugriff','Bestimmt dokumentierte Freigaben für 1-Wire-Downstream, Upstream und dauerhaften Registerzugriff.'],
  20:['Weitere Pin-Konfiguration','Weitere Konfiguration der Pins. Einzelne Bitbelegungen werden hier ohne verifizierte Definition nicht aufgeschlüsselt.'],
  21:['Betriebs-/Periodenkonfiguration','Konfigurationswort für zeitliche Betriebsparameter. Ohne geprüfte Bitdefinition keine automatische Interpretation.'],
  22:['AODO-Ausgangsparameter','Konfiguration der analogen, PWM- oder FM-Ausgabe. Die Bedeutung des Rohwerts hängt von der aktiven Ausgangsart ab.'],
  27:['Analog-Frontend-Konfiguration 0','Weitere Einstellungen des analogen Frontends. Einzelne Bits sind hier nicht vollständig dokumentiert.'],
  28:['PGA1, Offset und PGA2','AFE-Einstellung der Druckmesskette. Enthält die erste Verstärkung, den Offset-DAC-Code und die zweite Verstärkung.'],
  29:['Analog-Frontend-Konfiguration 2','Weitere Einstellungen des analogen Frontends. Keine freie Bitinterpretation ohne Datenblattprüfung.'],
  30:['Benutzerwort','Benutzerbezogenes Konfigurationswort. Die Verwendung hängt vom Sensorprojekt ab.'],
  31:['Temperatur-Normierung: Offset','Offset für die Normierung des Temperatur-ADC-Werts vor der DSP-Temperaturkompensation.'],
  32:['Temperatur-Normierung: Faktor','Skalierungsfaktor für die Normierung des Temperatur-ADC-Werts vor der DSP-Temperaturkompensation.'],
  33:['Druck-Normierung: Offset','Offset für die Normierung des Druck-ADC-Werts vor dem Kalibrierpolynom.'],
  34:['Druck-Normierung: Faktor','Skalierungsfaktor für die Normierung des Druck-ADC-Werts vor dem Kalibrierpolynom.'],
  55:['Alarmgrenze, unterer Wert','Unterer Grenzwert für die Alarm-/Fehlerauswertung. Die Wirkung hängt von der übrigen Alarmkonfiguration ab.'],
  56:['Alarmgrenze, oberer Wert','Oberer Grenzwert für die Alarm-/Fehlerauswertung. Die Wirkung hängt von der übrigen Alarmkonfiguration ab.'],
  57:['Ausgangsskalierung: Offset','AODO_O verschiebt den DSP-Ausgangswert für die Ausgabe über AODO.'],
  58:['Ausgangsskalierung: Faktor','AODO_F skaliert den DSP-Ausgangswert für die Ausgabe über AODO.'],
  59:['Ausgangsbegrenzung, unten','Unterer Grenzwert der Ausgangsbegrenzung. Ein Rohwert allein beschreibt die tatsächliche Ausgabespannung nicht.'],
  60:['Ausgangsbegrenzung, oben','Oberer Grenzwert der Ausgangsbegrenzung. Die Wirkung hängt von der Konfiguration ab.'],
  61:['Maske für Fehlerbedingungen','Bitmaske für die Fehler-/Statusbehandlung. Ohne verifizierte Bitdefinition nur als Rohwert darstellen.'],
  62:['Fehlerreaktionswerte','Konfigurierter Reaktions-/Ersatzwert für Fehlerbedingungen. Einzelne Teilfelder bleiben hier unentschlüsselt.'],
  63:['EEPROM CRC16','CRC16 über die ersten 63 Wörter des EEPROM-Abbilds. Die Lesefunktion vergleicht die berechnete und gespeicherte Prüfsumme.']
 };
 const knownRam=index=>{
  if(index===0)return 0x50;
  if(index===1)return 0x52;
  if(index>=16&&index<=22)return 0x04+(index-16)*2;
  if(index>=27&&index<=29)return 0x1A+(index-27)*2;
  if(index>=31&&index<=62)return 0x6C+(index-31)*2;
  return null;
 };
 const format=index=>{
  if((index>=31&&index<=34)||index===57||index===58)return 'Q3.12';
  if((index>=35&&index<=54))return 'Q0.15';
  if([16,17,18,19,20,21,22,27,28,29,61,62].includes(index))return 'Bitfeld/Rohwert';
  return '16-Bit-Rohwert';
 };
 const namesFor=index=>labels[index]||(index>=35&&index<=50?'S'+(index-35):index>=51&&index<=54?'T'+(index-51):'CM_W'+index);
 const bitsFor=(index,value)=>{
  const item=(bits,name,raw,meaning)=>({bits,name,raw,meaning});
  if(index===16){
   const mode=(value>>>9)&7,modeNames=['High-Z','Analog, DAC-Korrektur 0','Analog, DAC-Korrektur 1','Analog, DAC-Korrektur 2','PWM','FM','Alarm','SDA'];
   return [item('11:9','aodo_en',mode,modeNames[mode]),item('6','scale_en',(value>>>6)&1,(value&64)?'Skalierung aktiviert':'Skalierung deaktiviert')];
  }
  if(index===17)return [item('2','plc_en',(value>>>2)&1,(value&4)?'1-Wire dauerhaft aktiviert':'Kein dauerhafter 1-Wire-Betrieb durch plc_en')];
  if(index===18){
   const v=(value>>>12)&3;
   return [item('13:12','startup_plc',v,['4 ms','10 ms','200 ms','Kein 1-Wire-Startfenster'][v])];
  }
  if(index===19)return [
   item('11','plc_downsel',(value>>>11)&1,(value&0x800)?'Downstream freigegeben':'Downstream deaktiviert'),
   item('8','plc_rw_en',(value>>>8)&1,(value&0x100)?'Persistenter Registerzugriff freigegeben':'Kein persistenter Registerzugriff'),
   item('7','plc_us_en',(value>>>7)&1,(value&0x80)?'Upstream freigegeben':'Upstream deaktiviert')
  ];
  if(index===28){
   const p1=value&3,p2=(value>>>7)&15,c=(value>>>2)&31,offset=c===0?0:c>=1&&c<=8?c:c>=17&&c<=24?16-c:null;
   const pga1=[3.5,6,8.5,11],pga2=[2,2.22,2.5,2.86,3.33,4,5,6.67,10];
   return [
    item('1:0','PGA1',p1,pga1[p1]+'×'),
    item('6:2','Offset-DAC',c,offset===null?'Ungültiger/undokumentierter Code':'Offset-Stufe '+offset),
    item('10:7','PGA2',p2,pga2[p2]===undefined?'Ungültiger/undokumentierter Code':pga2[p2]+'×'),
    item('11','Pflichtbit', (value>>>11)&1,(value&0x800)?'Gesetzt':'Nicht gesetzt – beim Schreiben gesperrt')
   ];
  }
  return [];
 };
 function describe(index,value){
  if(!Number.isInteger(index)||index<0||index>=64)throw Error('EEPROM-Wortindex ausserhalb 0–63');
  if(!Number.isInteger(value)||value<0||value>65535)throw Error('EEPROM-Wort muss 16 Bit ohne Vorzeichen sein');
  const name=namesFor(index),word=hex(index),byte=hex(index*2),ram=knownRam(index),fmt=format(index),n=signed(value);
  let short,description;
  if(index>=2&&index<=4){
   short='Werksabgleich ratiometrischer DAC';
   description='Werkseitig gespeicherte Korrekturdaten der ratiometrischen Ausgangsstufe; keine frei programmierbaren Sensorparameter.';
  }else if(index>=5&&index<=7){
   short='Werksabgleich Spannungs-DAC';
   description='Herstellerseitige Korrekturdaten des absoluten Spannungs-DAC. Bei E703.11 keine frei verfügbare 0–10-V-Ausgangsoption.';
  }else if(index>=8&&index<=10){
   short='Werksabgleich Strom-DAC';
   description='Herstellerseitige Korrekturdaten der absoluten Stromausgabe. Nicht als 4–20-mA-Ausgangsfunktion des E703.11 interpretieren.';
  }else if(index>=23&&index<=26){
   short='Nicht aufgeschlüsseltes CM-Wort';
   description='Kein ausreichend verifizierter Registername bzw. keine verifizierte Bitfeldbeschreibung vorhanden. Rohwert nur lesend anzeigen.';
  }else if(index>=35&&index<=50){
   const k=index-35,orderS=Math.floor(k/4),orderT=k%4;
   short='Druckkalibrierung: Polynomkoeffizient';
   description='DSP-Koeffizient S'+k+' für den Term normierter Druck hoch '+orderS+' × normierte Temperatur hoch '+orderT+'. Nicht benötigte Terme können Null sein.';
  }else if(index>=51&&index<=54){
   short='Temperaturkompensation: Koeffizient';
   description='DSP-Koeffizient T'+(index-51)+' im Temperaturpolynom, Potenz '+(index-51)+' der normierten Temperatur.';
  }else{
   [short,description]=info[index]||['Nicht aufgeschlüsseltes CM-Wort','Für dieses EEPROM-Wort ist keine verifizierte Funktionsbeschreibung verfügbar.'];
  }
  const interpreted=fmt==='Q3.12'||fmt==='Q0.15'?(n/(fmt==='Q3.12'?4096:32768)).toFixed(7):null;
  const formula=index===57||index===58?'DSP_AODO = AODO_F × DSP_S + AODO_O':
   index===33||index===34?'S_norm = S_F × ADC_S_norm + S_O':
   index===31||index===32?'T_norm = T_F × ADC_T_norm + T_O':
   (index>=35&&index<=50)?'DSP_S = Σ S[i,j] × S_norm^i × T_norm^j':
   (index>=51&&index<=54)?'T-DSP = Σ T[i] × T_norm^i':null;
  const fields=bitsFor(index,value);
  const search=[word,'0x'+word,byte,'0x'+byte,name,short,description,'0x'+hex(value,4),n,fmt,ram===null?'':'0x'+hex(ram),...fields.flatMap(x=>[x.name,x.meaning])].join(' ').toLowerCase();
  return {index,name,wordHex:'0x'+word,byteHex:'0x'+byte,ramHex:ram===null?null:'0x'+hex(ram),
   short,description,format:fmt,unsigned:value,signed:n,rawHex:'0x'+hex(value,4),
   interpreted,formula,fields,binary:value.toString(2).padStart(16,'0').replace(/(.{4})(?=.)/g,'$1 '),
   search,protection:index<16?'Factory · nur lesen':index<28?'Boot/Konfig · geschützt':index===63?'CRC16':'User-NVM · geschützt'};
 }
 return {describe,namesFor,knownRam};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=ELMOS_EEPROM_HELP;
