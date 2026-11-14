// ATmega32U4 test bridge with CRC-checked register reads and volatile PLC startup.
#include <Arduino.h>
#include <string.h>
#include "plc_avr.h"

#if !defined(__AVR_ATmega32U4__)
#error "Select an ATmega32U4 board with the matching CPU clock."
#endif

static char lineBuffer[96];
static size_t lineLength = 0;
static uint32_t plcBaud = 100000;
static uint8_t activeSlave = plc::ReadAddress;
static bool recoveryUsed = false;

static void answer(const char *message) {
  // Same line-terminator as the existing SSP3-oriented Web Serial parser.
  // Let USB Serial/JTAG service frames after PLC bit timing masked interrupts.
  delay(2);
  Serial.print(message);
  Serial.print("\r\n:\r\n");
}

static void printUid(uint32_t baud) {
  constexpr uint8_t addresses[] = {0x38, 0x52, 0x50};
  uint16_t words[3];
  for (unsigned i = 0; i < 3; ++i) {
    if (const char *error = plc::readWord(addresses[i], baud, words[i], nullptr, activeSlave)) {
      answer(error);
      return;
    }
  }
  char response[32];
  snprintf(response, sizeof(response), "# E70311 UID=%04X%04X%04X",
           unsigned(words[0]), unsigned(words[1]), unsigned(words[2]));
  answer(response);
}

static int hexDigit(char ch) {
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return -1;
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
  if (slave != activeSlave || address != 0x22 || word != 0x8B93) {
    answer("!BRIDGE PLC_WRITE_DENIED");
    return;
  }
  plc::writeWord(address, word, plcBaud, false, false, slave);
  answer("# PLC FRAME SENT");
}

static const char *probe(uint8_t slave) {
  uint16_t afe, adc, cfg, pads;
  if (const char *e = plc::readWord(0x1C, plcBaud, afe, nullptr, slave)) return e;
  if (!afe) return "!BRIDGE PLC_NO_VALID_FRAME";
  if (const char *e = plc::readWord(0x2A, plcBaud, adc, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x06, plcBaud, cfg, nullptr, slave)) return e;
  if (const char *e = plc::readWord(0x0A, plcBaud, pads, nullptr, slave)) return e;
  const uint8_t configured = ((cfg >> 8) & 0x7E) | ((pads & 0x1000) ? 0x80 : 0) | 1;
  if (configured != slave) return "!BRIDGE PLC_ADDRESS_MISMATCH";
  activeSlave = slave;
  return nullptr;
}

static const char *probeAddresses() {
  const char *error = probe(activeSlave);
  if (error && strcmp(error, "!BRIDGE PLC_NO_VALID_FRAME") == 0)
    error = probe(activeSlave == 0x6D ? 0x7D : 0x6D);
  return error;
}

static void establishAccess(bool powerCycle, bool recover = false) {
  const char *error = nullptr;
  if (recover) {
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
  if (error) {
    answer(error);
    return;
  }
  char response[40];
  snprintf(response, sizeof(response), "# PLC ACCESS ADDR=%02X RAM_RECOVERY=%u",
           unsigned(activeSlave & 0xFE), unsigned(recoveryUsed));
  answer(response);
}

static void onCommand(const char *command) {
  if (strcmp(command, "BRIDGE_INFO") == 0) {
    answer("# E70311-BRIDGE V1 CAPS=PLC_UID,PLC_READ,PLC_READ_ONLY,POWER_D7,PSSC_RAM");
  } else if (strcmp(command, ".VERSION") == 0) {
    answer(F_CPU == 16000000UL ? "# Pro Micro PLC v0.1 16 MHz" : "# Pro Micro PLC v0.1 8 MHz");
  } else if (strcmp(command, "PLC_UID 25000") == 0) {
    printUid(25000);
  } else if (strcmp(command, "PLC_UID 100000") == 0) {
    printUid(100000);
  } else if (strcmp(command, "IF_CFG 7 0 0") == 0) {
    answer("# PLC");
  } else if (strcmp(command, "PLC_BAUD 25000") == 0 || strcmp(command, "PLC_BAUD 100000") == 0) {
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
