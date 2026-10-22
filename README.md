# Steam Bulk Friend Adder

A Tampermonkey userscript that adds a panel to your Steam Community friends page.
Paste lines like:

```
76561198000000000,Bob
76561198000000001,Alice
```

It sends a friend request to each SteamID64 and sets the nickname to the name after the comma.
The optional **Prefix** is put in front of every nickname (e.g. `#` → `#Bob`).

## Install (Tampermonkey)

Works in Chrome, Edge, Opera / Opera GX, Brave and Firefox.

### Step 1 – Install Tampermonkey
Tampermonkey is a free browser extension that runs small scripts ("userscripts") on websites.

1. Go to **https://www.tampermonkey.net/**. The site detects your browser automatically.
2. Click **Download** / **Get from Store**. This opens your browser's extension store.
3. Click **Add to Chrome** / **Add to Opera** / **Get** / **Add to Firefox** and confirm.
4. A black square icon with two circles appears in your toolbar. If you don't see it, click the puzzle-piece (extensions) icon and pin **Tampermonkey**.

### Step 2 – Allow Tampermonkey to run scripts (Chrome, Edge, Opera, Opera GX, Brave)
Newer Chromium-based browsers block userscripts until you allow them. **If you skip this step, the panel will not appear**, even though Tampermonkey says the script is on.
Firefox users can skip to Step 3.

1. Open the extensions page by typing this in the address bar:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Opera / Opera GX: `opera://extensions` (or press **Ctrl+Shift+E**)
   - Brave: `brave://extensions`
2. Turn on **Developer mode** with the switch in the top-right corner of that page.
3. Find **Tampermonkey** in the list and click **Details**.
4. Scroll down and turn on **Allow User Scripts** if you see that switch. On some browser versions it doesn't exist, and Developer mode alone is enough.
5. In the same Details page, set **Site access** to **On all sites** if that option is shown.
6. **Close the browser completely and open it again.** Opera GX keeps running in the system tray, so right-click its tray icon and choose **Exit**.

### Step 3 – Install the script
1. Click this link: **[Install Steam Bulk Friend Adder](https://raw.githubusercontent.com/GaffGit/Steam-bulk-friend-adder/main/steam-bulk-friend-adder.user.js)**
2. Tampermonkey opens an install page showing the script name, version and the sites it runs on (`steamcommunity.com`).
3. Click **Install**. The tab closes or shows "installed".

If the link just shows plain code instead of an install page, Tampermonkey isn't installed or is turned off. Go back to Step 1.

### Step 4 – Open your Steam friends page
1. Log in at **https://steamcommunity.com** in the same browser.
2. Open **https://steamcommunity.com/my/friends**. This shortcut always goes to your own friends page.
3. A **Bulk Friend Adder** panel appears in the top-right corner, with the version number in its title. The **–** button collapses it and **+** opens it again.

### Updates
Tampermonkey checks for new versions automatically about once a day. To update right away, click the Tampermonkey icon → **Dashboard**, tick **Steam Bulk Friend Adder**, choose **Check for userscript updates** in the drop-down menu, and click **Start**.

## How to use
1. Paste your list into the big box, one person per line: `SteamID64,Name`.
2. Optional: type a **Prefix**. It is added in front of every name.
3. Optional: change **Delay**, the number of seconds to wait between people. 3 or more is recommended.
4. Optional: tick **Nicknames only** to rename people without sending friend requests, for example to switch everyone to a new prefix.
5. Below the options, the panel shows how many lines are valid and a preview of the first nickname. Hover over a yellow warning to see which lines have problems.
6. Click **Start**. The log shows each step in green (OK), yellow (warning) or red (error).
7. Click **Stop** to stop after the current person. Unprocessed lines stay in the box, so pressing **Start** again continues where you left off.

Your prefix, delay, list and checkbox setting are remembered the next time you open the page.

## Notes
- A SteamID64 has 17 digits and starts with `7656`. Invalid lines and duplicates are skipped and listed in the log.
- Lines without a name only get a friend request. Nicknames are cut to 32 characters, Steam's limit.
- Adding someone who is already your friend is harmless: no new request is created, but their nickname is updated.
- If Steam reports an invite limit or rate limit, the run stops automatically.
- Limited Steam accounts (ones that have never spent $5) cannot send friend requests.
- It only works in a web browser, not in the Steam desktop app's friends list.

## Troubleshooting
**The panel doesn't appear**
1. Make sure you did Step 2 (Developer mode / Allow User Scripts) and restarted the browser.
2. Click the Tampermonkey icon while on the friends page. **Steam Bulk Friend Adder** should be listed with its switch on. If there is a yellow or red warning at the top, follow what it says.
3. Press **F12** → **Console**, type `Bulk` in the filter box, and reload the page. You should see `[Steam Bulk Friend Adder] loaded v…`. If you don't, the script isn't running, so go back to Step 2.

**I see an old version (no version number or missing options)**
You probably have more than one copy installed. In the Tampermonkey Dashboard, delete every "Steam Bulk Friend Adder" script. Also remove any unpacked "Steam Bulk Friend Adder" extension from your extensions page. Then do Step 3 again.
