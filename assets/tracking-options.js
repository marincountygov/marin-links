/*
 * Marin Links tracking choices.
 * Generated from data/tracking-options.json, data/projects.json and data/locations.json by scripts/build-options.py. Do not edit.
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
        "name": "Print",
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
        "value": "marin-county",
        "name": "Marin County",
        "id": "marin-county",
        "legacy": []
      },
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
        "value": "cmp-03",
        "name": "Tam Junction Placemaking",
        "id": "tam-junction-placemaking",
        "legacy": []
      },
      {
        "value": "cmp-02",
        "name": "Weather Together",
        "id": "weather-together",
        "legacy": [
          "weather_together"
        ]
      },
      {
        "value": "cmp-04",
        "name": "West Marin Visioning",
        "id": "west-marin-visioning",
        "legacy": []
      }
    ],
    "locations": [
      {
        "value": "almonte",
        "name": "Almonte",
        "id": "almonte",
        "legacy": []
      },
      {
        "value": "alto",
        "name": "Alto",
        "id": "alto",
        "legacy": []
      },
      {
        "value": "bel-marin-keys",
        "name": "Bel Marin Keys",
        "id": "bel-marin-keys",
        "legacy": []
      },
      {
        "value": "belvedere",
        "name": "Belvedere",
        "id": "belvedere",
        "legacy": []
      },
      {
        "value": "black-point",
        "name": "Black Point",
        "id": "black-point",
        "legacy": []
      },
      {
        "value": "bolinas",
        "name": "Bolinas",
        "id": "bolinas",
        "legacy": []
      },
      {
        "value": "corte-madera",
        "name": "Corte Madera",
        "id": "corte-madera",
        "legacy": []
      },
      {
        "value": "dillon-beach",
        "name": "Dillon Beach",
        "id": "dillon-beach",
        "legacy": []
      },
      {
        "value": "marin-district-1",
        "name": "District 1",
        "id": "marin-district-1",
        "legacy": []
      },
      {
        "value": "marin-district-2",
        "name": "District 2",
        "id": "marin-district-2",
        "legacy": []
      },
      {
        "value": "marin-district-3",
        "name": "District 3",
        "id": "marin-district-3",
        "legacy": []
      },
      {
        "value": "marin-district-4",
        "name": "District 4",
        "id": "marin-district-4",
        "legacy": []
      },
      {
        "value": "marin-district-5",
        "name": "District 5",
        "id": "marin-district-5",
        "legacy": []
      },
      {
        "value": "dogtown",
        "name": "Dogtown",
        "id": "dogtown",
        "legacy": []
      },
      {
        "value": "fairfax",
        "name": "Fairfax",
        "id": "fairfax",
        "legacy": []
      },
      {
        "value": "fallon",
        "name": "Fallon",
        "id": "fallon",
        "legacy": []
      },
      {
        "value": "forest-knolls",
        "name": "Forest Knolls",
        "id": "forest-knolls",
        "legacy": []
      },
      {
        "value": "gallinas-creek",
        "name": "Gallinas Creek",
        "id": "gallinas-creek",
        "legacy": []
      },
      {
        "value": "gnoss-field-airport",
        "name": "Gnoss Field Airport",
        "id": "gnoss-field-airport",
        "legacy": []
      },
      {
        "value": "green-point",
        "name": "Green Point",
        "id": "green-point",
        "legacy": []
      },
      {
        "value": "greenbrae",
        "name": "Greenbrae",
        "id": "greenbrae",
        "legacy": []
      },
      {
        "value": "homestead-valley",
        "name": "Homestead Valley",
        "id": "homestead-valley",
        "legacy": []
      },
      {
        "value": "homestead-valley-community-center",
        "name": "Homestead Valley Community Center",
        "id": "homestead-valley-community-center",
        "legacy": []
      },
      {
        "value": "ignacio",
        "name": "Ignacio",
        "id": "ignacio",
        "legacy": []
      },
      {
        "value": "indian-valley",
        "name": "Indian Valley",
        "id": "indian-valley",
        "legacy": []
      },
      {
        "value": "inverness",
        "name": "Inverness",
        "id": "inverness",
        "legacy": []
      },
      {
        "value": "inverness-park",
        "name": "Inverness Park",
        "id": "inverness-park",
        "legacy": []
      },
      {
        "value": "kent-woodlands",
        "name": "Kent Woodlands",
        "id": "kent-woodlands",
        "legacy": []
      },
      {
        "value": "kentfield",
        "name": "Kentfield",
        "id": "kentfield",
        "legacy": []
      },
      {
        "value": "lagunitas",
        "name": "Lagunitas",
        "id": "lagunitas",
        "legacy": []
      },
      {
        "value": "larkspur",
        "name": "Larkspur",
        "id": "larkspur",
        "legacy": []
      },
      {
        "value": "las-gallinas",
        "name": "Las Gallinas",
        "id": "las-gallinas",
        "legacy": []
      },
      {
        "value": "loma-verde",
        "name": "Loma Verde",
        "id": "loma-verde",
        "legacy": []
      },
      {
        "value": "lucas-valley",
        "name": "Lucas Valley",
        "id": "lucas-valley",
        "legacy": []
      },
      {
        "value": "marin-art-garden-center",
        "name": "Marin Art & Garden Center",
        "id": "marin-art-garden-center",
        "legacy": []
      },
      {
        "value": "marin-center",
        "name": "Marin Center",
        "id": "marin-center",
        "legacy": []
      },
      {
        "value": "marin-city",
        "name": "Marin City",
        "id": "marin-city",
        "legacy": []
      },
      {
        "value": "civic-center",
        "name": "Marin County Civic Center",
        "id": "civic-center",
        "legacy": []
      },
      {
        "value": "marin-health-wellness-connection-center",
        "name": "Marin Health & Wellness Campus Connection Center",
        "id": "marin-health-wellness-connection-center",
        "legacy": []
      },
      {
        "value": "marin-humane",
        "name": "Marin Humane",
        "id": "marin-humane",
        "legacy": []
      },
      {
        "value": "marinwood",
        "name": "Marinwood",
        "id": "marinwood",
        "legacy": []
      },
      {
        "value": "marshall",
        "name": "Marshall",
        "id": "marshall",
        "legacy": []
      },
      {
        "value": "mill-valley",
        "name": "Mill Valley",
        "id": "mill-valley",
        "legacy": []
      },
      {
        "value": "mill-valley-community-center",
        "name": "Mill Valley Community Center",
        "id": "mill-valley-community-center",
        "legacy": []
      },
      {
        "value": "muir-beach",
        "name": "Muir Beach",
        "id": "muir-beach",
        "legacy": []
      },
      {
        "value": "nicasio",
        "name": "Nicasio",
        "id": "nicasio",
        "legacy": []
      },
      {
        "value": "novato",
        "name": "Novato",
        "id": "novato",
        "legacy": []
      },
      {
        "value": "olema",
        "name": "Olema",
        "id": "olema",
        "legacy": []
      },
      {
        "value": "paradise-cay",
        "name": "Paradise Cay",
        "id": "paradise-cay",
        "legacy": []
      },
      {
        "value": "point-reyes-station",
        "name": "Point Reyes Station",
        "id": "point-reyes-station",
        "legacy": []
      },
      {
        "value": "ross",
        "name": "Ross",
        "id": "ross",
        "legacy": []
      },
      {
        "value": "san-anselmo",
        "name": "San Anselmo",
        "id": "san-anselmo",
        "legacy": []
      },
      {
        "value": "san-geronimo",
        "name": "San Geronimo",
        "id": "san-geronimo",
        "legacy": []
      },
      {
        "value": "san-quentin",
        "name": "San Quentin",
        "id": "san-quentin",
        "legacy": []
      },
      {
        "value": "san-rafael",
        "name": "San Rafael",
        "id": "san-rafael",
        "legacy": []
      },
      {
        "value": "santa-venetia",
        "name": "Santa Venetia",
        "id": "santa-venetia",
        "legacy": []
      },
      {
        "value": "sausalito",
        "name": "Sausalito",
        "id": "sausalito",
        "legacy": []
      },
      {
        "value": "seadrift",
        "name": "Seadrift",
        "id": "seadrift",
        "legacy": []
      },
      {
        "value": "sleepy-hollow",
        "name": "Sleepy Hollow",
        "id": "sleepy-hollow",
        "legacy": []
      },
      {
        "value": "st-vincents",
        "name": "St. Vincent's",
        "id": "st-vincents",
        "legacy": []
      },
      {
        "value": "stinson-beach",
        "name": "Stinson Beach",
        "id": "stinson-beach",
        "legacy": []
      },
      {
        "value": "strawberry",
        "name": "Strawberry",
        "id": "strawberry",
        "legacy": []
      },
      {
        "value": "tam-valley-community-center",
        "name": "Tam Valley Community Center",
        "id": "tam-valley-community-center",
        "legacy": []
      },
      {
        "value": "tamalpais-valley",
        "name": "Tamalpais Valley",
        "id": "tamalpais-valley",
        "legacy": []
      },
      {
        "value": "tiburon",
        "name": "Tiburon",
        "id": "tiburon",
        "legacy": []
      },
      {
        "value": "tocaloma",
        "name": "Tocaloma",
        "id": "tocaloma",
        "legacy": []
      },
      {
        "value": "tomales",
        "name": "Tomales",
        "id": "tomales",
        "legacy": []
      },
      {
        "value": "woodacre",
        "name": "Woodacre",
        "id": "woodacre",
        "legacy": []
      }
    ],
    "contents": [
      {
        "value": "ct-01",
        "name": "Button",
        "id": "button",
        "legacy": [
          "button"
        ]
      },
      {
        "value": "ct-02",
        "name": "Text link",
        "id": "text-link",
        "legacy": [
          "text-link"
        ]
      },
      {
        "value": "ct-03",
        "name": "Image or banner",
        "id": "image-or-banner",
        "legacy": [
          "image-or-banner"
        ]
      },
      {
        "value": "ct-04",
        "name": "Header",
        "id": "header",
        "legacy": [
          "header"
        ]
      },
      {
        "value": "ct-05",
        "name": "Footer",
        "id": "footer",
        "legacy": [
          "footer"
        ]
      },
      {
        "value": "ct-06",
        "name": "Email signature",
        "id": "email-signature",
        "legacy": [
          "email-signature"
        ]
      },
      {
        "value": "ct-07",
        "name": "Version A",
        "id": "version-a",
        "legacy": [
          "version-a"
        ]
      },
      {
        "value": "ct-08",
        "name": "Version B",
        "id": "version-b",
        "legacy": [
          "version-b"
        ]
      }
    ]
  };

  window.MarinTrackingOptions = Object.freeze(OPTIONS);
})();
