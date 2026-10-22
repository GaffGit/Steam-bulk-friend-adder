# Steam Bulk Friend Adder

A Chrome/Edge extension that adds a panel to your Steam Community friends page.
Paste lines like:

```
76561198000000000,Bob
76561198000000001,Alice
```

It sends a friend request to each SteamID64 and sets the nickname to the name after the comma.
The optional **Prefix** is put in front of every nickname (e.g. `#` → `#Bob`).

## Install
1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Log in at steamcommunity.com and open your friends page (`https://steamcommunity.com/id/<you>/friends/`).

## Notes
- A SteamID64 has 17 digits and starts with `7656`. Invalid lines are skipped and listed in the log.
- Lines without a name only get a friend request. Nicknames are cut to 32 characters, Steam's limit.
- **Delay** sets the wait between people. Steam rate-limits invites, so keep it at around 3 seconds or more.
- If Steam reports an invite limit or rate limit, the run stops. Any lines not yet processed stay in the box so you can continue later.
- Limited Steam accounts (ones that have never spent $5) cannot send friend requests.

## Tampermonkey / Violentmonkey (userscript)
1. Install [Tampermonkey](https://www.tampermonkey.net/) or Violentmonkey.
2. On Chrome/Edge, turn on **Allow User Scripts** in Tampermonkey's extension details page (or **Developer mode** on older versions).
3. Click **[Install the userscript](https://raw.githubusercontent.com/GaffGit/Steam-bulk-friend-adder/main/steam-bulk-friend-adder.user.js)** and confirm in Tampermonkey.
