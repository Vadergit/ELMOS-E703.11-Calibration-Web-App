'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

test('shared bridge discovers high Elmos CRC addresses and rejects invalid identity/CRC', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'elmos-i2c-test-'));
  try {
    fs.writeFileSync(path.join(directory, 'Wire.h'), `
#pragma once
#include <cstdint>
#include <cstddef>
#include <vector>
#include <map>
constexpr int OUTPUT=1;
inline void delay(int) {}
inline void digitalWrite(int,int) {}
inline void pinMode(int,int) {}
constexpr int LOW=0,HIGH=1;
struct FakeWire {
  std::map<uint8_t,uint16_t> devices;
  bool badCrc=false;
  uint8_t address=0,reg=0,control=0;
  std::vector<uint8_t> tx,rx;
  void end() {}
  void begin() {}
  void setClock(int) {}
  void setWireTimeout(int,bool) {}
  void beginTransmission(uint8_t a) {address=a;tx.clear();}
  size_t write(uint8_t b) {tx.push_back(b);return 1;}
  size_t write(const uint8_t *p,size_t n) {tx.insert(tx.end(),p,p+n);return n;}
  uint8_t endTransmission(bool=true) {
    if(!devices.count(address))return 2;
    reg=tx.at(0);control=tx.at(1);return 0;
  }
  uint8_t requestFrom(uint8_t a,uint8_t,uint8_t) {
    uint16_t word=reg==0x38?devices[a]:reg==0x06?uint16_t(((a&0x7E)<<8)|2):0x1234;
    uint8_t low=word,high=word>>8,crc=0xFF;
    for(uint8_t b:std::vector<uint8_t>{uint8_t(a<<1),reg,control,uint8_t((a<<1)|1),low,high}) {
      crc^=b;
      for(int i=0;i<8;++i)crc=uint8_t((crc<<1)^((crc&0x80)?0xD5:0));
    }
    rx={low,high,uint8_t(crc^(badCrc?1:0))};return 3;
  }
  int read() {int b=rx.front();rx.erase(rx.begin());return b;}
};
inline FakeWire Wire;
`);
    const header = path.resolve(__dirname, '../firmware/libraries/ElmosI2c/src/ElmosI2c.h');
    fs.writeFileSync(path.join(directory, 'test.cpp'), `
#define __AVR_ATmega32U4__ 1
#include <cassert>
#include <cstring>
namespace plc {
constexpr uint8_t crc(uint8_t state,uint8_t byte,unsigned bits,unsigned width,uint8_t polynomial) {
  for(unsigned i=0;i<bits;++i) {
    bool bit=((state>>(width-1))^(byte>>(7-i)))&1;
    state=uint8_t((state<<1)^(bit?polynomial:0));
  }
  return state&((1u<<width)-1);
}
inline void configurePins() {}
}
#include "${header}"
int main() {
 for(uint8_t address:{0x6D,0x79,0x7B,0x7D,0x7F}) {
   Wire.devices={{address,0x0020}};Wire.badCrc=false;
   assert(elmosI2c::connect(false)==nullptr);
   assert(elmosI2c::slave==address);
 }
 Wire.devices={{0x7D,0x0020}};Wire.badCrc=true;
 assert(elmosI2c::connect(false)!=nullptr && elmosI2c::slave==0);
 Wire.badCrc=false;Wire.devices={{0x7D,0xFFFF}};
 assert(elmosI2c::connect(false)!=nullptr && elmosI2c::slave==0);
 Wire.devices={{0x7B,0x0020},{0x7D,0x0020}};
 assert(std::strcmp(elmosI2c::connect(false),"!BRIDGE I2C_MULTIPLE_SENSORS")==0);
 assert(elmosI2c::slave==0);
}
`);
    const binary = path.join(directory, 'test');
    execFileSync(process.env.CXX || 'c++', ['-std=c++17', '-include', 'cstdint',
      '-I', directory, path.join(directory, 'test.cpp'), '-o', binary]);
    assert.doesNotThrow(() => execFileSync(binary));
  } finally {
    fs.rmSync(directory, {recursive:true, force:true});
  }
});
