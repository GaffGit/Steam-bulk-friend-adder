// ==UserScript==
// @name         Steam Bulk Friend Adder
// @namespace    steam-bulk-friend-adder
// @version      1.1.0
// @description  Paste SteamID64,name lines on your Steam friends page to send friend requests and set nicknames automatically.
// @match        https://steamcommunity.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// @homepageURL  https://github.com/GaffGit/Steam-bulk-friend-adder
// @updateURL    https://raw.githubusercontent.com/GaffGit/Steam-bulk-friend-adder/main/steam-bulk-friend-adder.user.js
// @downloadURL  https://raw.githubusercontent.com/GaffGit/Steam-bulk-friend-adder/main/steam-bulk-friend-adder.user.js
// ==/UserScript==

GM_addStyle(`
#sbfa-panel {
  position: fixed;
  top: 80px;
  right: 20px;
  width: 360px;
  z-index: 99999;
  background: #1b2838;
  color: #c7d5e0;
  border: 1px solid #66c0f4;
  border-radius: 6px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
  font: 13px/1.4 "Motiva Sans", Arial, sans-serif;
}

#sbfa-panel .sbfa-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: #171a21;
  border-radius: 6px 6px 0 0;
  font-weight: bold;
  color: #fff;
}

#sbfa-panel.sbfa-collapsed .sbfa-body { display: none; }

#sbfa-panel .sbfa-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

#sbfa-panel textarea {
  width: 100%;
  height: 140px;
  box-sizing: border-box;
  resize: vertical;
  font-family: Consolas, monospace;
  font-size: 12px;
}

#sbfa-panel textarea,
#sbfa-panel input {
  background: #0e141b;
  color: #c7d5e0;
  border: 1px solid #3d4f63;
  border-radius: 3px;
  padding: 4px 6px;
}

#sbfa-panel .sbfa-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

#sbfa-panel .sbfa-row label { display: flex; align-items: center; gap: 4px; }
#sbfa-panel .sbfa-prefix { width: 110px; }
#sbfa-panel .sbfa-delay { width: 55px; }
#sbfa-panel .sbfa-check { display: flex; align-items: center; gap: 6px; cursor: pointer; }
#sbfa-panel .sbfa-check input { margin: 0; }

#sbfa-panel button {
  background: #2a475e;
  color: #fff;
  border: none;
  border-radius: 3px;
  padding: 5px 12px;
  cursor: pointer;
}
#sbfa-panel button:hover:not(:disabled) { background: #66c0f4; color: #0e141b; }
#sbfa-panel button:disabled { opacity: 0.4; cursor: default; }
#sbfa-panel .sbfa-start { background: #5c7e10; }
#sbfa-panel .sbfa-toggle { padding: 0 8px; }

#sbfa-panel code { color: #66c0f4; }
#sbfa-panel .sbfa-warn { color: #e5b143; }
#sbfa-panel .sbfa-progress { font-weight: bold; }

#sbfa-panel .sbfa-log {
  max-height: 180px;
  overflow-y: auto;
  background: #0e141b;
  border-radius: 3px;
  padding: 4px 6px;
  font-family: Consolas, monospace;
  font-size: 11px;
}
#sbfa-panel .sbfa-log:empty { display: none; }
#sbfa-panel .sbfa-log-ok { color: #a4d007; }
#sbfa-panel .sbfa-log-warn { color: #e5b143; }
#sbfa-panel .sbfa-log-error { color: #ff6b6b; }
`);

(() => {
  if (!/^\/(id|profiles|my)\/([^/]+\/)?friends/.test(location.pathname)) return;
  if (document.getElementById("sbfa-panel")) return;
  console.log("[Steam Bulk Friend Adder] loaded");

  const NICKNAME_MAX = 32;
  const STORAGE_KEYS = ["prefix", "delay", "input", "collapsed", "nickOnly"];
  const gmSet = (obj) => Object.entries(obj).forEach(([k, v]) => GM_setValue(k, v));
  const gmGet = (keys, cb) => cb(Object.fromEntries(keys.map((k) => [k, GM_getValue(k)])));

  // ---------- Steam helpers ----------

  function getSessionId() {
    const match = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  async function postForm(url, data) {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams(data).toString(),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      // Steam sometimes answers with HTML or an empty body
    }
    return { ok: res.ok, status: res.status, json };
  }

  // Known EResult codes Steam returns from AddFriendAjax
  const ADD_FRIEND_ERRORS = {
    2: "generic failure",
    8: "invalid SteamID",
    11: "invite blocked / not allowed",
    14: "already pending or already friends",
    15: "access denied (account may be limited)",
    25: "friend invite limit reached",
    29: "duplicate request",
    40: "you are blocked by this user",
    84: "rate limited – wait a while and retry",
  };

  async function addFriend(steamId, sessionId) {
    const { ok, status, json } = await postForm("https://steamcommunity.com/actions/AddFriendAjax", {
      sessionID: sessionId,
      steamid: steamId,
      accept_invite: 0,
    });
    if (json && (json.success === 1 || json.success === true)) return { ok: true };
    // Already friends / invite already sent count as fine for our purpose
    if (json && Array.isArray(json.failed_invites_result) && json.failed_invites_result.includes(14)) {
      return { ok: true, note: "already invited/friends" };
    }
    const code = json?.success ?? json?.failed_invites_result?.[0];
    const reason = ADD_FRIEND_ERRORS[code] || (code != null ? `error code ${code}` : `HTTP ${status}`);
    return { ok: false, reason, code, httpOk: ok };
  }

  async function setNickname(steamId, nickname, sessionId) {
    const { status, json } = await postForm(
      `https://steamcommunity.com/profiles/${steamId}/ajaxsetnickname/`,
      { nickname, sessionid: sessionId }
    );
    if (json && (json.success === 1 || json.success === true)) return { ok: true };
    return { ok: false, reason: json?.success != null ? `error code ${json.success}` : `HTTP ${status}` };
  }

  // ---------- Parsing ----------

  function parseInput(text) {
    const entries = [];
    const errors = [];
    const seen = new Set();
    text.split(/\r?\n/).forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const comma = line.indexOf(",");
      const id = (comma === -1 ? line : line.slice(0, comma)).trim();
      const name = comma === -1 ? "" : line.slice(comma + 1).trim();
      if (!/^7656\d{13}$/.test(id)) {
        errors.push(`Line ${i + 1}: "${id}" is not a valid SteamID64 (must be 17 digits starting with 7656)`);
        return;
      }
      if (seen.has(id)) {
        errors.push(`Line ${i + 1}: duplicate ${id}, skipped`);
        return;
      }
      seen.add(id);
      entries.push({ id, name });
    });
    return { entries, errors };
  }

  // ---------- UI ----------

  const panel = document.createElement("div");
  panel.id = "sbfa-panel";
  panel.innerHTML = `
    <div class="sbfa-header">
      <span>Bulk Friend Adder</span>
      <button class="sbfa-toggle" title="Collapse">–</button>
    </div>
    <div class="sbfa-body">
      <label>One per line: <code>SteamID64,Name</code></label>
      <textarea class="sbfa-input" spellcheck="false" placeholder="76561198000000000,Bob&#10;76561198000000001,Alice"></textarea>
      <div class="sbfa-row">
        <label>Prefix <input class="sbfa-prefix" type="text" placeholder="e.g. #"></label>
        <label>Delay (s) <input class="sbfa-delay" type="number" min="1" step="0.5" value="3"></label>
      </div>
      <label class="sbfa-check"><input class="sbfa-nickonly" type="checkbox"> Nicknames only (don't send friend requests)</label>
      <div class="sbfa-preview"></div>
      <div class="sbfa-row">
        <button class="sbfa-start">Start</button>
        <button class="sbfa-stop" disabled>Stop</button>
        <button class="sbfa-clear-log">Clear log</button>
      </div>
      <div class="sbfa-progress"></div>
      <div class="sbfa-log"></div>
    </div>
  `;
  document.body.appendChild(panel);

  const $ = (sel) => panel.querySelector(sel);
  const inputEl = $(".sbfa-input");
  const prefixEl = $(".sbfa-prefix");
  const delayEl = $(".sbfa-delay");
  const nickOnlyEl = $(".sbfa-nickonly");
  const previewEl = $(".sbfa-preview");
  const startBtn = $(".sbfa-start");
  const stopBtn = $(".sbfa-stop");
  const progressEl = $(".sbfa-progress");
  const logEl = $(".sbfa-log");
  const toggleBtn = $(".sbfa-toggle");

  function save() {
    gmSet({
      prefix: prefixEl.value,
      delay: delayEl.value,
      input: inputEl.value,
      nickOnly: nickOnlyEl.checked,
      collapsed: panel.classList.contains("sbfa-collapsed"),
    });
  }

  function setCollapsed(collapsed) {
    panel.classList.toggle("sbfa-collapsed", collapsed);
    toggleBtn.textContent = collapsed ? "+" : "–";
  }

  function log(msg, type = "info") {
    const div = document.createElement("div");
    div.className = `sbfa-log-${type}`;
    div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function fullName(name) {
    return name ? prefixEl.value + name : "";
  }

  function updatePreview() {
    const { entries, errors } = parseInput(inputEl.value);
    const tooLong = entries.filter((e) => fullName(e.name).length > NICKNAME_MAX).length;
    let html = `<b>${entries.length}</b> valid entr${entries.length === 1 ? "y" : "ies"}`;
    if (entries[0]?.name) html += ` · first nickname: <code></code>`;
    if (errors.length) html += ` · <span class="sbfa-warn">${errors.length} problem line(s)</span>`;
    if (tooLong) html += ` · <span class="sbfa-warn">${tooLong} nickname(s) over ${NICKNAME_MAX} chars</span>`;
    previewEl.innerHTML = html;
    const code = previewEl.querySelector("code");
    if (code) code.textContent = fullName(entries[0].name);
    previewEl.title = errors.join("\n");
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let running = false;
  let stopRequested = false;

  async function run() {
    const sessionId = getSessionId();
    if (!sessionId) {
      log("Could not find your Steam session. Make sure you are logged in.", "error");
      return;
    }

    const { entries, errors } = parseInput(inputEl.value);
    errors.forEach((e) => log(e, "warn"));
    if (!entries.length) {
      log("Nothing to do.", "warn");
      return;
    }

    const delayMs = Math.max(1, parseFloat(delayEl.value) || 3) * 1000;
    const nickOnly = nickOnlyEl.checked;
    running = true;
    stopRequested = false;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    inputEl.disabled = prefixEl.disabled = delayEl.disabled = nickOnlyEl.disabled = true;

    let added = 0, named = 0, failed = 0;
    const remaining = [];

    for (let i = 0; i < entries.length; i++) {
      const { id, name } = entries[i];
      if (stopRequested) {
        remaining.push(...entries.slice(i));
        break;
      }
      progressEl.textContent = `Processing ${i + 1} / ${entries.length}…`;
      const nick = fullName(name).slice(0, NICKNAME_MAX);

      if (nickOnly && !nick) {
        log(`${id}: no name given, skipped`, "warn");
        continue;
      }

      try {
        const fr = nickOnly ? { ok: true, skipped: true } : await addFriend(id, sessionId);
        if (fr.skipped) {
          // nicknames-only mode: no friend request
        } else if (fr.ok) {
          added++;
          log(`${id}: friend request sent${fr.note ? ` (${fr.note})` : ""}`, "ok");
        } else {
          failed++;
          log(`${id}: friend request failed – ${fr.reason}`, "error");
          if (fr.code === 25 || fr.code === 84) {
            log("Stopping: Steam is refusing more invites right now.", "error");
            remaining.push(...entries.slice(i));
            break;
          }
        }

        if (nick) {
          const nr = await setNickname(id, nick, sessionId);
          if (nr.ok) {
            named++;
            log(`${id}: nickname set to "${nick}"`, "ok");
          } else {
            if (nickOnly) failed++;
            log(`${id}: setting nickname failed – ${nr.reason}`, "error");
          }
        }
      } catch (err) {
        failed++;
        log(`${id}: network error – ${err.message}`, "error");
      }

      if (i < entries.length - 1 && !stopRequested) await sleep(delayMs);
    }

    // Leave only unprocessed lines in the box so a re-run continues where it stopped
    if (remaining.length) {
      inputEl.value = remaining.map((e) => (e.name ? `${e.id},${e.name}` : e.id)).join("\n");
      log(`${remaining.length} entr${remaining.length === 1 ? "y" : "ies"} left in the box – press Start to continue.`, "warn");
    } else {
      inputEl.value = "";
    }

    progressEl.textContent = nickOnly
      ? `Done. Nicknames set: ${named}, failed: ${failed}.`
      : `Done. Requests sent: ${added}, nicknames set: ${named}, failed: ${failed}.`;
    running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    inputEl.disabled = prefixEl.disabled = delayEl.disabled = nickOnlyEl.disabled = false;
    updatePreview();
    save();
  }

  // ---------- Events ----------

  startBtn.addEventListener("click", () => {
    if (!running) run();
  });
  stopBtn.addEventListener("click", () => {
    stopRequested = true;
    log("Stopping after the current entry…", "warn");
  });
  $(".sbfa-clear-log").addEventListener("click", () => {
    logEl.textContent = "";
  });
  toggleBtn.addEventListener("click", () => {
    setCollapsed(!panel.classList.contains("sbfa-collapsed"));
    save();
  });
  [inputEl, prefixEl, delayEl, nickOnlyEl].forEach((el) =>
    el.addEventListener("input", () => {
      updatePreview();
      save();
    })
  );

  gmGet(STORAGE_KEYS, (data) => {
    if (data.prefix != null) prefixEl.value = data.prefix;
    if (data.delay != null) delayEl.value = data.delay;
    if (data.input != null) inputEl.value = data.input;
    nickOnlyEl.checked = !!data.nickOnly;
    setCollapsed(!!data.collapsed);
    updatePreview();
  });
})();
