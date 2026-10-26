/* =========================================================
   Channel configuration.
   `restId`  = numeric Samsung app id (verified on this TV via
               GET http://<tv>:8001/api/v2/applications/<id>).
   `match`   = regex used to find the Tizen app id at runtime via
               tizen.application.getAppsInfo() (preferred launch path).
   Edit this file to reorder channels or rename HDMI inputs.
   ========================================================= */
var WII_CONFIG = {
  ownerName: 'Bertha',            // shown on the start screen (TV's network name)
  tilesPerPage: 12,               // classic Wii layout: 4 x 3

  // Friendly names for HDMI ports (shown on HDMI channels)
  hdmiNames: {
    1: 'Game Console',
    2: 'HDMI 2',
    3: 'HDMI 3',
    4: 'HDMI 4'
  },

  channels: [
    { key: 'netflix',   name: 'Netflix',     type: 'app', restId: '3201907018807', match: /netflix/i },
    { key: 'youtube',   name: 'YouTube',     type: 'app', restId: '111299001912',  match: /^youtube$|tizenyoutube/i },
    { key: 'prime',     name: 'Prime Video', type: 'app', restId: '3201910019365', match: /prime video|amazonignition/i },
    { key: 'disney',    name: 'Disney+',     type: 'app', restId: '3201901017640', match: /disney/i },
    { key: 'hulu',      name: 'Hulu',        type: 'app', restId: '3201601007625', match: /^hulu/i },
    { key: 'peacock',   name: 'Peacock',     type: 'app', restId: '3202006020991', match: /peacock/i },
    { key: 'paramount', name: 'Paramount+',  type: 'app', restId: '3201710014981', match: /paramount/i },
    // HDMI channels are inserted here at runtime (one per detected port)
    { key: 'hdmi',      type: 'hdmi-placeholder' },
    { key: 'settings',  name: 'TV Settings', type: 'settings' }
  ]
};
