/*
 * Marin Links tracking choices.
 * Generated from data/tracking-options.json by scripts/build-options.py. Do not edit.
 * A link carries only the code. The name is what people see.
 */

(() => {
  "use strict";

  const OPTIONS = {
    "channels": [
      {
        "value": "ch-01",
        "name": "Email",
        "id": "email",
        "legacy": [
          "email"
        ]
      },
      {
        "value": "ch-02",
        "name": "Text message",
        "id": "sms",
        "legacy": [
          "sms"
        ]
      },
      {
        "value": "ch-03",
        "name": "Social media",
        "id": "social",
        "legacy": [
          "social"
        ]
      },
      {
        "value": "ch-04",
        "name": "Paid ads",
        "id": "paid",
        "legacy": [
          "paid"
        ]
      },
      {
        "value": "ch-05",
        "name": "Print or QR code",
        "id": "print",
        "legacy": [
          "print"
        ]
      },
      {
        "value": "ch-06",
        "name": "Partner or coalition",
        "id": "partner",
        "legacy": [
          "partner"
        ]
      }
    ],
    "sources": [
      {
        "value": "so-01",
        "name": "Flyer",
        "id": "flyer",
        "legacy": [
          "flyer"
        ]
      },
      {
        "value": "so-02",
        "name": "Poster",
        "id": "poster",
        "legacy": [
          "poster"
        ]
      },
      {
        "value": "so-03",
        "name": "Postcard",
        "id": "postcard",
        "legacy": [
          "postcard"
        ]
      },
      {
        "value": "so-04",
        "name": "Sign",
        "id": "sign",
        "legacy": [
          "sign"
        ]
      },
      {
        "value": "so-05",
        "name": "Newsletter",
        "id": "newsletter",
        "legacy": [
          "newsletter"
        ]
      },
      {
        "value": "so-06",
        "name": "Website",
        "id": "website",
        "legacy": [
          "website"
        ]
      }
    ],
    "languages": [
      {
        "value": "en",
        "name": "English",
        "id": "english",
        "legacy": []
      },
      {
        "value": "es",
        "name": "Spanish",
        "id": "spanish",
        "legacy": []
      }
    ],
    "campaigns": [
      {
        "value": "cmp-01",
        "name": "Envision Marin",
        "id": "envision-marin",
        "legacy": [
          "envision_marin"
        ]
      },
      {
        "value": "cmp-02",
        "name": "Weather Together",
        "id": "weather-together",
        "legacy": [
          "weather_together"
        ]
      }
    ]
  };

  window.MarinTrackingOptions = Object.freeze(OPTIONS);
})();
