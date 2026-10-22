(() => {
  if (!/^\/(id|profiles|my)\/([^/]+\/)?friends/.test(location.pathname)) return;
  if (document.getElementById("sbfa-panel")) return;
  console.log("[Steam Bulk Friend Adder] loaded");

  const NICKNAME_MAX = 32;
  const STORAGE_KEYS = ["prefix", "delay", "input", "collapsed"];

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
  const previewEl = $(".sbfa-preview");
  const startBtn = $(".sbfa-start");
  const stopBtn = $(".sbfa-stop");
  const progressEl = $(".sbfa-progress");
  const logEl = $(".sbfa-log");
  const toggleBtn = $(".sbfa-toggle");

  function save() {
    chrome.storage.local.set({
      prefix: prefixEl.value,
      delay: delayEl.value,
      input: inputEl.value,
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
    running = true;
    stopRequested = false;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    inputEl.disabled = prefixEl.disabled = delayEl.disabled = true;

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

      try {
        const fr = await addFriend(id, sessionId);
        if (fr.ok) {
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

    progressEl.textContent = `Done. Requests sent: ${added}, nicknames set: ${named}, failed: ${failed}.`;
    running = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    inputEl.disabled = prefixEl.disabled = delayEl.disabled = false;
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
  [inputEl, prefixEl, delayEl].forEach((el) =>
    el.addEventListener("input", () => {
      updatePreview();
      save();
    })
  );

  chrome.storage.local.get(STORAGE_KEYS, (data) => {
    if (data.prefix != null) prefixEl.value = data.prefix;
    if (data.delay != null) delayEl.value = data.delay;
    if (data.input != null) inputEl.value = data.input;
    setCollapsed(!!data.collapsed);
    updatePreview();
  });
})();
