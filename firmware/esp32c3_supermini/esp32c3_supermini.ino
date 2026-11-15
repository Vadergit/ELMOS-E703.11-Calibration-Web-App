/*
  ELMOS E703.11 · ESP32-C3 SuperMini USB bridge for One-Wire and I2C register access
  ======================================================
  Board: ESP32-C3 SuperMini (ESP32-C3 with native USB Serial/JTAG)
  Arduino IDE: ESP32 by Espressif Systems
  Board: "ESP32C3 Dev Module"
  Tools > USB CDC On Boot > Enabled
  Port: the native USB-C device, not an external UART adapter
  Serial monitor: 115200 baud, close it before Chrome/Web Serial.

  Connect GPIO 4/5/6 through an external AODO transceiver.
  A pull-down on its active-high OE keeps it off during reset.
  GPIO18/19 are reserved for USB. Optional GPIO10 controls a sensor load switch.
*/
#include <Arduino.h>
#include <string.h>
#include "plc_read.h"
#include <ElmosI2c.h>

#if !defined(CONFIG_IDF_TARGET_ESP32C3)
#error "This sketch is specifically for ESP32-C3 SuperMini. Select ESP32C3 Dev Module."
#endif

// Select Tools > USB CDC On Boot > Enabled, otherwise Serial may be UART0.
#if defined(ARDUINO_USB_CDC_ON_BOOT) && !ARDUINO_USB_CDC_ON_BOOT
#warning "Enable USB CDC On Boot for native USB communication in Arduino IDE."
#endif

static char lineBuffer[96];
static size_t lineLength = 0;
static uint32_t requests = 0;
static unsigned plcBaud = 100000;
static uint8_t activeSlave = plc::ReadAddress;
static bool recoveryUsed = false;
static bool coldStartVerified = false;
static bool nvmArmed = false;
static bool i2cMode = false;

static void answer(const char *message) {
  // Same line-terminator as the existing SSP3-oriented Web Serial parser.
  // Let USB Serial/JTAG service frames after PLC bit timing masked interrupts.
  delay(2);
  Serial.printf("%s\r\n:\r\n", message);
}

static void printUid(unsigned baud) {
  constexpr uint8_t addresses[] = {0x38, 0x52, 0x50};
  uint16_t words[3];
  for (unsigned i = 0; i < 3; ++i) {
    if (const char *error = plc::readWord(addresses[i], baud, words[i], nullptr, activeSlave)) {
      answer(error);
      return;
    }
  }
  Serial.printf("# E70311 UID=%04X%04X%04X\r\n:\r\n",
                static_cast<unsigned>(words[0]), static_cast<unsigned>(words[1]),
                static_cast<unsigned>(words[2]));
  Serial.flush();
}

static int hexDigit(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
}

static bool allowedWrite(uint8_t address, uint16_t word) {
  if (address == 0x14 || address == 0x16 || address == 0x18) return true;
  if (address == 0x1A || address == 0x1C) return true;
  if (address == 0x22) return word == 0x8B93;
  if (address >= 0x6C && address <= 0x9A) return true;
  if (address == 0x4A) return nvmArmed;
  if (address != 0x4E) return false;
  if ((word & 0xFF81) == 0x4C00) return true;
  if (!nvmArmed) return false;
  if (word == 0x98BD || word == 0x25BF || word == 0x36D8 || word == 0 || word == 0x8800) return true;
  const unsigned index = (word & 0xFF) >> 1;
  return (word & 0xFF81) == 0xA300 &&
         (index == 28 || (index >= 30 && index <= 54) || index == 63);
}

static void plcFrame(const char *hex) {
  const size_t length = strlen(hex);
  const bool read = length == 9 && hex[8] == '.';
  if (!read && length != 14) {
    answer("!BRIDGE PLC_BAD_LENGTH");
    return;
  }
  uint8_t frame[7];
  for (size_t i = 0; i < length / 2; ++i) {
    const int high = hexDigit(hex[2 * i]), low = hexDigit(hex[2 * i + 1]);
    if (high < 0 || low < 0) {
      answer("!BRIDGE PLC_BAD_HEX");
      return;
    }
    frame[i] = (high << 4) | low;
  }
  const uint8_t address = frame[2], header = frame[3];
  const uint8_t slave = frame[1] | 1;
  if (frame[0] != plc::Preamble || (frame[1] & 1) != read ||
      (slave != 0x6D && slave != 0x7D) || (address & 1) ||
      header != plc::readHeader(address, slave)) {
    answer("!BRIDGE PLC_BAD_HEADER");
    return;
  }
  if (read) {
    uint16_t word;
    uint8_t checksum;
    if (const char *error = plc::readWord(address, plcBaud, word, &checksum, slave)) {
      answer(error);
      return;
    }
    char response[9];
    snprintf(response, sizeof(response), "%02X %02X %02X",
             unsigned(word >> 8), unsigned(word & 0xFF), unsigned(checksum));
    answer(response);
    return;
  }
  const uint16_t word = (uint16_t(frame[4]) << 8) | frame[5];
  if (frame[6] != plc::writeCrc(address, header, frame[4], frame[5])) {
    answer("!BRIDGE PLC_BAD_CRC");
    return;
  }
  if (slave != activeSlave || !allowedWrite(address, word)) {
    answer("!BRIDGE PLC_WRITE_DENIED");
    return;
  }
  plc::writeWord(address, word, plcBaud, false, false, slave);
  answer("# PLC FRAME SENT");
}

static const char *probeAtRate(uint8_t slave, unsigned baud) {
  uint16_t afe, adc, cfg, pads;
  if (const char *e = plc::readWord(0x1C, baud, afe, nullptr, slave)) return e;
  if (!afe) return "!BRIDGE PLC_NO_VALID_FRAME";
  if (const char *e = plc::readWord(0x2A, baud, adc, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x06, baud, cfg, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x0A, baud, pads, nullptr, slave)) return e;
  const uint8_t configured = ((cfg >> 8) & 0x7E) | ((pads & 0x1000) ? 0x80 : 0) | 1;
  if (configured != slave) return "!BRIDGE PLC_ADDRESS_MISMATCH";
  activeSlave = slave;
  return nullptr;
}

static const char *probe(uint8_t slave) {
  return probeAtRate(slave, plcBaud);
}

// The startup cookie can leave CFG_PERIOD set to its second frame.
static const char *startContinuousAfterCookie() {
  uint16_t period;
  if (const char *error = plc::readWord(0x0E, plcBaud, period, nullptr, activeSlave))
    return error;
  if (period != 0x5CFD) return nullptr;
  plc::writeWord(0x0E, 0x0001, plcBaud, false, false, activeSlave);
  if (const char *error = plc::readWord(0x0E, plcBaud, period, nullptr, activeSlave))
    return error;
  if (period != 0x0001) return "!BRIDGE PLC_PERIOD_READBACK_FAILED";
  plc::writeWord(0x22, 0x8B93, plcBaud, false, false, activeSlave);
  return nullptr;
}

static const char *probeAddresses() {
  const char *error = probe(activeSlave);
  if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0)
    error = probe(activeSlave == 0x6D ? 0x7D : 0x6D);
  return error;
}

static const char *openPlcAccess(bool powerCycle, bool recover = false) {
  nvmArmed = false;
  if (powerCycle) {
    coldStartVerified = false;
    recoveryUsed = false;
  }
  const char *error = nullptr;
  if (powerCycle && recover) {
    // Replay the broadcast sequence captured from the SSP3 before falling back
    // to the existing address-specific start at the selected rate.
    constexpr unsigned ssp3Rate = 187500;
    constexpr uint8_t first[] = {0x02, 0xFE, 0xAC, 0x1C, 0x2B, 0x42, 0x86};
    constexpr uint8_t second[] = {0x02, 0xFE, 0x0E, 0x1A, 0x5C, 0xFD, 0xD5};
    plc::powerOffBeforeStart();
    plc::transfer(first, sizeof(first), ssp3Rate, nullptr, 0, true, false);
    plc::transfer(second, sizeof(second), ssp3Rate, nullptr, 0, false, true);
    plc::transfer(plc::PsscRamAccess, sizeof(plc::PsscRamAccess), ssp3Rate, nullptr, 0, false, true);
    recoveryUsed = true;
    error = probeAtRate(0x6D, ssp3Rate);
    if (!error) plcBaud = ssp3Rate;
    else {
      plc::enableAccess(plcBaud, true, true);
      error = probe(0x6D);
    }
  } else if (recover) {
    // Mark the session before attempting the write, including on a lost reply.
    recoveryUsed = true;
    plc::enableAccess(plcBaud, powerCycle, true);
    error = probe(0x6D);
  } else {
    if (powerCycle) plc::enableAccess(plcBaud, true, false);
    error = probeAddresses();
    if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0) {
      plc::enableAccess(plcBaud, false, false, 0x6D);
      error = probe(0x6D);
      if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0) {
        plc::enableAccess(plcBaud, powerCycle, false, 0x7D);
        error = probe(0x7D);
      }
    }
  }
  if (!error) error = startContinuousAfterCookie();
  return error;
}

static void establishAccess(bool powerCycle, bool recover = false) {
  if (const char *error = openPlcAccess(powerCycle, recover)) {
    answer(error);
    return;
  }
  if (powerCycle) coldStartVerified = true;
  char response[40];
  snprintf(response, sizeof(response), "# PLC ACCESS ADDR=%02X RAM_RECOVERY=%u",
           unsigned(activeSlave & 0xFE), unsigned(recoveryUsed));
  answer(response);
}

// Report received transitions after releasing the external driver. Read-only.
static void diagnoseRx() {
  for (const uint8_t slave : {uint8_t(0x6D), uint8_t(0x7D)}) {
    uint16_t word = 0;
    size_t edges = 0;
    bool initial = false;
    uint8_t echo = 0;
    const char *error = plc::readWord(0x1C, plcBaud, word, nullptr, slave, &edges, &initial, &echo);
    delay(2);
    Serial.printf("# RX %u kBd ADDR=%02X GPIO%u=%u ECHO=%s EDGES=%u RESULT=%s WORD=%04X\r\n",
                  plcBaud / 1000, unsigned(slave & 0xFE), unsigned(plc::singlePin ? plc::Tx : plc::Rx), unsigned(initial),
                  echo == 3 ? "BOTH" : echo == 2 ? "HIGH" : "LOW", unsigned(edges), error ? error + 8 : "CRC_OK", unsigned(word));
  }
  Serial.print(":\r\n");
}

// Some AODO sensors boot with SPI/I2C disabled. Only change the interface
// selector for this session, after confirming the chip over One-Wire.
static const char *activateI2cThroughPlc() {
  Wire.end();
  plc::configurePins();
  const char *error = openPlcAccess(true);
  if (error && !strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME"))
    error = openPlcAccess(true, true);
  if (error) return error;
  uint16_t version, ser0, ser1, config, verified;
  if (plc::readWord(0x38, plcBaud, version, nullptr, activeSlave) ||
      plc::readWord(0x50, plcBaud, ser0, nullptr, activeSlave) ||
      plc::readWord(0x52, plcBaud, ser1, nullptr, activeSlave) ||
      (version & 0xFFF8) != 0x0020 || !(ser0 || ser1) || (ser0 == 0xFFFF && ser1 == 0xFFFF) ||
      plc::readWord(0x06, plcBaud, config, nullptr, activeSlave))
    return "!BRIDGE I2C_PLC_IDENTITY_UNVERIFIED";
  if ((config & 3) == 1 || (config & 3) == 2)
    return "!BRIDGE I2C_SENSOR_NOT_FOUND";
  const uint16_t updated = (config & 0xFFFC) | 2;
  plc::writeWord(0x06, updated, plcBaud, false, false, activeSlave);
  if (plc::readWord(0x06, plcBaud, verified, nullptr, activeSlave) || verified != updated)
    return "!BRIDGE I2C_RAM_ENABLE_FAILED";
  return nullptr;
}

static void i2cCommand(const char *command) {
  if (!i2cMode) {
    answer("!BRIDGE I2C_MODE_REQUIRED");
    return;
  }
  if (!strcmp(command, "ACCESS") || !strcmp(command, "START")) {
    const bool start = !strcmp(command, "START");
    bool enabledInRam = false;
    const char *error = elmosI2c::connect(start);
    if (start && error && !strcmp(error, "!BRIDGE I2C_SENSOR_NOT_FOUND")) {
      error = activateI2cThroughPlc();
      if (!error) {
        enabledInRam = true;
        error = elmosI2c::connect(false);
      }
    }
    if (error) {
      answer(error);
      return;
    }
    char reply[48];
    snprintf(reply, sizeof(reply), "# I2C ACCESS ADDR=%02X RAM_ENABLE=%u",
             unsigned(elmosI2c::slave), unsigned(enabledInRam));
    answer(reply);
    return;
  }
  const bool read = strncmp(command, "READ ", 5) == 0 && strlen(command) == 7;
  const bool write = strncmp(command, "WRITE ", 6) == 0 && strlen(command) == 12;
  if ((!read && !write) || !elmosI2c::slave) {
    answer("!BRIDGE I2C_COMMAND_OR_ACCESS_REQUIRED");
    return;
  }
  const char *hex = command + (read ? 5 : 6);
  unsigned data = 0;
  for (unsigned i = 0; i < (read ? 2u : 6u); ++i) {
    const int digit = hexDigit(hex[i]);
    if (digit < 0) {
      answer("!BRIDGE I2C_BAD_HEX");
      return;
    }
    data = (data << 4) | digit;
  }
  const uint8_t reg = read ? data : data >> 16;
  if (reg & 1) {
    answer("!BRIDGE I2C_UNALIGNED_REGISTER");
    return;
  }
  uint16_t word = data;
  if (read) {
    if (const char *error = elmosI2c::readWord(elmosI2c::slave, reg, word)) {
      answer(error);
      return;
    }
    char reply[8];
    snprintf(reply, sizeof(reply), "%02X %02X", unsigned(word & 0xFF), unsigned(word >> 8));
    answer(reply);
  } else {
    const bool ramCookie = reg == 0x22 &&
        (word == 0xF75A || word == 0x0CC7 || word == 0xD21E || word == 0x62A2);
    if (!ramCookie && !allowedWrite(reg, word)) {
      answer("!BRIDGE I2C_WRITE_DENIED");
      return;
    }
    const char *error = elmosI2c::writeWord(reg, word);
    answer(error ? error : "# I2C WRITE");
  }
}

static void onCommand(const char *command) {
  ++requests;
  if (strcmp(command, "IF_CFG 2 1 0") == 0 || strcmp(command, "IF_CFG 7 0 0") == 0) {
    if (i2cMode) {
      Wire.end();
      plc::configurePins();
    }
    const bool nextI2cMode = strcmp(command, "IF_CFG 2 1 0") == 0;
    if (i2cMode || nextI2cMode) nvmArmed = coldStartVerified = false;
    i2cMode = nextI2cMode;
    elmosI2c::slave = 0;
    answer(i2cMode ? "# I2C" : "# PLC");
  } else if (strncmp(command, "I2C ", 4) == 0) {
    i2cCommand(command + 4);
  } else if (i2cMode && ((strncmp(command, "PLC", 3) == 0 &&
                        strncmp(command, "PLC IO ", 7) != 0 &&
                        strncmp(command, "PLC_BAUD ", 9) != 0) ||
                        strcmp(command, "NVM ARM CALIBRATION") == 0)) {
    answer("!BRIDGE I2C_MODE_ACTIVE");
  } else if (strcmp(command, "NVM ARM CALIBRATION") == 0) {
    nvmArmed = coldStartVerified && !probe(activeSlave);
    answer(nvmArmed ? "# NVM CALIBRATION ARMED" : "!BRIDGE NVM_COLD_START_REQUIRED");
  } else if (strcmp(command, "NVM DISARM") == 0) {
    nvmArmed = false;
    answer("# NVM DISARMED");
  } else if (strcmp(command, "BRIDGE_INFO") == 0) {
    nvmArmed = false;
    answer("# E70311-BRIDGE V1 CAPS=PLC_UID,PLC_READ,PLC_WRITE,NVM,POWER_GPIO_10,PSSC_RAM,AFE_FILTER,BRIDGE_CAL_NVM,PLC_RX_DIAG,PLC_GPIO4_IO,I2C_CRC");
  } else if (strcmp(command, ".VERSION") == 0) {
    answer("# ESP32-C3 SuperMini ELMOS PLC/I2C bridge v0.10");
  } else if (strcmp(command, "BRIDGE_PING") == 0) {
    answer("# PONG ESP32-C3 SUPERMini PLC_UID");
  } else if (strcmp(command, "BRIDGE_STATS") == 0) {
    Serial.printf("# BRIDGE_STATS requests=%lu freeheap=%lu\r\n:\r\n",
                  static_cast<unsigned long>(requests),
                  static_cast<unsigned long>(ESP.getFreeHeap()));
    Serial.flush();
  } else if (strcmp(command, "PLC IO GPIO4") == 0 || strcmp(command, "PLC IO SPLIT") == 0) {
    nvmArmed = coldStartVerified = false;
    plc::singlePin = strcmp(command, "PLC IO GPIO4") == 0;
    activeSlave = plc::ReadAddress;
    answer(plc::singlePin ? "# PLC IO GPIO4" : "# PLC IO SPLIT");
  } else if (strcmp(command, "PLC RX DIAG") == 0) {
    diagnoseRx();
  } else if (strcmp(command, "PLC_UID 25000") == 0) {
    printUid(25000);
  } else if (strcmp(command, "PLC_UID 100000") == 0) {
    printUid(100000);
  } else if (strcmp(command, "PLC_BAUD 25000") == 0 || strcmp(command, "PLC_BAUD 100000") == 0) {
    nvmArmed = coldStartVerified = false;
    plcBaud = strcmp(command, "PLC_BAUD 25000") == 0 ? 25000 : 100000;
    answer("# PLC BAUD");
  } else if (strcmp(command, "PLC ACCESS") == 0 || strcmp(command, "PLC START") == 0) {
    establishAccess(strcmp(command, "PLC START") == 0);
  } else if (strcmp(command, "PLC RECOVER") == 0 || strcmp(command, "PLC RECOVER START") == 0) {
    establishAccess(strcmp(command, "PLC RECOVER START") == 0, true);
  } else if (strncmp(command, "PLC ", 4) == 0) {
    plcFrame(command + 4);
  } else if (strncmp(command, "IF_CFG", 6) == 0 ||
             strncmp(command, "PLC", 3) == 0 ||
             strncmp(command, "#PLC", 4) == 0) {
    answer("!BRIDGE PLC_COMMAND_NOT_SUPPORTED");
  } else {
    answer("!BRIDGE UNSUPPORTED_COMMAND");
  }
}

void setup() {
  plc::configurePins();
  Serial.begin(115200);
  // Don't wait for Serial: the sketch must start even without a USB host.
}

void loop() {
  while (Serial.available() > 0) {
    int incoming = Serial.read();
    if (incoming < 0) break;
    const char c = static_cast<char>(incoming);
    if (c == '\r' || c == '\n') {
      if (lineLength) {
        lineBuffer[lineLength] = '\0';
        onCommand(lineBuffer);
        lineLength = 0;
      }
    } else if (static_cast<unsigned char>(c) >= 32 &&
               lineLength < sizeof(lineBuffer) - 1) {
      lineBuffer[lineLength++] = c;
    } else {
      lineLength = 0;
      answer("!BRIDGE INVALID_OR_TOO_LONG");
    }
  }
  delay(1);
}
