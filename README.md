<p align="center">
  <img src=".github/assets/banner.svg" alt="Codextent: your coding assistant to learn programming efficiently" width="100%">
</p>

<p align="center">
  <img alt="Chrome MV3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-4c8dff?style=for-the-badge\\\&logo=googlechrome\\\&logoColor=white\\\&labelColor=0d1117">
  <img alt="Vanilla JS" src="https://img.shields.io/badge/JavaScript-vanilla-fbbf24?style=for-the-badge\\\&logo=javascript\\\&logoColor=white\\\&labelColor=0d1117">
  <img alt="Tests" src="https://img.shields.io/badge/tests-171%20unit%20%C2%B7%2030%20browser-34d399?style=for-the-badge\\\&labelColor=0d1117">
  <img alt="No server" src="https://img.shields.io/badge/data-stays%20in%20your%20browser-b59cff?style=for-the-badge\\\&labelColor=0d1117">
</p>

<h3 align="center">Read less. Predict more. Remember everything.</h3>

<p align="center">
  Codextent turns every code example you read into practice.<br>
  You guess the output, it runs the code for real, and your mistakes come back as a quiz.<br>
  On <b>CodeChef</b> and <b>LeetCode</b> it inserts ready templates and keeps your problems to <b>solve later</b>.
</p>

<table align="center">
  <tr>
    <td align="center" width="25%">🟢<br><b>Predict</b><br>Guess, then run it for real</td>
    <td align="center" width="25%">🟡<br><b>Templates</b><br>One click into the editor</td>
    <td align="center" width="25%">🟣<br><b>Notes</b><br>Revise in one hub</td>
    <td align="center" width="25%">🔴<br><b>Mistake quiz</b><br>Every wrong answer returns</td>
  </tr>
</table>

<p align="center"><i>Less copying. More thinking. Less guessing. More knowing.</i></p>

<p align="center"><img src=".github/assets/divider.svg" alt="" width="100%"></p>

## ✨ What you get

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>🟢 Predict the output</h3>
      A slim bar appears under every code example on 8 tutorial sites. Type what you think it prints and press <b>Enter</b>. Codextent runs it on a real compiler and shows <b>✓</b> or <b>✗</b> with the first line that differs. The site's own answer stays blurred until you guess.
    </td>
    <td width="50%" valign="top">
      <h3>🔴 Mistake quiz</h3>
      Got it wrong? We change your code a little ("what if the loop ran one less time?"), run the new version for real, and ask again. Every answer comes from a real run, so nothing is written by hand.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>🟡 Templates for coding platforms</h3>
      Click the Codextent logo next to the editor on <b>CodeChef</b> or <b>LeetCode</b>. Quick inserts: <b>Test-case loop</b> (<code>while (t--)</code>), <b>Fast I/O</b>, <b>Read array</b>. Or search 15 ready C++ templates (BFS, DSU, Dijkstra, binary search…) and add your own. CodeChef gets the whole program; LeetCode gets helpers inside <code>class Solution</code>.
    </td>
    <td valign="top">
      <h3>🔖 Solve later on LeetCode</h3>
      A bookmark in LeetCode's Code bar saves the problem with your idea. The board shows everything you saved, with the number, difficulty and note, and you tick it off when solved. It syncs to every PC signed in to your Chrome.
    </td>
  </tr>
  <tr>
    <td valign="top">
      <h3>🟣 Note and key points</h3>
      Select any text on a tutorial page and save it as a <b>Key point</b> or <b>Note</b>. Right-click code (or <b>Alt+Shift+S</b>) to clip it. On CodeChef and LeetCode, the <b>Notes</b> tab saves your idea for the problem.
    </td>
    <td valign="top">
      <h3>📊 My Learning Hub</h3>
      One dashboard for accuracy, streaks, recent attempts, questions that need revision, your Revision Vault, Practice, Concepts and Templates. Black and white, with a little blue where you need it.
    </td>
  </tr>
</table>

<p align="center">
  <img src=".github/assets/showcase.svg" alt="Predict bar, templates panel, LeetCode board and My Learning Hub" width="100%">
</p>

<p align="center"><img src=".github/assets/divider.svg" alt="" width="100%"></p>

## 🌍 Where it works

||Sites|Languages|
|-|-|-|
|**Predict the output**|GeeksforGeeks · W3Schools · Programiz · TutorialsPoint · Javatpoint · Scaler · Studytonight · Sanfoundry|C · C++ · Java · Python · MySQL|
|**Run snippets without `main()`**|GeeksforGeeks · W3Schools|C · C++ · Java|
|**Blur outputs · key points · notes**|All 8 tutorial sites|any|
|**Templates + Notes panel**|CodeChef · LeetCode|C++|
|**Solve later board**|LeetCode (Array problems)|any|

## 🚀 Install in 1 minute

1. **Download** this repo (Code → Download ZIP) and unzip it.
2. Open **`chrome://extensions`** and turn on **Developer mode**.
3. Click **Load unpacked** and pick the folder.
4. Open any tutorial page, for example a C++ for-loop on GeeksforGeeks, and look for the bar under the code.

> Updating? Replace the files, then press \\\*\\\*↻ Reload\\\*\\\* on the extension card and \\\*\\\*Ctrl+F5\\\*\\\* on open tabs.

## ⌨️ Shortcuts

|Do this|Press|
|-|-|
|Check your guess|**Enter** in the bar (**Shift+Enter** for a new line)|
|Clip selected code to the vault|**Alt+Shift+S** or right-click → *Save to My Revision Vault*|
|Open Templates + Notes on CodeChef / LeetCode|**Alt+Shift+T**|
|Save a note on a coding platform|**Ctrl+Enter**|

<p align="center"><img src=".github/assets/divider.svg" alt="" width="100%"></p>

## 🧠 How it works

```mermaid
flowchart LR
  S(\\\[Student]) -->|types a guess| P\\\[Predict bar<br/>content script]
  W\\\[(10 websites)] -->|code examples| P
  P -->|CHECK| R\\\[Fast runner<br/>service worker]
  R -->|first| WB\\\[Wandbox]
  R -.->|after 4 s| J0\\\[Judge0 CE]
  R -->|save| L\\\[(chrome.storage.local)]
  T\\\[Template picker] -->|insert| ED\\\[Ace / Monaco editor]
  B\\\[Solve-later board] -->|sync| SY\\\[(chrome.storage.sync)]
  L --> H\\\[My Learning Hub]
  SY --> H
```

* **In the page:** content scripts find the code, draw the bar, blur answers, and talk to the editors (Ace on CodeChef, Monaco on LeetCode) through tiny page-world adapters.
* **In the background:** a service worker runs code on **Wandbox** first and brings in **Judge0** if it is slow. It caches results and starts running as soon as the bar opens.
* **Your data:** attempts, clips, notes and templates live in `chrome.storage.local`; LeetCode marks live in `chrome.storage.sync`. No account, no server.

## 🛠️ Tech stack

`Chrome Manifest V3` · `Vanilla JavaScript` · `Shadow DOM` · `chrome.storage` · `Wandbox API` · `Judge0 CE` · `Ace` · `Monaco` · `node:test + jsdom` · `Playwright`

## 🧪 Develop

```bash
npm install
npm test            # 171 unit tests (node:test + jsdom, g++ compiles every template)
npm run test:e2e    # 30 checks in real Chromium with the real extension, Ace and Monaco
```

<details>
<summary><b>📁 Project structure</b></summary>

```
src/
  background.js          service worker: runner, quiz builder, clipper
  content/               bar, adapters, LeetCode board, templates panel
    editors/             page-world adapters for Ace (CodeChef) and Monaco (LeetCode)
  lib/                   runner, compare, quiz, vault, templates, leetcode, stats
  dashboard/             My Learning Hub
  popup/  options/       toolbar popup and settings
tests/                   unit tests + e2e (tests/e2e)
```

</details>

## 🗺️ Roadmap

* \[x] Predict the output on 8 tutorial sites, 5 languages
* \[x] Revision Vault, notes, key points, mistake quiz
* \[x] C++ templates on CodeChef and LeetCode
* \[x] LeetCode solve-later board
* \[ ] Codeforces and HackerRank
* \[ ] Java and Python templates
* \[ ] Accounts with Node.js + Express + MongoDB Atlas
* \[ ] AI hints that explain a wrong guess
* \[ ] Class dashboards for teachers

<p align="center"><img src=".github/assets/divider.svg" alt="" width="100%"></p>

<p align="center">
  <b>Built by Team Iron Men</b><br>
 Dinesh C · Abhishek S · Nandhakumar Sanjay · Bharani Sankar S
</p>

<p align="center"><sub>If Codextent helped you learn, leave a ⭐ so other students find it.</sub></p>

