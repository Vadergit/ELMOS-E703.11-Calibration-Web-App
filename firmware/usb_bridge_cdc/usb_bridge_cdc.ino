/*
  E703.11 USB CDC Bridge – transport bring-up ONLY
  Native USB: ESP32-S3 (Arduino Tools > USB CDC On Boot: Enabled),
              RP2040 / Arduino Nano RP2040 Connect, boards with native USB CDC.

  IMPORTANT: This demo intentionally DOES NOT implement Elmos 1-Wire PLC.
  It provides a safe enumeration and handshake test without any sensor GPIO activity.
  CAPS=CDC_ONLY prevents the web app from attempting chip access or NVM writes.
  Never advertise PLC_READ/PLC_WRITE/NVM until the Elmos timing, CRC, pin hardware
  and readback have been fully implemented and validated on a sacrificial sensor.

  Use Arduino IDE at 115200 baud, disable Serial Monitor while using Web Serial.
*/
#include <Arduino.h>
static char commandLine[128];
static size_t commandLen = 0;

static void reply(const char* line) {
  Serial.print(line);
  Serial.print("\r\n:\r\n");
}

static void respond(const char* command) {
  if (strcmp(command, "BRIDGE_INFO") == 0) {
    reply("# E70311-BRIDGE V1 CAPS=CDC_ONLY");
  } else if (strcmp(command, ".VERSION") == 0) {
    reply("# E70311 USB-CDC bridge prototype 0.1 (NO SENSOR I/O)");
  } else if (strncmp(command, "IF_CFG", 6) == 0) {
    reply("!BRIDGE PLC_NOT_IMPLEMENTED");
  } else if (strncmp(command, "PLC", 3) == 0 || strncmp(command, "#PLC", 4) == 0) {
    reply("!BRIDGE PLC_NOT_IMPLEMENTED");
  } else {
    reply("!BRIDGE UNSUPPORTED_COMMAND");
  }
}
void setup() {
  Serial.begin(115200);
  // Do not wait indefinitely for a USB host: Web Serial opens the port later.
  // No sensor GPIO is configured or driven in this sketch.
}
void loop() {
  while (Serial.available()) {
    const char ch = static_cast<char>(Serial.read());
    if (ch == '\r' || ch == '\n') {
      if (commandLen > 0) {
        commandLine[commandLen] = '\0';
        respond(commandLine);
        commandLen = 0;
      }
    } else if (commandLen < sizeof(commandLine) - 1) {
      commandLine[commandLen++] = ch;
    } else {
      commandLen = 0;
      reply("!BRIDGE COMMAND_TOO_LONG");
    }
  }
}
