# Codextent ⚡
**Predict, Run & Revise Code** — a Chrome extension that turns coding tutorials into practice.

Read an example → guess its output → run it → see exactly where you went wrong → learn the concept.

## Features
- **Predict & check:** the `< ⚡ >` button under each example opens a slim bar; real execution via Judge0
- **5 languages:** C · C++ · Java · Python · MySQL
- **8 sites:** GeeksforGeeks · W3Schools · Programiz · TutorialsPoint · Javatpoint · Scaler · Studytonight · Sanfoundry
- **Concept tags:** 88 concepts, each with what it is, the common trap, and an example
- **Code Clipper → Revision Vault:** right-click any code → save it with notes, status, and spaced revision
- **My Learning Hub:** accuracy, streaks, weak concepts, daily activity
- **Themes:** Dark · Light · Auto · Night sky
- **Private:** everything stays in your browser; no account needed

## Install
1. Download this repo and unzip it
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and pick the folder
4. Open Settings → **Test connection** and check for ✓

## Use
| Do | How |
|---|---|
| Predict output | Click `< ⚡ >` under an example → type → **Enter** |
| Save code | Select it → right-click → **Save to My Revision Vault** (or **Alt+Shift+S**) |
| Revise | Hub → **My Revision Vault** → **Start revision** |

## Develop
```bash
npm install
npm test            # unit tests
npm run test:e2e    # real Chromium end-to-end
