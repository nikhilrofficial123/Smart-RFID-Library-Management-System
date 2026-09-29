/*
  =============================================================
  Smart RFID Library System - Arduino UNO/Nano + MFRC522 Sketch
  =============================================================
  
  Hardware Pinout Connection (Arduino UNO / Nano -> MFRC522):
  -------------------------------------------------------------
  MFRC522 Pin  |  Arduino UNO / Nano Pin
  -------------------------------------------------------------
  SDA (SS)     |  D10
  SCK          |  D13
  MOSI         |  D11
  MISO         |  D12
  IRQ          |  (Unconnected)
  GND          |  GND
  RST          |  D9
  3.3V         |  3.3V  <-- WARNING: Use 3.3V only! Do NOT use 5V!
  -------------------------------------------------------------

  Required Library:
  - "MFRC522" by GitHubCommunity / Arduino (Install via Library Manager)
*/

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 10
#define RST_PIN 9

MFRC522 rfid(SS_PIN, RST_PIN);

void setup() {
  Serial.begin(9600); // Must match BAUD_RATE=9600 in middleware/.env
  SPI.begin();        // Init SPI bus
  rfid.PCD_Init();    // Init MFRC522 RFID reader module

  // Serial.println("RFID RC522 Reader Ready");
}

void loop() {
  // Look for new RFID card / tag
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }

  // Select one of the cards
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Convert UID byte array to Hex String
  String rfidUid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) {
      rfidUid += "0";
    }
    rfidUid += String(rfid.uid.uidByte[i], HEX);
  }
  rfidUid.toUpperCase();

  // Print UID formatted for middleware (followed by newline)
  Serial.println(rfidUid);

  // Halt PICC & Stop Encryption on PCD
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  delay(1000); // 1s cooldown between consecutive reads
}
