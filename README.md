# Wii Menu TV Launcher (Samsung Tizen)

A retro Nintendo Wii-styled channel launcher tailored for your Samsung Smart TV ("Bertha", model UN70TU700DBXZA at `192.168.1.24`).

![Wii Menu Preview](img/preview.png)

## Highlights

- **Authentic Wii Aesthetic**:
  - 4x3 channel grid with glossy white channel bevels, roving cyan focus ring, and shine sweeps.
  - Classic bottom navigation bar with authentic curved edge and blue accent line.
  - Floating 12-hour/24-hour clock and live calendar date.
  - Interactive round **Wii** (Settings) and **Mail** (Message Board) buttons.
  - Animated Wii hand cursor following directional focus.
  - Channel zoom-in preview screen with **Start** and **Wii Menu** pill buttons.
  - "Health & Safety" boot greeting with remote prompt.
- **Synthesized Web Audio**:
  - Zero external sound files or copyrighted Nintendo assets.
  - Procedurally generated Web Audio chimes for hover, select, back, channel start, page turn, and startup.
- **Samsung Tizen Native Integration**:
  - Preconfigured with your TV's verified app IDs for:
    - **Netflix** (`3201907018807`)
    - **YouTube** (`111299001912`)
    - **Prime Video** (`3201910019365`)
    - **Disney+** (`3201901017640`)
    - **Hulu** (`3201601007625`)
    - **Peacock** (`3202006020991`)
    - **Paramount+** (`3201710014981`)
    - **HDMI Inputs** (via Tizen `tvwindow` API)
    - **TV Settings** (via local remote control key)
  - Remote control key support (D-Pad arrows, Enter/OK, Back, Colored keys).
  - Standalone local font bundling (offline friendly).

---

## TV Setup: Making It Your Default Launcher

Because Samsung Tizen locks the physical Home button on retail firmware:

1. **Enable Autorun Last App on the TV**:
   - On your Samsung remote: Press **Settings** → **General** (or **Advanced features**) → **Start Screen Options** (or **Smart Features**).
   - Turn **Start with Smart Hub Home** → **OFF**.
   - Turn **Autorun Last App** → **ON**.
2. **Leave the TV on the Wii Menu**:
   - Whenever you turn the TV on or resume from standby, it will immediately boot back into your Wii Menu!

---

## Installing on the TV

The launcher is packaged as a standard Tizen Web Application widget (`WiiMenuTV.wgt`).

### Quick Package
```bash
./scripts/package.sh
```

### Deploying via Tizen CLI / Device Manager
1. In Tizen Studio or Tizen CLI:
   ```bash
   sdb connect 192.168.1.24:26101
   tizen install -n WiiMenuTV.wgt -s 192.168.1.24:26101
   ```
2. In Device Manager, right-click `192.168.1.24` and choose **Permit to install applications** if you haven't yet registered your signing certificate.

---

## Local Browser Testing & Preview

To preview and interact with the launcher on your Mac:
```bash
python3 -m http.server 4455
```
Open [http://127.0.0.1:4455](http://127.0.0.1:4455) in any browser. You can navigate with your arrow keys, Enter, Backspace/Esc, or your mouse.
