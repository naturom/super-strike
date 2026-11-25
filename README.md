# Super Strike — Dust III & Depot

An original desktop browser multiplayer FPS, implemented with Next.js, TypeScript, Three.js, Rapier and an authoritative Colyseus server. Choose between **Dust III** (default), a hand-authored reconstruction with Long, Mid, raised Short, CT passage, and upper/lower tunnels, and **Depot**, a compact 40 × 35 metre industrial arena with two open warehouses, three connected ground routes and a 2.8 metre catwalk reached by stairs. Depot replaces Relay while retaining its internal map identifier so old invitations continue to work. The Dust III proportions and elevations are approximate; its geometry and scenery are authored here, and no Valve game assets are included. Use **Scout the map** in the lobby to inspect every arena. All maps support deathmatch and unlimited-time bomb defusal. Spawn mirrors are available on Dust III only. PBR sandstone and sand textures are CC0 from Poly Haven; see [asset sources](ASSETS.md).

## Play

Maps include Dust III, Depot and **Jungle Island**, a mid-sized tropical island with 168 varied trees, dense bushes and ferns, sandy coves, mossy rocks and fallen logs. Jungle Island supports both game modes, weapon pickups, minimap navigation and eight scout viewpoints. Its shallow seabed can be walked in both directions; water footsteps use recorded splashes. A 10-second breath timer counts only while the entire standing or crouched body is submerged, then drains 2.5 displayed HP per second until the player surfaces. Surfacing resets the timer. Occasional ambient reef sharks pass through the deep-water area and are visible only underwater. Occasional ambient reef sharks pass by underwater.

**Night Market** adds lantern-lit streets, eight colourful shophouses, a covered food pavilion, illuminated shop signs and connected back alleys. The map uses static light pools and three shadowless live lights, supports both game modes, and restores normal daylight when switching to another arena.

**Sunken Caverns** adds vaulted limestone chambers, a dry gallery and gently sloping flooded tunnels with exits at both ends. A short submerged siphon uses the same ten-second full-body breath timer and drowning rules as the island. Expedition lamps, columns and stalactites mark the routes. Both modes, supplies, site markers and seven scout views are supported, including a bird’s-eye lobby cutaway that restores the complete cave roof during gameplay.


Choose a map and game mode, create a room, enter a guest callsign, and copy the invitation link to a friend. Invitations are carried in the URL fragment, so they are not sent in normal HTTP request URLs. Teams balance automatically, with four players per team and eight per room. Only the room creator can change maps or randomize teams from the pause/results screen. Host access survives reconnections and round resets; it is not passed to guests when the creator leaves. The room creator chooses a different character for each team from Iron Man, Ultraman and Wonder Woman (defaults: Team A Iron Man, Team B Ultraman). These choices stay with the signed invitation, respawns and new games; guests are automatically assigned their team’s appearance. A full room displays an explicit notice. The lobby uses reusable character portraits while the 3D arena loads after its first paint; physics starts when entering a game. Profile rotation previews initialize one at a time and keep a portrait visible until ready. After changing character geometry or materials, regenerate the portraits with `npm run portraits`, open the printed localhost address and click Generate character thumbnails.

Click **Enter the arena** to capture your mouse. Escape releases it. Open **Controls** beside Copy invitation link in the pause menu for grouped keyboard and mouse instructions; Escape closes the instructions and returns to the menu.

| Control | Action |
| --- | --- |
| W A S D / mouse | Move / look |
| Left click | Use selected item: slash, fire, or throw; hold for rifle/SMG |
| Space / Shift | Jump / sprint (cannot fire while sprinting) |
| W / S at a ladder | Climb up / back down; Space lets go |
| R | Reload |
| 1 | Knife |
| 2 / 3 | Equipped pistol / primary gun |
| Q | Toggle between the equipped pistol and primary gun |
| T | Spray the transparent character portrait on a wall, floor, box or car |
| E | Pick up a nearby gun or dropped C4; hold near enemy C4 to defuse |
| 4, then hold/release left click | Pull the pin, hold to aim, release to throw a frag grenade |
| 5, then hold left click | Select your team’s C4; Team A plants at A, Team B at B |
| C / Ctrl | Hold to crouch |
| Tab | Hold scoreboard |
| Escape | Menu, invite, leave |

Deathmatch rounds last ten minutes or end at 30 kills. Players display 100 HP and take half the original non-headshot damage (twice the damage tolerance), respawn in five seconds, and cannot damage teammates. Respawns receive 1.5 seconds of protection, cancelled by firing or throwing a grenade. Rifle: 25 damage, 600 RPM, 30 rounds, 1.8-second reload. Pistol: 20 damage, maximum 300 RPM, 12 rounds, 1.2-second reload. Ammunition reserves are unlimited; magazines and reload times are enforced. The next game starts automatically after a five-second results countdown.

Dust III has four marked return ladders on the **outside** of its perimeter: north, Long/east, T spawn/south and west. Walk into a ladder to climb, keep moving forward over its top landing to return to the arena, or use S to reverse and Space to let go. There are no inner perimeter ladders to climb out from. The scout tower uses an enclosed ladder from its building entrance to a guarded lookout hatch. Gold ladder symbols mark these routes on the minimap. Climbing uses shared server/client movement and metal rung sounds.

Anyone in a room can use **Randomize teams** beside Change map to shuffle the entire roster into balanced teams and start a fresh game on the current map. With an odd player count, either team can receive the extra player. Team appearances, spawns and C4 carriers follow the new assignment. The invitation link, player identities, game mode and More fun setting stay with the room. Disconnected seats retain their new assignment when reconnecting.

Anyone in a room can use **Change map** in the pause menu (Esc) or the end-of-game screen. Switching starts a fresh game for everyone while keeping the same room, invitation link, player identities, teams, game mode, character choices and More fun setting. Health, loadouts, scores and map objects reset. Reconnecting and later joins use the room’s current map.

Team radio plays “Go, go, go!” when entering each new game and when the next game starts. Actual grenade releases play “Fire in the hole!” to the thrower and their teammates, at radio volume regardless of distance. Holding or cancelling a grenade does not announce a throw. The sound toggle mutes the calls along with the other effects.

**More fun** is enabled by default when creating a room. It enables surprise flower guns, T-rexes and the F-key dog companion; turn it off for a classic room with all of them disabled. Invitations, reconnects and subsequent games retain the creator’s setting.

With More fun enabled, each new game secretly selects one primary-gun rack at each base as a flower gun. Pistols, including the P-12 and Desert Eagle, always fire normally. All racks and untested guns look ordinary. The first trigger pull extends one flower from the muzzle instead of firing; that gun stays harmless, consumes no ammunition, and keeps its flower until replaced or the player respawns. The reveal is shared with other players, mirrors and spectators. Base selections are rerolled for the next game. Press F to deploy one dog per player per game. No dog appears beforehand. It targets enemies only, deals 2.5 displayed HP per bite with a maximum of three bites, and leaves after those bites or 22 seconds. Enemy fire can stop it; the sender and teammates are protected. Respawning and reconnecting do not restore the charge, while a new game does. The visible lobby keeps these surprises undisclosed.

Fall damage applies on all maps to any drop, including tower-to-roof, roof-to-ground, boxes and vehicles. Drops of 4 m or less are safe; base damage then rises progressively to 100 at 15 m; doubled player durability halves the displayed health loss (5 m: 2 HP; 8 m: 13 HP; 12 m: 32.5 HP; 15 m or more: 50 HP). The server measures each uninterrupted fall from the highest airborne foot position to the actual landing surface, including a jump apex. Landing ends that fall, so subsequent drops are measured independently. Ordinary jumps, stairs and continuous ramps are safe. Fall damage bypasses spawn protection, awards no kill/score to the falling player, and follows the normal death/body/respawn or C4 elimination rules.

**Bomb Defusal:** Each team has one C4 and one enemy target: **red attacks A and defends B; blue attacks B and defends A**. On Dust III, Site A is in the CT courtyard beside Team B’s starts and Site B is on the T terrace beside Team A’s starts. On Depot, A is in the east Dispatch warehouse and B is in the west Goods In warehouse. Each defender starts within about 3–9 metres of its site. One player on each team carries its charge. Select it with **5** and hold left click at your assigned site for **3.2 seconds**. Each planted bomb has its own **40-second fuse**. The first detonation wins; an exact simultaneous detonation is a draw. Hold **E** within reach and line of sight of enemy C4 for **10 seconds** to defuse it. Defusing stops that charge while the round and your own charge continue. Only teammates can recover their dropped C4. Movement, jumping, releasing the button, switching away while planting, dying or disconnecting cancels progress. HUD and radar distinguish your C4 from the enemy’s, with independent countdowns and progress.

Bomb rounds have **unlimited time** and one life once both teams are present. A planted charge starts its own **40-second fuse**. A team wins by eliminating the opponent once no enemy planted charge remains. Both charges defused or simultaneous elimination without planted charges results in a draw. Killing a carrier after planting never stops the fuse. Late joiners wait for the next round. After a five-second results countdown, the next game automatically resets both teams, charges and equipment. Solo games have the same one-life reset flow: dying ends the game, shows the five-second results countdown, then starts a fresh game with health, weapons, selection, grenades and C4 reset. Controls carry a spawn identity so delayed inputs from a previous life cannot re-equip old weapons or trigger actions after restarting. There is no buy economy or defuse-kit inventory.

In bomb defusal, dead players spectate a living, connected player in first person while the game continues. **Space** cycles through living players on either team. The camera, weapon, character hands, crouch height, sniper zoom, health/ammo display and radar follow the selected player. Dead or disconnected targets are skipped automatically; the next game restores the viewer's own controls. Spectating is view-only and retains the dead player's session identity, so movement, firing, grenades, pickups and other gameplay inputs cannot control the watched player. Spectators are exempt from the idle-action timeout until play resumes. Deathmatch retains its normal death camera and respawn flow.

The knife deals 20 displayed HP of damage within 1.8 metres, with one slash per click and a half-second cooldown. Solid cover, friendly-fire rules and spawn protection apply. It uses no ammunition. Selecting a grenade does not throw it. Hold left click to pull the pin ring and keep the grenade ready while aiming. Release left click to begin throwing. Aim continues to track the latest mouse direction during the forward motion and locks only when the grenade actually leaves the hand; once airborne, later camera turns do not steer it. A quick tap still completes the pin pull before throwing; a long hold stays ready until released. The server creates the flying grenade when it leaves the hand, then starts its fuse. Mirrors and spectators follow the same pin pull, aiming hold, throw and open-finger recovery. After the last grenade’s throw animation finishes, the player automatically equips their current primary gun in slot 3. The empty grenade slot cannot be reselected; choosing slot 4 with no grenades keeps the primary equipped.

Weapon racks on all maps offer the original SMG and scoped AWP, plus AK-47, suppressed M4A1-S, P90, SCAR-H, M249 and Desert Eagle. The added guns have distinct models in first person, mirrors and world pickups; damage, firing cadence, magazines, recoil and reload timing vary by gun. The P90 has a top-mounted 50-round magazine, the M249 has a 100-round belt box and animated feed cover, and the Desert Eagle has a seven-round magazine. M4A1-S reports are quieter and carry a smaller muzzle flash. Primary pickups replace slot 3 while retaining your sidearm; the Desert Eagle replaces the sidearm in slot 2 while retaining your primary; each rack supplies one gun per round and stays empty after collection until the next round or map reset. Respawning restores rifle, pistol and two grenades. Grenades bounce, explode 2.2 seconds after release, and apply distance-based damage within 8.8 metres, respecting solid cover. They can hurt their thrower but not teammates.

Swapping guns, dying or permanently leaving an active match drops the relevant guns onto their supporting floor. Ground guns retain their remaining magazine ammo and can be collected with **E** by either team, including later joiners. They stay through respawns without a despawn timer, disappear when collected, and clear when a new round or map starts. Picking one up drops the replaced gun from the same slot. Ground models lie still on their sides, stay clear of display stands, and share instanced drawing batches. The M4A1-S has its own carry handle, round ribbed handguard, fixed stock, short magazine and suppressor, distinct from the AR-30’s rail chassis and reflex sight. The AWP report has a deeper bass body and a 2.5-second rolling tail while retaining its initial crack.

Crouching lowers your camera and hitbox and slows movement; standing is blocked under low cover. Incoming hits produce a directional red indicator, screen vignette, sound and brief camera jolt. Numeric health and a health bar show HP remaining; low health adds a pulse and heartbeat. Reduced-motion preferences suppress camera shake and weapon bob.

Directional audio combines synthesized gun reports with recorded knife swishes, dry player-impact Foley, metallic wall contacts and boots on stone, gravel, wood and metal, plus recorded airsoft magazine and action handling for reloads. Reload clips are edited to match each weapon’s reload time without changing the pitch or speed of the mechanical transients. Recordings are bundled as mono WAV files, fetched from the game server and decoded once; there is no synthetic fallback for footsteps, reloads or knife sounds. Sources, licenses and changes are listed in [audio credits](apps/web/public/audio/CREDITS.txt), also linked from the lobby. Nearby teammates and enemies can hear each other: footsteps fade out at 25 m walking, 32 m sprinting and 7 m crouching; crouching is substantially quieter. Footstep cadence follows travelled distance, with no steps while airborne or stationary. Cover muffles footsteps, gunfire, reloads and knife sounds; distance softens high frequencies and adds propagation delay. Reload sounds stop when the server cancels the reload (including switching weapons or dying). Four recorded footstep takes per surface reduce repetition, and overlapping combat voices are capped. Pickups, grenade throws, explosions and damage also have sound. Audio starts after clicking Enter/Explore and can be muted in the menu. Grenades have a sharp pressure crack, deeper bass thump, broader flash/dust burst and 4.4 seconds of smoke; C4 has a larger flash, debris, ten-second dust/smoke cloud and an 8.5-second rolling bass/reflection tail. Sound delay and high-frequency absorption follow distance, and cover muffles the blast. The C4 result screen waits 3.2 seconds so the blast remains visible. Effects are capped, cleaned up on rematch/exit, and flashes/shake respect reduced-motion preferences. Lighting, sky, shadows, textured surfaces, shutters, roof details, palms and background buildings improve the environment while keeping the rendering lightweight. These are stylized procedural models, not photorealistic scanned environments.

## Run locally

Requires Node.js **22.13+** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. The one Node process serves both Next.js HTTP and Colyseus WebSocket traffic on the same port. No database, Redis or login is needed. An ephemeral signing key is generated for local development. To keep local invitations valid across restarts, provide an environment variable `INVITE_SECRET` with at least 32 cryptographically random bytes; do not commit it.

```sh
npm run typecheck
npm test
npm run build
INVITE_SECRET='<your-local-secret>' npm start
```

The production server refuses to start without a signing key. `PORT` defaults to 3000 locally and 8080 in the container. Production secrets are injected from Google Secret Manager.

## Layout

- `apps/web`: Next.js lobby, HUD, scoreboard, connection lifecycle and imperative Three.js renderer.
- `apps/server`: Colyseus room lifecycle, HTTP entry point, authoritative simulation and invite validation.
- `packages/shared`: map definitions, protocol, weapon settings, deterministic movement and hitscan geometry.
- `deploy`: multistage Dockerfile, Cloud Build configuration and explicit Cloud Run deployment script.
- `tests`: unit, real WebSocket integration/load and process-restart tests.
- `scripts`: end-to-end verification through public APIs and headless Chrome browser checks.

## Authority and synchronization

The server runs at **30 Hz**, broadcasting authoritative snapshots at **20 Hz**. A gap in input sequence IDs after a network/rate-limit burst resumes from the newest input instead of permanently rejecting the player’s controls; queue size, fixed movement steps, fire cooldowns and old-life input rejection still apply. Clients send bounded control inputs with monotonic sequence numbers, never positions, health, damage, ammunition or timestamps. The server consumes at most one input per tick, bounds queue size and checks fire cooldowns, reloads, owned weapons, pickup distance/visibility, crouch clearance, grenade physics/blasts, collision, target occlusion, spawn protection, deaths and scores. A shared fixed-step kinematic box solver handles movement. Client prediction replays unacknowledged inputs against each authoritative snapshot, with camera correction smoothing. Remote avatars interpolate a 100 ms snapshot buffer.

Rapier runs on the client for physical impact debris, raycasts and collision against the same static arena geometry. It does not decide damage or authoritative player movement. Three.js renders original procedural models with CC0 surface textures. Static meshes are batched by material to reduce draw calls. Gameplay cover has shared server/client box geometry; foliage and decorative trim are visual. Players do not physically block each other. Hitboxes are uniform boxes, without headshots or lag compensation.

HTTP bodies and WebSocket payloads are bounded. Matchmaking is available only through the signed-invite endpoint, with per-IP HTTP and per-session input limits and same-origin browser checks. Rooms are capped at 12 per process. Guests inactive for two minutes are disconnected; closing the browser releases the seat after the reconnection window. No external keep-warm requests or transport ping traffic are scheduled. A live match naturally sends snapshots and inputs while its WebSockets remain connected.

## Invitations, reconnection and restarts

Invitations are HMAC-SHA256 tokens with a random 128-bit room identity and a seven-day expiry. The constant signing secret is stored in **Secret Manager**, so valid invitations survive scale-to-zero and instance restart. Tokens identify invitations and the selected map, not persisted scores. Existing invitations using the Relay identifier now open Depot.

Unexpected disconnects reserve a player's seat for 20 seconds. The client retries with backoff and its Colyseus reconnection token. If the old match is no longer reachable, the client rejoins using the invitation and displays a fresh-match notice when applicable. Browser refresh can recover a stored reconnection token from session storage. If a room has been disposed or the process restarted, its invitation creates a **new match with zero scores**. Expired or malformed invitations are rejected.

State is exclusively in memory. Session affinity is enabled as a best-effort aid. Cloud Run's maximum-instance setting does **not** prevent all instance/revision overlap, and affinity does not guarantee routing to the same instance. During overlap, identical invitation links can reach separate in-memory matches; a lost match cannot be recovered. This is an explicit limitation of the requested no-database/no-Redis architecture. WebSocket requests can end at the one-hour service timeout; reconnection handles that as a transport drop.

## Verification

```sh
npm run typecheck
npm test
npm run build
# Against a running production or dev server:
npm run test:live
MAP_ID=relay npm run test:live
npm run test:browser
# Against deployment:
BASE_URL='https://<service-url>' npm run test:live
BASE_URL='https://<service-url>' npm run test:browser
```

The browser script uses installed Google Chrome on macOS. Override `CHROME_PATH` for another compatible executable. It opens isolated, temporary browser profiles, verifies WebGL, two-player joining, pointer lock, keyboard input, ammo after firing, reload, weapon switch, pickups, crouching, grenade throws, damage feedback and health changes, active Web Audio, both map selections, scoreboard and leaving. Screenshots go to ignored `artifacts/`.

Unit tests cover eight-player limits, balanced teams, spawn clearance, collision, jumping/roof collision, input validation, flood/replay rejection, fire rates, ammunition/reloads, hits, friendly fire, deaths, respawns, scoring, timeouts, rematches and token security. Integration tests use actual WebSockets with eight clients at 30 input messages per second each, plus reconnection and room disposal/recreation. A separate test kills and relaunches a real server process to verify the same signed invitation creates a fresh match. The public API smoke test navigates two clients through the actual map, obtains a real kill, verifies score and respawn, reconnects, fills eight seats and rejects a ninth. It also checks weapon pickups, crouch state and grenade blast damage on either map. It has no privileged test endpoints.

These are short correctness/load runs, not a sustained capacity benchmark. Browser performance on low-end hardware, high-latency intercontinental play, a full ten-minute human match, an actual Cloud Run scale-to-zero cycle and one-hour timeout are not established by these tests. Round timeout is covered by simulated time. Desktop keyboard/mouse is required; the lobby is responsive but touch gameplay is not implemented.

## Deploy to Google Cloud

Project: **nood-429501**. Region: **asia-southeast1**. Service: **desert-fps**.

Dedicated resources:

- Artifact Registry Docker repository `desert-fps` in `asia-southeast1`.
- Runtime account `desert-fps-runtime@nood-429501.iam.gserviceaccount.com`.
- Secret `desert-fps-invite-secret`, version 1, with access granted only to that runtime account (plus inherited project administrators).

The default authenticated Cloud Build account builds the image. The Docker build runs typecheck, all unit/integration tests and the production build, then prunes development dependencies. The runtime runs as an unprivileged Linux user. Do not bake signing secrets into images.

```sh
bash deploy/deploy.sh nood-429501 <unique-image-tag>
```

Requested configuration, verified after deployment in `DEPLOYMENT.md`:

- Request-based billing, CPU throttling enabled outside requests.
- Minimum instances 0; maximum 1 at both service and revision levels.
- 2 vCPU, 2 GiB memory, concurrency 100, request timeout 3600 seconds.
- Public HTTPS/WSS endpoint, `/health` startup probe and best-effort session affinity.

**Not zero cost:** active WebSockets are billable requests. Cloud Run CPU/memory/request usage, Cloud Build, Artifact Registry storage, network egress and logging may incur charges. Idle open matches can continue billing until the connection ends. The game disconnects inactive guests after two minutes; no keep-warm service is provisioned.

View actual settings and logs:

```sh
gcloud run services describe desert-fps --project=nood-429501 --region=asia-southeast1 --format=yaml
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="desert-fps"' --project=nood-429501 --limit=50 --format=json
```

Delete the service to stop it accepting traffic:

```sh
gcloud run services delete desert-fps --project=nood-429501 --region=asia-southeast1
```

Optional cleanup of **only the game's dedicated resources** (deleting the secret permanently invalidates all invitations):

```sh
gcloud artifacts repositories delete desert-fps --project=nood-429501 --location=asia-southeast1
gcloud secrets delete desert-fps-invite-secret --project=nood-429501
gcloud iam service-accounts delete desert-fps-runtime@nood-429501.iam.gserviceaccount.com --project=nood-429501
```

Cloud Build source archives and retained logs can remain after deleting the service; inspect the project's build history before removing only this game's artifacts. No unrelated resources should be removed.

References: [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets), [session affinity](https://docs.cloud.google.com/run/docs/configuring/session-affinity), [Colyseus reconnection](https://docs.colyseus.io/room/reconnection).

### Sniper scope

Pick up the AWP-8 sniper rifle and select your primary weapon with **3**. **Right-click** cycles 3× zoom, 8× zoom and normal view. Scoped aiming slows in proportion to magnification. Firing keeps the selected zoom through the bolt cycle and follow-up shots, including the view seen by spectators. Reloading, sprinting, switching equipment, death, releasing the mouse or leaving the match clears zoom. Other equipment cannot scope. Damage, ammunition and firing rules are unchanged.

Cave navigation uses indexed nearby collision geometry and a fair, incremental path-search queue (up to 24 node expansions and approximately 2 ms per creature profile per simulation tick). The minimap keeps immutable terrain in one cached SVG image while player and C4 markers update independently. Character arms reuse their local mesh/GPU buffers while their joints, grip and torso seam are unchanged. Bounded `room_lag` logs record slow ticks, long tick gaps and recovered/rate-limited inputs with room/map identifiers and creature counts; room creation logs include the invitation’s public ID without its signing token.

In **More fun** rooms, press **C** to toggle playing dead; **Ctrl** remains hold-to-crouch. A living character lies still with a ground-level view, lowered hitboxes and hidden floating callsign/equipment, remains vulnerable, and still counts as alive. Movement, firing and interactions pause until getting up. The action needs supported ground and enough room for the body, respects standing clearance, and resets on respawn/new games. Other players, mirrors and spectators share the same pose.
