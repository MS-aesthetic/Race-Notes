import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');
const app = source('src/App.tsx');
const garage = source('src/components/GarageView.tsx');

assert.match(app, /import \{ useUndoableDelete \} from '\.\/lib\/undo';/);
assert.match(app, /import UndoToast, \{ InfoToast \} from '\.\/components\/ui\/UndoToast';/);
assert.match(app, /const carUndo = useUndoableDelete<Car>\(\);/);
assert.match(app, /const pendingCarId = carUndo\.pending\?\.id \?\? null;/);
assert.match(app, /cars=\{pendingCarId \? cars\.filter\(car => car\.id !== pendingCarId\) : cars\}/);
assert.match(app, /<UndoToast pending=\{carUndo\.pending\} onUndo=\{carUndo\.undo\} onDismiss=\{carUndo\.dismiss\}/);

const deleteStart = app.indexOf('const handleDeleteCar = (carId: string) => {');
const deleteEnd = app.indexOf('// ── Clear All Data', deleteStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'car delete handler must remain isolated');
const deleteHandler = app.slice(deleteStart, deleteEnd);
assert.ok(deleteHandler.indexOf("alert('Reassign or delete this car\\'s data first.')") < deleteHandler.indexOf('carUndo.requestDelete'), 'data guard must run before undo request');
assert.match(deleteHandler, /removeFromState: \(\) => \{\},\s*restoreToState: \(\) => \{\}/s);
assert.match(deleteHandler, /const accountId = userRef\.current\?\.id \?\? null;/);
assert.match(deleteHandler, /const ownerId = syncOwnerIdRef\.current;/);
assert.match(deleteHandler, /const generation = authGenerationRef\.current;/);
assert.match(deleteHandler, /userRef\.current\?\.id !== accountId[\s\S]*syncOwnerIdRef\.current !== ownerId[\s\S]*authGenerationRef\.current !== generation/);
assert.match(deleteHandler, /const latestCars = carsRef\.current;/);
assert.match(deleteHandler, /handleSaveCars\(updated, accountId\);/);
assert.match(deleteHandler, /if \(activeCarIdRef\.current === carId\)/);
assert.match(deleteHandler, /activeCarIdRef\.current = null;\s*setActiveCarId\(null\);\s*localStorage\.removeItem\('race_notes_active_car'\);/s);
assert.doesNotMatch(deleteHandler, /deleteCarFromCloud|deleteTeamSharedRecordFromCloud/);

assert.match(app, /const handleSaveCars = \(updated: Car\[\], expectedAccountId\?: string \| null\) => \{/);
assert.match(app, /carsRef\.current\s*\.filter\(car => !remainingIds\.has\(car\.id\)\)\s*\.forEach\(car => queueSharedCloudDelete\('cars', car\.id, false, currentAccountId\)\)/s);
assert.match(app, /const accountId = expectedAccountId === undefined\s*\? userRef\.current\?\.id \?\? null\s*: expectedAccountId;/s);
assert.match(app, /const carsRef = useRef\(cars\);\s*useEffect\(\(\) => \{ carsRef\.current = cars; \}, \[cars\]\);/s);
assert.match(app, /const activeCarIdRef = useRef\(activeCarId\);\s*useEffect\(\(\) => \{ activeCarIdRef\.current = activeCarId; \}, \[activeCarId\]\);/s);

assert.match(garage, /flex items-center gap-2 flex-shrink-0/);
assert.match(garage, /className="tap-target p-1\.5 text-on-surface-variant\/60/);
assert.match(garage, /className=\{`tap-target p-1\.5 rounded transition-colors/);

console.log('CAR_DELETE_UNDO_HARNESS PASS');
