#pragma once

#include <Wire.h>


namespace elmosI2c {
#if !defined(__AVR_ATmega32U4__)
constexpr int Sda = 6;
constexpr int Scl = 7;
#endif
constexpr uint8_t DefaultAddress = 0x6D; // 7-bit address for CRC frames
inline uint8_t slave = 0;

constexpr uint8_t header(uint8_t reg, uint8_t lengthField) {
  using plc::crc;
  // The Elmos vectors cover register and length with CRC4. CRC8 also covers the bus address.
  return lengthField | crc(crc(0x0F, reg, 8, 4, 0x03), lengthField, 4, 4, 0x03);
}

template <size_t N>
constexpr uint8_t checksum(const uint8_t (&bytes)[N]) {
  uint8_t state = 0xFF;
  for (uint8_t byte : bytes) state = plc::crc(state, byte, 8, 8, 0xD5);
  return state;
}

// E703.11 25DS0170E.04, chapter 6.4.3.3.
static_assert(header(0x2E, 0x30) == 0x31);
static_assert(header(0x36, 0x10) == 0x16);
static_assert(checksum<5>({0xDA, 0x36, 0x16, 0x9E, 0xCF}) == 0xA1);
static_assert(checksum<8>({0xDA, 0x2E, 0x31, 0xDB, 0xF2, 0x7D, 0xEA, 0x82}) == 0xE4);

inline const char *readWord(uint8_t device, uint8_t reg, uint16_t &word) {
  const uint8_t writeAddress = device << 1;
  const uint8_t control = header(reg, 0x10);
  Wire.beginTransmission(device);
  Wire.write(reg);
  Wire.write(control);
  // Arduino-ESP32 defers this write until requestFrom executes the combined
  // transaction. A failed address/header or short read gives no usable word.
  if (Wire.endTransmission(false)) return "!BRIDGE I2C_NO_REPLY";
#if defined(__AVR_ATmega32U4__)
  const auto received = Wire.requestFrom(device, uint8_t(3), uint8_t(true));
#else
  const auto received = Wire.requestFrom(device, size_t(3), true);
#endif
  if (received != 3) return "!BRIDGE I2C_NO_REPLY";
  const uint8_t low = Wire.read();
  const uint8_t high = Wire.read();
  const uint8_t rxCrc = Wire.read();
  const uint8_t bytes[] = {writeAddress, reg, control, uint8_t(writeAddress | 1), low, high};
  if (rxCrc != checksum(bytes)) return "!BRIDGE I2C_BAD_CRC";
  word = uint16_t(high) << 8 | low;
  return nullptr;
}

inline const char *writeWord(uint8_t reg, uint16_t word) {
  const uint8_t address = slave << 1;
  const uint8_t control = header(reg, 0x10);
  const uint8_t bytes[] = {address, reg, control, uint8_t(word), uint8_t(word >> 8)};
  Wire.beginTransmission(slave);
  Wire.write(bytes + 1, sizeof(bytes) - 1);
  Wire.write(checksum(bytes));
  return Wire.endTransmission() ? "!BRIDGE I2C_WRITE_FAILED" : nullptr;
}

inline bool probe(uint8_t device) {
  uint16_t version, cfg, ser0, ser1;
  if (readWord(device, 0x38, version) || (version & 0xFFF8) != 0x0020 ||
      readWord(device, 0x06, cfg)) return false;
  const uint8_t mode = cfg & 3;
  const uint8_t address = (cfg >> 8) & 0x7E;
  if ((mode != 1 && mode != 2) ||
      (device & (mode == 1 ? 0x7C : 0x7E)) != (address & (mode == 1 ? 0x7C : 0x7E)))
    return false;
  return !readWord(device, 0x50, ser0) && !readWord(device, 0x52, ser1) &&
         (ser0 || ser1) && !(ser0 == 0xFFFF && ser1 == 0xFFFF);
}

inline const char *connect(bool powerCycle) {
  slave = 0;
  Wire.end();
  plc::configurePins();
  if (powerCycle) {
#if defined(__AVR_ATmega32U4__)
    digitalWrite(7, LOW);
    pinMode(7, OUTPUT);
    delay(100);
    digitalWrite(7, HIGH);
#else
    plc::powerOffBeforeStart();
    gpio_set_level(plc::Power, 1);
#endif
    delay(100);
  }
#if defined(__AVR_ATmega32U4__)
  // The ATmega32U4 hardware TWI pins are D2 (SDA) and D3 (SCL).
  Wire.begin();
  Wire.setClock(100000);
  Wire.setWireTimeout(15000, true);
#else
  if (!Wire.begin(Sda, Scl, 100000)) return "!BRIDGE I2C_INIT_FAILED";
  Wire.setTimeOut(15);
#endif
  if (probe(DefaultAddress)) {
    slave = DefaultAddress;
    return nullptr;
  }
  for (uint8_t device = 0x09; device < 0x78; device += 2) {
    if (device != DefaultAddress && probe(device)) {
      if (slave) {
        slave = 0;
        return "!BRIDGE I2C_MULTIPLE_SENSORS";
      }
      slave = device;
    }
  }
  return slave ? nullptr : "!BRIDGE I2C_SENSOR_NOT_FOUND";
}
}
