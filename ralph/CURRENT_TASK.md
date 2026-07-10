# Current Task — WS-V: HERE Truck-Routing Library

**Workstream:** WS-V — HERE Truck-Routing Library
**Attempt:** 1
**Status:** COMPLETE — PASS 93/100, see STATE.md

## Scope
Build a pure TypeScript library for truck-aware routing on the HERE platform: geocoding, truck routing with rig dimensions/weight, flexible-polyline decoding, and truck-stop / rest-area discovery along a route corridor. Returns a `SavedTrip`-shaped object suitable for caching (HERE free tier = 30k tx/mo — never re-spend quota on a trip already fetched). **No UI. No map rendering. No App.tsx wiring. No sync.ts changes.** Persistence is WS-W's job.

## Files
**Primary (create):**
- `src/lib/geo/flexpolyline.ts` — vendored HERE flexible-polyline codec (MIT reference), pure, zero deps.
- `src/lib/geo/here.ts` — HERE API client: `geocode`, `truckRoute`, `findTruckStops`, `findRestAreas`, `planTrip`, typed `HereError`.

**Shared (touch only as described):**
- `.env.example` — add `VITE_HERE_API_KEY=` with a one-line comment.
- `src/types.ts` — READ FIRST. `TruckProfile`, `SavedTrip`, `TripStop` already exist (WS-N) — do NOT redefine; match field names/units. Add `DEFAULT_TRUCK_PROFILE` (20,000 lb · 10 ft · 48 ft · 7 ft) only if missing, in the established constants location.

**Do NOT touch:** `src/lib/sync.ts`, `src/App.tsx`, any View, Android/Capacitor files.

## Steps
1. Read existing types (TruckProfile/SavedTrip/TripStop field names + units — imperial lb/ft). Add DEFAULT_TRUCK_PROFILE only if absent.
2. `flexpolyline.ts`: port HERE MIT reference decoder → `decode(encoded): {lat,lng}[]`, consuming header (precision, 3rd-dim flag) correctly. Keep MIT header. Pure, no deps.
3. `here.ts`: key helper works in Vite AND Node (`import.meta.env?.VITE_HERE_API_KEY ?? globalThis.process?.env?.VITE_HERE_API_KEY`). Typed `HereError` with `code: 'missing_key'|'offline'|'quota_exceeded'|'bad_request'|'no_results'|'api_error'`. Every export throws only HereError.
4. `geocode(query)` → GET geocode.search.hereapi.com/v1/geocode?q&limit=1&apiKey → `{lat,lng,label}`; empty → no_results.
5. `truckRoute(origin,dest,profile)` → router.hereapi.com/v8/routes, transportMode=truck, origin/destination, return=polyline,summary,actions,tolls, avoid[features]=ferry, truck[grossWeight] kg=ceil(lb*0.453592), truck[height|length|width] cm=ceil(ft*30.48), truck[axleCount] if field exists. Return {distanceMeters,durationSeconds,polyline[],notices[],tolls?}; sum multi-section, concat decoded polylines.
6. `findTruckStops`/`findRestAreas` → browse.search.hereapi.com/v1/browse sampled ~every 50km (≤~12 pts), in=circle r=8000, verified category IDs (truck stop 700-7900-0131, fuel 700-7600-0116, rest area 400-4300-0000 family — verify vs HERE docs, cite in comment). Dedupe by id, annotate distance-along-route, sort asc, map to TripStop shape. One shared browseAlongRoute internal.
7. `planTrip(originQuery,destQuery,profile,opts?)` — geocode both, truckRoute, both POI searches → SavedTrip-shaped object (weekendId undefined). No storage writes. `opts.skipPois` for route-only.
8. `.env.example`: add VITE_HERE_API_KEY with comment.
9. `npm run lint` + `npm run build`; fix new issues.

## Acceptance criteria
- [ ] flexpolyline.ts zero-dep, MIT attribution, decode() reproduces HERE test vector `BFoz5xJ67i1B1B7PzIhaxL7Y` → 4 pts ≈(50.10228,8.69821)…(50.09878,8.68752) within 1e-5.
- [ ] here.ts exports geocode, truckRoute, findTruckStops, findRestAreas, planTrip, HereError; no `any` in exported signatures.
- [ ] Truck params metric (kg/cm), rounded up; avoid ferry + return=polyline,summary,actions,tolls present.
- [ ] planTrip returns SavedTrip shape; POIs TripStop-shaped, sorted by distance-along-route; no localStorage/Supabase writes; sync.ts untouched.
- [ ] Missing key / offline / 429 / empty each throw HereError with correct code; no raw fetch rejection escapes.
- [ ] POI sampling capped; skipPois works; category IDs commented with source.
- [ ] No new npm deps; no UI/JSX; TruckProfile/SavedTrip/TripStop not redefined; DEFAULT_TRUCK_PROFILE added only if missing.
- [ ] lint clean except 3 baseline errors; build succeeds (Windows).

## Out of scope
WS-W trip UI/map/Leaflet/tab wiring; WS-T/WS-S (parked); WS-X; SavedTrip persistence/sync; offline tiles; turn-by-turn; native.

## Verification
Temporary `scripts/smoke-here.ts` (delete after, or mark temporary): (1) decode test vector no-network, assert 4 pts within 1e-5; (2) live geocode("Charlotte Motor Speedway, Concord NC") finite lat/lng + label; (3) live short truck route to nearby point with DEFAULT_TRUCK_PROFILE → distance>0, duration>0, polyline.length>0; (4) key unset → throws HereError code missing_key; (5) optional findTruckStops → array sorted. Print PASS/FAIL, exit non-zero on fail. Then `npm run lint` (3 baseline), `npm run build`. Delete smoke script before done.
