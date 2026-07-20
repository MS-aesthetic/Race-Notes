import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';
import { mergeTimestampedRecords, repairSetupDeletionReferences } from '../src/lib/setupLifecycle';

const source = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8');
const app = source('src/App.tsx');
const garage = source('src/components/GarageView.tsx');

assert.match(app, /import \{ useUndoableDelete \} from '\.\/lib\/undo';/);
assert.match(app, /import UndoToast from '\.\/components\/ui\/UndoToast';/);
assert.match(app, /const carUndo = useUndoableDelete<Car>\(\);/);
assert.match(app, /const pendingCarId = carUndo\.pending\?\.id \?\? null;/);
assert.match(app, /cars=\{pendingCarId \? cars\.filter\(car => car\.id !== pendingCarId\) : cars\}/);
assert.match(app, /onSaveCars=\{handleSaveGarageCars\}/);
assert.match(app, /onSelectCar=\{handleSelectGarageCar\}/);
assert.match(app, /<UndoToast pending=\{carUndo\.pending\} onUndo=\{carUndo\.undo\} onDismiss=\{carUndo\.dismiss\}/);
assert.match(app, /const garageAutoSelectSuppressionRef = useRef<string \| null>\(null\);/);

const garageSaveStart = app.indexOf('const handleSaveGarageCars = (visibleUpdated: Car[]) => {');
const garageSaveEnd = app.indexOf('const handleSelectCar', garageSaveStart);
assert.ok(garageSaveStart >= 0 && garageSaveEnd > garageSaveStart, 'Garage save boundary must remain isolated');
const garageSave = app.slice(garageSaveStart, garageSaveEnd);
assert.match(garageSave, /const canonicalCars = carsRef\.current;/);
assert.match(garageSave, /const visibleById = new Map\(visibleUpdated\.map\(car => \[car\.id, car\]\)\);/);
assert.match(garageSave, /canonicalCars\.length === 1[\s\S]*canonicalCars\[0\]\.id === pendingCarId[\s\S]*activeCarIdRef\.current === pendingCarId[\s\S]*visibleUpdated\.length === 1[\s\S]*addedCar/s);
assert.match(garageSave, /garageAutoSelectSuppressionRef\.current = addedCar\.id;[\s\S]*queueMicrotask/s);
assert.match(garageSave, /car\.id === pendingCarId \? car : visibleById\.get\(car\.id\) \?\? car/);
assert.match(garageSave, /concat\(visibleUpdated\.filter\(car => !canonicalIds\.has\(car\.id\)\)\)/);
assert.match(garageSave, /handleSaveCars\(reconciled\);/);

const garageSelectStart = app.indexOf('const handleSelectGarageCar = (carId: string) => {');
const garageSelectEnd = app.indexOf('const handleSaveMaintenanceLogs', garageSelectStart);
assert.ok(garageSelectStart >= 0 && garageSelectEnd > garageSelectStart, 'Garage select adapter must remain isolated');
const garageSelect = app.slice(garageSelectStart, garageSelectEnd);
assert.match(garageSelect, /if \(garageAutoSelectSuppressionRef\.current === carId\) \{\s*garageAutoSelectSuppressionRef\.current = null;\s*return;/s);
assert.match(garageSelect, /handleSelectCar\(carId\);/);

const deleteStart = app.indexOf('const handleDeleteCar = (carId: string) => {');
const deleteEnd = app.indexOf('// ── Clear All Data', deleteStart);
assert.ok(deleteStart >= 0 && deleteEnd > deleteStart, 'car delete handler must remain isolated');
const deleteHandler = app.slice(deleteStart, deleteEnd);
assert.doesNotMatch(deleteHandler, /car-has-data|sc \+ tc \+ shc/, 'D3 scoped data no longer blocks car delete');
assert.match(app, /'car-delete-queued': \(\{ label \}: InfoCopyContext\) => `\$\{label \|\| 'Car'\} and linked records removed from this device\. Any queued cloud deletion will retry until confirmed\.`/);
assert.match(deleteHandler, /removeFromState: \(\) => \{\},\s*restoreToState: \(\) => \{\}/s);
assert.match(deleteHandler, /const accountId = userRef\.current\?\.id \?\? null;/);
assert.match(deleteHandler, /if \(\(userRef\.current\?\.id \?\? null\) !== accountId\) return;/);
assert.match(app, /const queueSharedCloudDelete = \([\s\S]*?if \(!accountId\) return;[\s\S]*?enqueuePendingTeamDelete/);
assert.doesNotMatch(deleteHandler, /const ownerId =|const generation =|authGenerationRef\.current !==|syncOwnerIdRef\.current !==/);
assert.match(deleteHandler, /const latestCars = carsRef\.current;/);
assert.doesNotMatch(deleteHandler, /handleSaveCars|markSavedDirty|flashSaved/, 'D3 bypasses dirty save adapters');
assert.match(deleteHandler, /if \(activeCarIdRef\.current === carId\)/);
assert.match(deleteHandler, /activeCarIdRef\.current = nextCar\?\.id \?\? null;[\s\S]*localStorage\.removeItem\('race_notes_active_car'\);/);
assert.doesNotMatch(deleteHandler, /deleteCarFromCloud|deleteTeamSharedRecordFromCloud/);

const clearStart = app.indexOf('const handleClearAllData = async () => {');
const clearEnd = app.indexOf('const handleDeleteAccount', clearStart);
assert.ok(clearStart >= 0 && clearEnd > clearStart, 'Clear All handler must remain isolated');
const clearHandler = app.slice(clearStart, clearEnd);
assert.ok(clearHandler.indexOf('carUndo.undo();') < clearHandler.indexOf("localStorage.removeItem(k)"), 'Clear All must cancel pending car before storage clear');
assert.match(clearHandler, /carsRef\.current = \[\];\s*activeCarIdRef\.current = null;\s*setSavedSetups/s);
assert.ok(clearHandler.indexOf('carsRef.current = [];') < clearHandler.indexOf('setCars([]);'), 'cars ref must clear before React state');
assert.ok(clearHandler.indexOf('activeCarIdRef.current = null;') < clearHandler.indexOf('setActiveCarId(null);'), 'active-car ref must clear before React state');

assert.match(app, /const handleSaveCars = \(updated: Car\[\], expectedAccountId\?: string \| null\) => \{/);
assert.match(app, /carsRef\.current\s*\.filter\(car => !remainingIds\.has\(car\.id\)\)\s*\.forEach\(car => queueSharedCloudDelete\('cars', car\.id, false, currentAccountId\)\)/s);
assert.match(app, /if \(expectedAccountId !== undefined && currentAccountId !== expectedAccountId\) return;/);
assert.match(app, /const currentSyncOwnerId = syncOwnerIdRef\.current;\s*if \(currentSyncOwnerId\) pushCars\(updated, currentSyncOwnerId/s);
assert.match(app, /const carsRef = useRef\(cars\);\s*useEffect\(\(\) => \{ carsRef\.current = cars; \}, \[cars\]\);/s);
assert.match(app, /const activeCarIdRef = useRef\(activeCarId\);\s*useEffect\(\(\) => \{ activeCarIdRef\.current = activeCarId; \}, \[activeCarId\]\);/s);

assert.match(garage, /flex items-center gap-2 flex-shrink-0/);
assert.match(garage, /className="tap-target p-1\.5 text-on-surface-muted/);
assert.match(garage, /className=\{`tap-target p-1\.5 rounded transition-colors/);

interface SimCar {
  id: string;
  chassis: string;
  name?: string;
  updatedAt: string;
}

interface DeleteIntent {
  accountId: string;
  carId: string;
}

const bytes = (value: unknown) => JSON.stringify(value);
const car = (id: string, chassis = id): SimCar => ({ id, chassis, updatedAt: `time-${id}` });

const reconcileVisibleGarageSave = (
  canonicalCars: SimCar[],
  visibleUpdated: SimCar[],
  pendingCarId: string | null,
): SimCar[] => {
  if (!pendingCarId) return visibleUpdated;
  const visibleById = new Map(visibleUpdated.map(item => [item.id, item]));
  const canonicalIds = new Set(canonicalCars.map(item => item.id));
  return canonicalCars
    .map(item => item.id === pendingCarId ? item : visibleById.get(item.id) ?? item)
    .concat(visibleUpdated.filter(item => !canonicalIds.has(item.id)));
};

type CommitTrigger = 'forced' | 'timeout' | 'dismiss' | 'pagehide' | 'unmount';

class CarDeleteSimulation {
  carsRef: SimCar[];
  stateCars: SimCar[];
  storageCars: SimCar[];
  activeCarId: string | null;
  activeStorage: string | null;
  accountId: string | null;
  ownerId: string | null;
  authGeneration = 1;
  pending: { carId: string; accountId: string | null } | null = null;
  deleteIntents: DeleteIntent[] = [];
  pushes: Array<{ ownerId: string; ids: string[] }> = [];
  commitTriggers: CommitTrigger[] = [];
  garageAutoSelectSuppression: string | null = null;
  saveCount = 0;

  constructor(cars: SimCar[], accountId: string | null = 'account-a', ownerId: string | null = 'owner-a') {
    this.carsRef = cars;
    this.stateCars = cars;
    this.storageCars = cars;
    this.activeCarId = cars[0]?.id ?? null;
    this.activeStorage = this.activeCarId;
    this.accountId = accountId;
    this.ownerId = ownerId;
  }

  visibleCars() {
    return this.pending ? this.stateCars.filter(item => item.id !== this.pending!.carId) : this.stateCars;
  }

  requestDelete(carId: string) {
    if (this.pending) this.consumePending('forced');
    assert.ok(this.carsRef.some(item => item.id === carId));
    this.pending = { carId, accountId: this.accountId };
  }

  saveCars(updated: SimCar[], expectedAccountId?: string | null) {
    if (expectedAccountId !== undefined && this.accountId !== expectedAccountId) return;
    if (this.accountId) {
      const remaining = new Set(updated.map(item => item.id));
      this.carsRef
        .filter(item => !remaining.has(item.id))
        .forEach(item => this.deleteIntents.push({ accountId: this.accountId!, carId: item.id }));
    }
    this.carsRef = updated;
    this.stateCars = updated;
    this.storageCars = updated;
    this.saveCount += 1;
    if (this.ownerId) this.pushes.push({ ownerId: this.ownerId, ids: updated.map(item => item.id) });
  }

  saveFromGarage(visibleUpdated: SimCar[]) {
    const canonicalCars = this.carsRef;
    const pendingCarId = this.pending?.carId ?? null;
    const canonicalIds = new Set(canonicalCars.map(item => item.id));
    const addedCar = visibleUpdated.find(item => !canonicalIds.has(item.id)) ?? null;
    if (canonicalCars.length === 1
      && canonicalCars[0].id === pendingCarId
      && this.activeCarId === pendingCarId
      && visibleUpdated.length === 1
      && addedCar) {
      this.garageAutoSelectSuppression = addedCar.id;
    }
    this.saveCars(reconcileVisibleGarageSave(canonicalCars, visibleUpdated, pendingCarId));
  }

  selectCar(carId: string) {
    assert.ok(this.carsRef.some(item => item.id === carId));
    this.activeCarId = carId;
    this.activeStorage = carId;
  }

  selectFromGarage(carId: string) {
    if (this.garageAutoSelectSuppression === carId) {
      this.garageAutoSelectSuppression = null;
      return;
    }
    this.selectCar(carId);
  }

  addFromGarage(newCar: SimCar) {
    const renderedCars = this.visibleCars();
    this.saveFromGarage([...renderedCars, newCar]);
    if (renderedCars.length === 0) this.selectFromGarage(newCar.id);
    this.garageAutoSelectSuppression = null; // queueMicrotask boundary
  }

  undo() {
    this.pending = null;
  }

  private consumePending(trigger: CommitTrigger) {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    this.commitTriggers.push(trigger);
    if (this.accountId !== pending.accountId) return;
    const updated = this.carsRef.filter(item => item.id !== pending.carId);
    if (updated.length === this.carsRef.length) return;
    this.saveCars(updated, pending.accountId);
    if (this.activeCarId === pending.carId) {
      this.activeCarId = updated[0]?.id ?? null;
      this.activeStorage = this.activeCarId;
    }
  }

  timeout() { this.consumePending('timeout'); }
  dismiss() { this.consumePending('dismiss'); }
  pagehide() { this.consumePending('pagehide'); }
  unmount() { this.consumePending('unmount'); }

  clearAll() {
    this.undo();
    this.carsRef = [];
    this.activeCarId = null;
    this.stateCars = [];
    this.storageCars = [];
    this.activeStorage = null;
  }
}

// Sole active pending car makes Garage look empty. Add's synchronous auto-select is suppressed only once.
const solePending = car('sole-pending');
const soleAddSim = new CarDeleteSimulation([solePending]);
soleAddSim.requestDelete(solePending.id);
soleAddSim.addFromGarage(car('sole-new'));
assert.equal(soleAddSim.activeCarId, solePending.id);
assert.equal(soleAddSim.activeStorage, solePending.id);
assert.deepEqual(soleAddSim.stateCars.map(item => item.id), ['sole-pending', 'sole-new']);
assert.deepEqual(soleAddSim.deleteIntents, []);
soleAddSim.undo();
assert.equal(soleAddSim.activeCarId, solePending.id);
assert.deepEqual(soleAddSim.stateCars.map(item => item.id), ['sole-pending', 'sole-new']);
soleAddSim.selectFromGarage('sole-new');
assert.equal(soleAddSim.activeCarId, 'sole-new', 'later deliberate selection must work');

// A true zero-car Add has no pending suppression and still auto-selects normally.
const trueZeroSim = new CarDeleteSimulation([]);
trueZeroSim.addFromGarage(car('first-real-car'));
assert.equal(trueZeroSim.activeCarId, 'first-real-car');
assert.equal(trueZeroSim.activeStorage, 'first-real-car');

// Delete + add + Undo: hidden car stays byte-identical and never becomes a delete intent.
const pendingAdd = car('pending-add');
const addSim = new CarDeleteSimulation([pendingAdd, car('other-add')]);
const pendingAddBytes = bytes(pendingAdd);
addSim.requestDelete(pendingAdd.id);
addSim.saveFromGarage([...addSim.visibleCars(), car('new-add')]);
assert.equal(bytes(addSim.carsRef.find(item => item.id === pendingAdd.id)), pendingAddBytes);
assert.deepEqual(addSim.deleteIntents, []);
addSim.undo();
assert.deepEqual(addSim.stateCars.map(item => item.id), ['pending-add', 'other-add', 'new-add']);

// Delete + edit + Undo: visible edit persists without altering or deleting hidden car.
const pendingEdit = car('pending-edit');
const editSim = new CarDeleteSimulation([pendingEdit, car('other-edit')]);
const pendingEditBytes = bytes(pendingEdit);
editSim.requestDelete(pendingEdit.id);
editSim.saveFromGarage(editSim.visibleCars().map(item => item.id === 'other-edit'
  ? { ...item, chassis: 'edited chassis', updatedAt: 'edited-time' }
  : item));
assert.equal(bytes(editSim.carsRef.find(item => item.id === pendingEdit.id)), pendingEditBytes);
assert.equal(editSim.carsRef.find(item => item.id === 'other-edit')?.chassis, 'edited chassis');
assert.deepEqual(editSim.deleteIntents, []);
editSim.undo();
assert.deepEqual(editSim.stateCars.map(item => item.id), ['pending-edit', 'other-edit']);
assert.equal(editSim.stateCars[1].chassis, 'edited chassis');

// Clear All cancels pending work before timeout/pagehide/unmount can save stale refs.
const clearSim = new CarDeleteSimulation([car('pending-clear'), car('other-clear')]);
clearSim.requestDelete('pending-clear');
clearSim.clearAll();
const savesAfterClear = clearSim.saveCount;
clearSim.timeout();
clearSim.pagehide();
clearSim.unmount();
clearSim.dismiss();
assert.deepEqual(clearSim.carsRef, []);
assert.deepEqual(clearSim.stateCars, []);
assert.deepEqual(clearSim.storageCars, []);
assert.equal(clearSim.activeCarId, null);
assert.equal(clearSim.activeStorage, null);
assert.equal(clearSim.saveCount, savesAfterClear);
assert.deepEqual(clearSim.commitTriggers, []);

// Each lifecycle trigger consumes one slot exactly once; later triggers cannot duplicate queue/push.
const lifecycleActions: Record<Exclude<CommitTrigger, 'forced'>, (sim: CarDeleteSimulation) => void> = {
  timeout: sim => sim.timeout(),
  dismiss: sim => sim.dismiss(),
  pagehide: sim => sim.pagehide(),
  unmount: sim => sim.unmount(),
};
for (const [trigger, consume] of Object.entries(lifecycleActions) as Array<[Exclude<CommitTrigger, 'forced'>, (sim: CarDeleteSimulation) => void]>) {
  const lifecycleSim = new CarDeleteSimulation([car(`pending-${trigger}`), car(`fallback-${trigger}`)]);
  lifecycleSim.requestDelete(`pending-${trigger}`);
  consume(lifecycleSim);
  lifecycleSim.timeout();
  lifecycleSim.dismiss();
  lifecycleSim.pagehide();
  lifecycleSim.unmount();
  assert.deepEqual(lifecycleSim.commitTriggers, [trigger]);
  assert.deepEqual(lifecycleSim.deleteIntents, [{ accountId: 'account-a', carId: `pending-${trigger}` }]);
  assert.equal(lifecycleSim.saveCount, 1);
  assert.equal(lifecycleSim.pushes.length, 1);
  assert.equal(lifecycleSim.activeCarId, `fallback-${trigger}`);
}

// A deliberate newer active selection survives delayed commit of the pending car.
const newerSelectionSim = new CarDeleteSimulation([car('pending-selection'), car('newer-selection')]);
newerSelectionSim.requestDelete('pending-selection');
newerSelectionSim.selectFromGarage('newer-selection');
newerSelectionSim.timeout();
assert.equal(newerSelectionSim.activeCarId, 'newer-selection');
assert.equal(newerSelectionSim.activeStorage, 'newer-selection');

// Second request force-commits first exactly once, then remains independently undoable/committable.
const sequentialSim = new CarDeleteSimulation([car('sequential-first'), car('sequential-second'), car('sequential-third')]);
sequentialSim.requestDelete('sequential-first');
sequentialSim.requestDelete('sequential-second');
assert.deepEqual(sequentialSim.commitTriggers, ['forced']);
assert.deepEqual(sequentialSim.deleteIntents, [{ accountId: 'account-a', carId: 'sequential-first' }]);
assert.equal(sequentialSim.pending?.carId, 'sequential-second');
sequentialSim.undo();
assert.deepEqual(sequentialSim.stateCars.map(item => item.id), ['sequential-second', 'sequential-third']);
assert.equal(sequentialSim.saveCount, 1);
sequentialSim.requestDelete('sequential-second');
sequentialSim.dismiss();
assert.deepEqual(sequentialSim.commitTriggers, ['forced', 'dismiss']);
assert.deepEqual(sequentialSim.deleteIntents, [
  { accountId: 'account-a', carId: 'sequential-first' },
  { accountId: 'account-a', carId: 'sequential-second' },
]);
assert.deepEqual(sequentialSim.stateCars.map(item => item.id), ['sequential-third']);
assert.equal(sequentialSim.saveCount, 2);
assert.equal(sequentialSim.pushes.length, 2);

// Owner resolution and same-account auth refresh must not cancel valid pending work.
const ownerResolveSim = new CarDeleteSimulation([car('pending-owner'), car('owner-fallback')], 'account-a', null);
ownerResolveSim.requestDelete('pending-owner');
ownerResolveSim.ownerId = 'resolved-owner';
ownerResolveSim.timeout();
assert.deepEqual(ownerResolveSim.deleteIntents, [{ accountId: 'account-a', carId: 'pending-owner' }]);
assert.deepEqual(ownerResolveSim.pushes, [{ ownerId: 'resolved-owner', ids: ['owner-fallback'] }]);

const refreshSim = new CarDeleteSimulation([car('pending-refresh')]);
refreshSim.requestDelete('pending-refresh');
refreshSim.authGeneration += 1;
refreshSim.dismiss();
assert.deepEqual(refreshSim.stateCars, []);
assert.deepEqual(refreshSim.deleteIntents, [{ accountId: 'account-a', carId: 'pending-refresh' }]);

// Unresolved owner still records the account-scoped retry intent; cloud upsert waits.
const retrySim = new CarDeleteSimulation([car('pending-retry')], 'account-a', null);
retrySim.requestDelete('pending-retry');
retrySim.pagehide();
assert.deepEqual(retrySim.deleteIntents, [{ accountId: 'account-a', carId: 'pending-retry' }]);
assert.deepEqual(retrySim.pushes, []);

// Different account replacement data remains byte-identical and receives no old intent.
const accountSim = new CarDeleteSimulation([car('pending-account')]);
accountSim.requestDelete('pending-account');
accountSim.accountId = 'account-b';
accountSim.ownerId = 'owner-b';
const accountBCars = [car('account-b-car')];
accountSim.carsRef = accountBCars;
accountSim.stateCars = accountBCars;
accountSim.storageCars = accountBCars;
const accountBBytes = bytes(accountBCars);
accountSim.unmount();
assert.equal(bytes(accountSim.stateCars), accountBBytes);
assert.equal(bytes(accountSim.storageCars), accountBBytes);
assert.deepEqual(accountSim.deleteIntents, []);
assert.deepEqual(accountSim.pushes, []);

// D3: compile and execute the real App cascade. The harness captures the real
// Undo descriptor, then invokes its delayed commit against deterministic refs.
let d3AssertionCount = 0;
const d3Ok = (value: unknown, message: string) => { d3AssertionCount += 1; assert.ok(value, message); };
const d3Equal = (actual: unknown, expected: unknown, message: string) => { d3AssertionCount += 1; assert.equal(actual, expected, message); };
const d3Deep = (actual: unknown, expected: unknown, message: string) => { d3AssertionCount += 1; assert.deepEqual(actual, expected, message); };

type D3DeleteDescriptor = { commit: () => void; removeFromState: () => void; restoreToState: () => void };
const compileD3Handler = (sourceText: string) => {
  const start = sourceText.indexOf('  const handleDeleteCar = (carId: string) => {');
  const end = sourceText.indexOf('\n\n  // ── Clear All Data', start);
  assert.ok(start >= 0 && end > start, 'D3 production handler slice exists');
  const handler = sourceText.slice(start, end);
  const dependencyNames = [
    'carsRef', 'userRef', 'carUndo', 'savedSetupsRef', 'tireInventoryRef', 'shockSessionsRef',
    'maintenanceRef', 'maintenanceLogsRef', 'weekendsRef', 'syncOwnerIdRef', 'teamRef',
    'queueSharedCloudDelete', 'enqueuePendingPersonalTireDelete', 'setDeleteReplayVersion',
    'setSavedSetups', 'setTireInventory', 'setShockSessions', 'setMaintenanceLogs',
    'setMaintenance', 'setCars', 'setWeekends', 'setActiveCarId', 'setSetup',
    'pushSetups', 'pushTires', 'pushShockSessions', 'pushMaintenanceLogs',
    'pushMaintenanceComponents', 'pushCars', 'pushWeekends', 'setSyncStatus', 'repairSetupDeletionReferences',
    'activeCarIdRef', 'currentSetupRef', 'syncStatusRef', 'isTerminalSyncStatus', 'pickLatestSetupForCar', 'INITIAL_SETUP', 'showInfo', 'setup', 'localStorage', 'window',
  ];
  const wrapped = `export const makeD3Handler = (deps) => {\n  const { ${dependencyNames.join(', ')} } = deps;\n${handler}\n  return handleDeleteCar;\n};`;
  const compiled = transformSync(wrapped, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
  return (moduleBox.exports.makeD3Handler as (deps: Record<string, unknown>) => (carId: string) => void);
};

type D3Run = {
  descriptor: D3DeleteDescriptor;
  sharedQueues: Array<[string, string, boolean, string | null]>;
  tireQueues: Array<{ accountId: string; tireId: string }>;
  pushes: Array<[string, string, string[]]>;
  states: Record<string, unknown>;
  storage: Map<string, string>;
  infos: unknown[];
  refs: Record<string, { current: any }>;
  sessionsBefore: string;
  setupBefore: string;
  commit: () => void;
};

const d3Car = (id: string) => ({ id, chassis: id, carType: 'Modified', updatedAt: `time-${id}` });
type D3Identity = { accountId: string | null; syncOwnerId: string | null };
const signedInD3Identity: D3Identity = { accountId: 'account-a', syncOwnerId: 'owner-a' };
const signedOutD3Identity: D3Identity = { accountId: null, syncOwnerId: null };
const runD3Cascade = (
  sourceText = app,
  activeCarId = 'car-delete',
  replacementCars = [d3Car('car-next'), d3Car('car-third')],
  identity: D3Identity = signedInD3Identity,
): D3Run => {
  const target = d3Car('car-delete');
  const setupDelete = { id: 'setup-delete', carId: 'car-delete', chassis: 'Delete', date: 'now', lf: {}, rf: {}, lr: {}, rr: {} };
  const setupNext = { id: 'setup-next', carId: 'car-next', chassis: 'Next', date: 'later', sourceSetupId: 'setup-delete', lf: {}, rf: {}, lr: {}, rr: {} };
  const setupThird = { id: 'setup-third', carId: 'car-third', chassis: 'Third', date: 'old', lf: {}, rf: {}, lr: {}, rr: {} };
  const session = { id: 'session-history', setupId: 'setup-delete', setupSnapshot: { id: 'setup-delete', lf: { tirePress: '12' } }, setupUsed: 'Delete', notes: 'immutable', legacy: { nested: true } };
  const weekend = { id: 'weekend-history', name: 'History', track: 'Track', date: 'date', sessions: [session], setupId: 'setup-delete', sourceSetupId: 'setup-delete', baselineSetupId: 'setup-delete', activeSetupId: 'setup-delete', finalSetupId: 'setup-delete', setupName: 'keep', updatedAt: 'keep' };
  const rigComponent = { id: 'component-rig', scope: 'rig', name: 'Trailer', carId: 'car-delete' };
  const deleteComponent = { id: 'component-delete', scope: 'car', carId: 'car-delete', name: 'Motor' };
  const otherComponent = { id: 'component-other', scope: 'car', carId: 'car-next', name: 'Other' };
  const refs: Record<string, { current: any }> = {
    carsRef: { current: [target, ...replacementCars] },
    userRef: { current: identity.accountId ? { id: identity.accountId } : null },
    savedSetupsRef: { current: [setupDelete, setupNext, setupThird] },
    tireInventoryRef: { current: [{ id: 'tire-delete', carId: 'car-delete' }, { id: 'tire-keep', carId: 'car-next' }] },
    shockSessionsRef: { current: [{ id: 'shock-delete', carId: 'car-delete' }, { id: 'shock-keep', carId: 'car-next' }] },
    maintenanceRef: { current: [deleteComponent, rigComponent, otherComponent] },
    maintenanceLogsRef: { current: [{ id: 'log-delete', componentId: 'component-delete' }, { id: 'log-rig', componentId: 'component-rig' }, { id: 'log-other', componentId: 'component-other' }] },
    weekendsRef: { current: [weekend] },
    syncOwnerIdRef: { current: identity.syncOwnerId },
    teamRef: { current: identity.accountId ? { id: 'team-a' } : null },
    activeCarIdRef: { current: activeCarId },
    currentSetupRef: { current: setupNext },
    syncStatusRef: { current: null },
  };
  const sessionsBefore = bytes(weekend.sessions);
  const setupBefore = bytes({ activeCarId, setup: setupNext });
  const storage = new Map<string, string>([
    ['race_notes_active_car', activeCarId],
    ['race_notes_setup', JSON.stringify(setupNext)],
  ]);
  const states: Record<string, unknown> = {};
  const sharedQueues: Array<[string, string, boolean, string | null]> = [];
  const tireQueues: Array<{ accountId: string; tireId: string }> = [];
  const pushes: Array<[string, string, string[]]> = [];
  const infos: unknown[] = [];
  let descriptor: D3DeleteDescriptor | null = null;
  const setState = (key: string) => (value: unknown) => { states[key] = value; };
  const push = (kind: string) => (rows: Array<{ id: string }>, owner: string) => { pushes.push([kind, owner, rows.map(row => row.id)]); return Promise.resolve(); };
  const localStorage = {
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  };
  const make = compileD3Handler(sourceText);
  const handler = make({
    ...refs,
    carUndo: { requestDelete: (value: D3DeleteDescriptor) => { descriptor = value; } },
    queueSharedCloudDelete: (table: string, id: string, solo: boolean, account: string | null) => {
      if (!account) return;
      sharedQueues.push([table, id, solo, account]);
    },
    enqueuePendingPersonalTireDelete: (_target: unknown, entry: { accountId: string; tireId: string }) => { tireQueues.push(entry); },
    setDeleteReplayVersion: (updater: (value: number) => number) => { states.replay = updater(Number(states.replay ?? 0)); },
    setSavedSetups: setState('setups'), setTireInventory: setState('tires'), setShockSessions: setState('shocks'),
    setMaintenanceLogs: setState('logs'), setMaintenance: setState('maintenance'), setCars: setState('cars'),
    setWeekends: setState('weekends'), setActiveCarId: setState('activeCar'), setSetup: setState('setup'),
    pushSetups: push('setups'), pushTires: push('tires'), pushShockSessions: push('shocks'),
    pushMaintenanceLogs: push('logs'), pushMaintenanceComponents: push('components'), pushCars: push('cars'), pushWeekends: push('weekends'),
    repairSetupDeletionReferences,
    setSyncStatus: () => undefined,
    isTerminalSyncStatus: (status: string | null) => status === 'sync-error' || status === 'deferred-delete-retrying',
    pickLatestSetupForCar: (setups: Array<{ carId?: string }>, carId: string) => setups.find(item => item.carId === carId) ?? null,
    INITIAL_SETUP: { id: 'initial-safe' }, showInfo: (notice: unknown) => { infos.push(notice); }, setup: setupNext, localStorage, window: { localStorage },
  });
  handler('car-delete');
  assert.ok(descriptor, 'D3 real handler requests Undo descriptor');
  return { descriptor: descriptor!, sharedQueues, tireQueues, pushes, states, storage, infos, refs, sessionsBefore, setupBefore, commit: () => descriptor!.commit() };
};

const activeD3 = runD3Cascade();
d3Deep(activeD3.sharedQueues, [], 'D3 request/confirmation stage queues nothing');
d3Deep(activeD3.pushes, [], 'D3 request/confirmation stage pushes nothing');
d3Deep(activeD3.states, {}, 'D3 request/confirmation stage mutates no domain state');
activeD3.descriptor.removeFromState();
activeD3.descriptor.restoreToState();
d3Deep(activeD3.states, {}, 'D3 real Undo remove/restore callbacks perform zero writes');
activeD3.refs.tireInventoryRef.current.unshift({ id: 'tire-late', carId: 'car-delete' });
activeD3.refs.savedSetupsRef.current.unshift({ id: 'setup-late', carId: 'car-delete', chassis: 'Late', date: 'late', lf: {}, rf: {}, lr: {}, rr: {} });
activeD3.commit();
d3Deep(activeD3.sharedQueues.map(item => item.slice(0, 2)), [
  ['setups', 'setup-late'], ['setups', 'setup-delete'],
  ['shock_sessions', 'shock-delete'], ['maintenance_logs', 'log-delete'],
  ['maintenance_components', 'component-delete'], ['cars', 'car-delete'],
], 'D3 queues latest shared dependencies in stable order with car last');
d3Deep(activeD3.sharedQueues.map(item => item[3]), Array(6).fill('account-a'), 'D3 all shared intents use captured account');
d3Deep(activeD3.tireQueues.map(item => [item.accountId, item.tireId]), [['account-a', 'tire-late'], ['account-a', 'tire-delete']], 'D3 tires use personal account queue from latest ref');
d3Deep(activeD3.pushes.map(item => item[0]), ['weekends', 'setups', 'tires', 'shocks', 'logs', 'components', 'cars'], 'D3 matching pushes preserve dependency order with optional weekend repair first');
d3Deep((activeD3.states.setups as Array<any>).map(item => item.id), ['setup-next', 'setup-third'], 'D3 removes selected-car setups');
d3Equal((activeD3.states.setups as Array<any>)[0].sourceSetupId, undefined, 'D3 clears only dangling surviving setup lineage');
d3Deep((activeD3.states.maintenance as Array<any>).map(item => item.id), ['component-rig', 'component-other'], 'D3 preserves rig and unrelated maintenance');
d3Deep((activeD3.states.logs as Array<any>).map(item => item.id), ['log-rig', 'log-other'], 'D3 removes only logs owned by removed components');
d3Equal(bytes((activeD3.states.weekends as Array<any>)[0].sessions), activeD3.sessionsBefore, 'D3 Race Day session bytes survive');
d3Deep(['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'].map(key => (activeD3.states.weekends as Array<any>)[0][key]), [undefined, undefined, undefined, undefined, undefined], 'D3 clears dangling top-level setup pointers only');
d3Equal((activeD3.states.weekends as Array<any>)[0].setupName, 'keep', 'D3 unrelated Race Day fields survive');
d3Equal(activeD3.states.activeCar, 'car-next', 'D3 active deletion selects first surviving car');
d3Equal((activeD3.states.setup as any).id, 'setup-next', 'D3 active deletion selects replacement latest setup');
d3Equal(activeD3.storage.get('race_notes_active_car'), 'car-next', 'D3 active storage selects replacement');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_saved_setups')!).map((item: any) => item.id), ['setup-next', 'setup-third'], 'D3 persists retained setups under existing key');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_tires')!).map((item: any) => item.id), ['tire-keep'], 'D3 persists retained tires under existing key');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_shock_graphs')!).map((item: any) => item.id), ['shock-keep'], 'D3 persists retained shocks under existing key');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_maintenance_logs')!).map((item: any) => item.id), ['log-rig', 'log-other'], 'D3 persists retained maintenance logs under existing key');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_maintenance')!).map((item: any) => item.id), ['component-rig', 'component-other'], 'D3 persists retained maintenance under existing key');
d3Deep(JSON.parse(activeD3.storage.get('race_notes_cars')!).map((item: any) => item.id), ['car-next', 'car-third'], 'D3 persists retained cars under existing key');
d3Equal(JSON.parse(activeD3.storage.get('race_notes_weekends')!)[0].sessions[0].id, 'session-history', 'D3 persists repaired Race Day with session history intact');
d3Deep(activeD3.infos, [{ reason: 'car-delete-queued', context: { label: 'car-delete · Modified' } }], 'D3 publishes one structured local outcome');

const nonActiveD3 = runD3Cascade(app, 'car-next');
nonActiveD3.commit();
d3Equal(nonActiveD3.storage.get('race_notes_active_car'), 'car-next', 'D3 non-active delete preserves active car');
d3Equal(JSON.parse(nonActiveD3.storage.get('race_notes_setup')!).sourceSetupId, undefined, 'Repair 3 repairs only the exact active saved-twin cache');
d3Ok(!('activeCar' in nonActiveD3.states) && (nonActiveD3.states.setup as any)?.id === 'setup-next', 'Repair 3 changes no active-car selection while repairing the exact active cache');

const switchedDuringUndoD3 = runD3Cascade(app, 'car-next');
const switchedSetup = { id: 'setup-switched', carId: 'car-next', chassis: 'Switched', date: 'latest', lf: {}, rf: {}, lr: {}, rr: {} };
switchedDuringUndoD3.refs.savedSetupsRef.current.push(switchedSetup);
switchedDuringUndoD3.refs.currentSetupRef.current = switchedSetup;
const switchedSetupBytes = JSON.stringify(switchedSetup);
switchedDuringUndoD3.storage.set('race_notes_setup', switchedSetupBytes);
switchedDuringUndoD3.commit();
d3Ok(!('setup' in switchedDuringUndoD3.states), 'Repair 3 delayed commit does not overwrite a Current Setup switched during Undo');
d3Equal(switchedDuringUndoD3.storage.get('race_notes_setup'), switchedSetupBytes, 'Repair 3 delayed commit preserves switched Current Setup cache bytes exactly');

const latestSetupRead = 'const currentSetup = currentSetupRef.current;';
d3Equal((app.match(new RegExp(latestSetupRead.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, 'Repair 3 latest Current Setup ref mutation target is unique');
const capturedSetupMutation = app.replace(latestSetupRead, 'const currentSetup = setup;');
const mutatedSwitchD3 = runD3Cascade(capturedSetupMutation, 'car-next');
mutatedSwitchD3.refs.savedSetupsRef.current.push(switchedSetup);
mutatedSwitchD3.refs.currentSetupRef.current = switchedSetup;
mutatedSwitchD3.storage.set('race_notes_setup', switchedSetupBytes);
mutatedSwitchD3.commit();
d3Ok('setup' in mutatedSwitchD3.states && mutatedSwitchD3.storage.get('race_notes_setup') !== switchedSetupBytes, 'Repair 3 captured-render Setup mutation is rejected');
console.log('Repair 3 delayed-Undo killed mutation (1): current-setup-latest-ref-bypassed');

const noReplacementD3 = runD3Cascade(app, 'car-delete', []);
noReplacementD3.commit();
d3Equal(noReplacementD3.states.activeCar, null, 'D3 no-replacement clears active car');
d3Equal((noReplacementD3.states.setup as any).id, 'initial-safe', 'D3 no-replacement resets safe setup');
d3Ok(!noReplacementD3.storage.has('race_notes_active_car') && !noReplacementD3.storage.has('race_notes_setup'), 'D3 no-replacement removes stale selection storage');

const signedOutActiveD3 = runD3Cascade(app, 'car-delete', [d3Car('car-next'), d3Car('car-third')], signedOutD3Identity);
d3Deep(signedOutActiveD3.refs.userRef.current, null, 'D3 signed-out fixture has null current user');
d3Equal(signedOutActiveD3.refs.syncOwnerIdRef.current, null, 'D3 signed-out fixture has null sync owner');
signedOutActiveD3.commit();
d3Deep(signedOutActiveD3.sharedQueues, [], 'D3 signed-out active cascade creates zero shared queues or null-owned intents');
d3Deep(signedOutActiveD3.tireQueues, [], 'D3 signed-out active cascade creates zero personal tire queues');
d3Deep(signedOutActiveD3.pushes, [], 'D3 signed-out active cascade performs zero cloud pushes');
d3Ok(!('replay' in signedOutActiveD3.states), 'D3 signed-out active cascade does not arm cloud replay');
d3Deep((signedOutActiveD3.states.setups as Array<any>).map(item => item.id), ['setup-next', 'setup-third'], 'D3 signed-out active cascade removes only target setups');
d3Deep((signedOutActiveD3.states.tires as Array<any>).map(item => item.id), ['tire-keep'], 'D3 signed-out active cascade removes only target tires');
d3Deep((signedOutActiveD3.states.shocks as Array<any>).map(item => item.id), ['shock-keep'], 'D3 signed-out active cascade removes only target shocks');
d3Deep((signedOutActiveD3.states.maintenance as Array<any>).map(item => item.id), ['component-rig', 'component-other'], 'D3 signed-out active cascade preserves rig and unrelated maintenance');
d3Deep((signedOutActiveD3.states.logs as Array<any>).map(item => item.id), ['log-rig', 'log-other'], 'D3 signed-out active cascade preserves rig and unrelated logs');
d3Deep((signedOutActiveD3.states.cars as Array<any>).map(item => item.id), ['car-next', 'car-third'], 'D3 signed-out active cascade removes only target car');
d3Deep(signedOutActiveD3.refs.savedSetupsRef.current.map((item: any) => item.id), ['setup-next', 'setup-third'], 'D3 signed-out active cascade updates canonical setup ref');
d3Deep(signedOutActiveD3.refs.tireInventoryRef.current.map((item: any) => item.id), ['tire-keep'], 'D3 signed-out active cascade updates canonical tire ref');
d3Deep(signedOutActiveD3.refs.shockSessionsRef.current.map((item: any) => item.id), ['shock-keep'], 'D3 signed-out active cascade updates canonical shock ref');
d3Deep(signedOutActiveD3.refs.maintenanceRef.current.map((item: any) => item.id), ['component-rig', 'component-other'], 'D3 signed-out active cascade updates canonical maintenance ref');
d3Deep(signedOutActiveD3.refs.maintenanceLogsRef.current.map((item: any) => item.id), ['log-rig', 'log-other'], 'D3 signed-out active cascade updates canonical maintenance-log ref');
d3Deep(signedOutActiveD3.refs.carsRef.current.map((item: any) => item.id), ['car-next', 'car-third'], 'D3 signed-out active cascade updates canonical car ref');
d3Equal(bytes((signedOutActiveD3.states.weekends as Array<any>)[0].sessions), signedOutActiveD3.sessionsBefore, 'D3 signed-out active cascade preserves Race Day session bytes');
d3Deep(['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'].map(key => (signedOutActiveD3.states.weekends as Array<any>)[0][key]), [undefined, undefined, undefined, undefined, undefined], 'D3 signed-out active cascade clears only dangling Race Day pointers');
d3Equal((signedOutActiveD3.states.weekends as Array<any>)[0].setupName, 'keep', 'D3 signed-out active cascade preserves unrelated Race Day bytes');
d3Equal(signedOutActiveD3.states.activeCar, 'car-next', 'D3 signed-out active cascade selects safe replacement car');
d3Equal(signedOutActiveD3.refs.activeCarIdRef.current, 'car-next', 'D3 signed-out active cascade updates canonical active-car ref');
d3Equal((signedOutActiveD3.states.setup as any).id, 'setup-next', 'D3 signed-out active cascade selects safe replacement setup');
d3Equal(signedOutActiveD3.storage.get('race_notes_active_car'), 'car-next', 'D3 signed-out active cascade persists replacement car');
d3Equal(JSON.parse(signedOutActiveD3.storage.get('race_notes_setup')!).id, 'setup-next', 'D3 signed-out active cascade persists replacement setup');
d3Deep(JSON.parse(signedOutActiveD3.storage.get('race_notes_cars')!).map((item: any) => item.id), ['car-next', 'car-third'], 'D3 signed-out active cascade persists retained cars');

const signedOutNonActiveD3 = runD3Cascade(app, 'car-next', [d3Car('car-next'), d3Car('car-third')], signedOutD3Identity);
signedOutNonActiveD3.commit();
d3Deep(signedOutNonActiveD3.sharedQueues, [], 'D3 signed-out non-active cascade creates zero shared queues');
d3Deep(signedOutNonActiveD3.tireQueues, [], 'D3 signed-out non-active cascade creates zero tire queues');
d3Deep(signedOutNonActiveD3.pushes, [], 'D3 signed-out non-active cascade performs zero cloud pushes');
d3Equal(signedOutNonActiveD3.storage.get('race_notes_active_car'), 'car-next', 'D3 signed-out non-active cascade preserves active car storage');
d3Equal(JSON.parse(signedOutNonActiveD3.storage.get('race_notes_setup')!).sourceSetupId, undefined, 'D3 signed-out non-active cascade repairs exact active setup cache');
d3Ok(!('activeCar' in signedOutNonActiveD3.states) && (signedOutNonActiveD3.states.setup as any)?.id === 'setup-next', 'D3 signed-out non-active cascade leaves selection intact while repairing cache');
d3Equal(signedOutNonActiveD3.refs.activeCarIdRef.current, 'car-next', 'D3 signed-out non-active cascade preserves canonical active-car ref');
d3Deep((signedOutNonActiveD3.states.cars as Array<any>).map(item => item.id), ['car-next', 'car-third'], 'D3 signed-out non-active cascade still removes target car locally');
d3Deep((signedOutNonActiveD3.states.setups as Array<any>).map(item => item.id), ['setup-next', 'setup-third'], 'D3 signed-out non-active cascade still removes target setup locally');
d3Equal(bytes((signedOutNonActiveD3.states.weekends as Array<any>)[0].sessions), signedOutNonActiveD3.sessionsBefore, 'D3 signed-out non-active cascade preserves Race Day session bytes');

const signedOutLastD3 = runD3Cascade(app, 'car-delete', [], signedOutD3Identity);
signedOutLastD3.commit();
d3Deep(signedOutLastD3.sharedQueues, [], 'D3 signed-out last-car cascade creates zero shared queues');
d3Deep(signedOutLastD3.tireQueues, [], 'D3 signed-out last-car cascade creates zero tire queues');
d3Deep(signedOutLastD3.pushes, [], 'D3 signed-out last-car cascade performs zero cloud pushes');
d3Equal(signedOutLastD3.states.activeCar, null, 'D3 signed-out last-car cascade clears active car safely');
d3Equal(signedOutLastD3.refs.activeCarIdRef.current, null, 'D3 signed-out last-car cascade clears canonical active-car ref');
d3Equal((signedOutLastD3.states.setup as any).id, 'initial-safe', 'D3 signed-out last-car cascade resets safe setup');
d3Ok(!signedOutLastD3.storage.has('race_notes_active_car') && !signedOutLastD3.storage.has('race_notes_setup'), 'D3 signed-out last-car cascade removes stale selection storage');
d3Deep((signedOutLastD3.states.cars as Array<any>).map(item => item.id), [], 'D3 signed-out last-car cascade persists no dangling car');
d3Equal(bytes((signedOutLastD3.states.weekends as Array<any>)[0].sessions), signedOutLastD3.sessionsBefore, 'D3 signed-out last-car cascade preserves Race Day session bytes');

// Signed-out local deletion must survive the later sign-in pull of stale cloud
// rows. This runs the real cascade first, then the production timestamp merge.
const signedOutThenSignInD3 = runD3Cascade(app, 'car-delete', [d3Car('car-next')], signedOutD3Identity);
signedOutThenSignInD3.commit();
const staleCloudSetup = { id: 'setup-next', carId: 'car-next', chassis: 'Next', date: 'later', sourceSetupId: 'setup-delete', updatedAt: '2026-07-19T00:00:00.000Z', lf: {}, rf: {}, lr: {}, rr: {} };
const staleCloudWeekend = { id: 'weekend-history', name: 'History', track: 'Track', date: 'date', sessions: [{ id: 'session-history', setupId: 'setup-delete', setupSnapshot: { id: 'setup-delete' } }], activeSetupId: 'setup-delete', updatedAt: '2026-07-19T00:00:00.000Z' };
const signInMergedSetups = mergeTimestampedRecords(signedOutThenSignInD3.refs.savedSetupsRef.current, [staleCloudSetup]);
const signInMergedWeekends = mergeTimestampedRecords(signedOutThenSignInD3.refs.weekendsRef.current, [staleCloudWeekend]);
d3Equal(signInMergedSetups.find(item => item.id === 'setup-next')?.sourceSetupId, undefined, 'Repair 3 signed-out cascade local Setup repair beats stale cloud after sign-in');
d3Equal(signInMergedWeekends.find(item => item.id === 'weekend-history')?.activeSetupId, undefined, 'Repair 3 signed-out cascade Race Day repair beats stale cloud after sign-in');
d3Equal(bytes(signInMergedWeekends.find(item => item.id === 'weekend-history')?.sessions), signedOutThenSignInD3.sessionsBefore, 'Repair 3 signed-out then sign-in merge preserves historical session bytes');

const replacementWithoutSetupD3 = runD3Cascade(app, 'car-delete', [d3Car('car-empty')]);
replacementWithoutSetupD3.commit();
d3Equal(replacementWithoutSetupD3.states.activeCar, 'car-empty', 'D3 replacement without setup keeps first surviving car');
d3Equal((replacementWithoutSetupD3.states.setup as any).id, 'initial-safe', 'D3 replacement without setup resets safe setup');
d3Equal(replacementWithoutSetupD3.storage.get('race_notes_active_car'), 'car-empty', 'D3 replacement without setup persists car selection');
d3Ok(!replacementWithoutSetupD3.storage.has('race_notes_setup'), 'D3 replacement without setup removes stale setup storage');

const emptyDependentsD3 = runD3Cascade(app, 'car-delete', []);
emptyDependentsD3.refs.savedSetupsRef.current = [];
emptyDependentsD3.refs.tireInventoryRef.current = [];
emptyDependentsD3.refs.shockSessionsRef.current = [];
emptyDependentsD3.refs.maintenanceRef.current = [];
emptyDependentsD3.refs.maintenanceLogsRef.current = [];
emptyDependentsD3.refs.weekendsRef.current = [{ id: 'empty-weekend', sessions: [{ id: 'history-only' }] }];
emptyDependentsD3.commit();
d3Deep(emptyDependentsD3.sharedQueues.map(item => item.slice(0, 2)), [['cars', 'car-delete']], 'D3 empty dependency cascade queues only selected car');
d3Deep(emptyDependentsD3.tireQueues, [], 'D3 empty dependency cascade queues no personal tire');

const replacedAccountD3 = runD3Cascade();
replacedAccountD3.refs.userRef.current = { id: 'account-b' };
replacedAccountD3.commit();
d3Deep(replacedAccountD3.sharedQueues, [], 'D3 account replacement blocks old shared intents');
d3Deep(replacedAccountD3.states, {}, 'D3 account replacement blocks old local writes');

const preexistingTerminalD3 = runD3Cascade();
preexistingTerminalD3.refs.syncStatusRef.current = 'sync-error';
preexistingTerminalD3.commit();
d3Deep(preexistingTerminalD3.infos, [], 'D3 pre-existing terminal failure suppresses queued-success info');

// Repair 3 compiles the production relationship helper itself. This is separate
// from the real App handler above so timestamp and merge behavior cannot hide in
// a hand-written fixture.
const lifecycle = source('src/lib/setupLifecycle.ts');
const compileRelationshipRepair = (sourceText: string) => {
  const start = sourceText.indexOf('const setupPointerKeys =');
  const end = sourceText.indexOf('/** An active event may only receive its owned Weekend Setup', start);
  assert.ok(start >= 0 && end > start, 'Repair 3 relationship helper slice exists');
  const body = sourceText.slice(start, end)
    .replace('export const repairSetupDeletionReferences =', 'const repairSetupDeletionReferences =');
  const compiled = transformSync(`${body}\nmodule.exports = { repairSetupDeletionReferences };`, { loader: 'ts', format: 'cjs', target: 'es2022' }).code;
  const moduleBox = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', compiled)(moduleBox, moduleBox.exports);
  return moduleBox.exports.repairSetupDeletionReferences as (setups: any[], weekends: any[], removed: Set<string>) => any;
};
const relationshipRepair = compileRelationshipRepair(lifecycle);
const relationshipSession = { id: 'session-proof', setupId: 'removed', setupSnapshot: { id: 'removed', lf: { tirePress: '12' } } };
const relationshipSetups = [
  { id: 'survivor', sourceSetupId: 'removed', updatedAt: '2026-07-19T00:00:00.000Z', lf: {}, rf: {}, lr: {}, rr: {} },
  { id: 'untouched', sourceSetupId: 'other', updatedAt: '2026-07-19T00:00:01.000Z', lf: {}, rf: {}, lr: {}, rr: {} },
];
const relationshipWeekends = [{
  id: 'weekend-proof', sessions: [relationshipSession], updatedAt: '2026-07-19T00:00:02.000Z',
  setupId: 'removed', sourceSetupId: 'removed', baselineSetupId: 'removed', activeSetupId: 'removed', finalSetupId: 'removed', setupName: 'unchanged',
}];
const relationshipResult = relationshipRepair(relationshipSetups, relationshipWeekends, new Set(['removed']));
d3Equal(relationshipResult.setups[0].sourceSetupId, undefined, 'Repair 3 clears only removed Setup lineage');
d3Equal(relationshipResult.setups[1], relationshipSetups[1], 'Repair 3 leaves unrelated Setup bytes exact');
d3Deep(['setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'].map(key => relationshipResult.weekends[0][key]), [undefined, undefined, undefined, undefined, undefined], 'Repair 3 clears every matching top-level Race Day pointer');
d3Equal(bytes(relationshipResult.weekends[0].sessions), bytes(relationshipWeekends[0].sessions), 'Repair 3 keeps session setupId/snapshot bytes exact');
d3Equal(relationshipResult.weekends[0].setupName, 'unchanged', 'Repair 3 leaves unrelated Race Day bytes exact');
d3Equal(relationshipResult.setups[0].updatedAt, relationshipResult.weekends[0].updatedAt, 'Repair 3 uses one cascade commit timestamp');
d3Ok(relationshipResult.setups[0].updatedAt > relationshipSetups[0].updatedAt && relationshipResult.weekends[0].updatedAt > relationshipWeekends[0].updatedAt, 'Repair 3 timestamp is strictly newer than every affected row');
d3Equal(mergeTimestampedRecords(relationshipResult.setups, [{ ...relationshipSetups[0], sourceSetupId: 'removed' }])[0].sourceSetupId, undefined, 'Repair 3 repaired local Setup wins stale equal-or-older cloud merge');
d3Equal(mergeTimestampedRecords(relationshipResult.weekends, [{ ...relationshipWeekends[0] }])[0].activeSetupId, undefined, 'Repair 3 repaired local Race Day wins stale cloud merge after sign-in');

const relationshipMutations: Array<[string, string, string, (result: any) => boolean]> = [
  ['lineage-left-dangling', '{ ...setup, sourceSetupId: undefined, updatedAt: timestamp }', '{ ...setup, updatedAt: timestamp }', result => result.setups[0].sourceSetupId === 'removed'],
  ['pointer-class-omitted', "'setupId', 'sourceSetupId', 'baselineSetupId', 'activeSetupId', 'finalSetupId'", "'setupId', 'sourceSetupId', 'baselineSetupId', 'finalSetupId'", result => result.weekends[0].activeSetupId === 'removed'],
  ['strict-newer-removed', 'new Date(Math.max(Date.now(), newestAffected + 1)).toISOString()', 'new Date(newestAffected).toISOString()', result => result.timestamp <= relationshipWeekends[0].updatedAt],
  ['changed-only-removed', ': setup),', ': { ...setup, updatedAt: timestamp }),', result => result.setups[1].updatedAt === result.timestamp],
  ['sessions-rewritten', 'const repaired: RaceWeekend = { ...weekend, updatedAt: timestamp };', 'const repaired: RaceWeekend = { ...weekend, sessions: [], updatedAt: timestamp };', result => result.weekends[0].sessions.length === 0],
];
for (const [name, before, after, proves] of relationshipMutations) {
  d3Equal((lifecycle.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `Repair 3 ${name} mutation target is unique`);
  const mutated = lifecycle.replace(before, after);
  const result = compileRelationshipRepair(mutated)(relationshipSetups, relationshipWeekends, new Set(['removed']));
  d3Ok(proves(result), `Repair 3 production relationship mutation ${name} is rejected`);
}
console.log(`Repair 3 relationship killed mutations (${relationshipMutations.length}): ${relationshipMutations.map(([name]) => name).join(', ')}`);

const d3Mutations: Array<[string, string, string]> = [
  ['setup-category-missing', '.filter(item => !removedSetupIds.has(item.id))', '.filter(item => true)'],
  ['tire-category-missing', "const retainedTires = latestTires.filter(item => item.carId !== carId);", 'const retainedTires = latestTires;'],
  ['shock-category-missing', "const retainedShocks = latestShocks.filter(item => item.carId !== carId);", 'const retainedShocks = latestShocks;'],
  ['maintenance-category-missing', "const removedComponents = latestMaintenance.filter(item => item.scope === 'car' && item.carId === carId);", 'const removedComponents = latestMaintenance.filter(item => false);'],
  ['maintenance-log-category-missing', 'const removedLogs = latestLogs.filter(item => removedComponentIds.has(item.componentId));', 'const removedLogs = latestLogs.filter(item => false);'],
  ['wrong-shock-table', "queueSharedCloudDelete('shock_sessions', item.id, false, accountId)", "queueSharedCloudDelete('setups', item.id, false, accountId)"],
  ['wrong-shock-id', "queueSharedCloudDelete('shock_sessions', item.id, false, accountId)", "queueSharedCloudDelete('shock_sessions', 'wrong-id', false, accountId)"],
  ['wrong-car-account', "queueSharedCloudDelete('cars', carId, false, accountId)", "queueSharedCloudDelete('cars', carId, false, 'wrong-account')"],
  ['car-queued-before-dependencies', 'removedSetupIds.forEach(id => queueSharedCloudDelete(\'setups\', id, false, accountId));', "queueSharedCloudDelete('cars', carId, false, accountId);\n        removedSetupIds.forEach(id => queueSharedCloudDelete('setups', id, false, accountId));"],
  ['shock-push-missing', 'void pushShockSessions(retainedShocks, currentOwnerId, setSyncStatus);', 'void pushSetups(retainedShocks, currentOwnerId, setSyncStatus);'],
  ['personal-tire-queue-bypassed', "removedTires.forEach(item => enqueuePendingPersonalTireDelete(window.localStorage, {\n            accountId,\n            tireId: item.id,\n            queuedAt: new Date().toISOString(),\n          }));", "removedTires.forEach(item => queueSharedCloudDelete('tire_inventory', item.id, false, accountId));"],
  ['rig-maintenance-deleted', 'const retainedMaintenance = latestMaintenance.filter(item => !removedComponentIds.has(item.id));', "const retainedMaintenance = latestMaintenance.filter(item => item.scope !== 'rig' && !removedComponentIds.has(item.id));"],
  ['latest-ref-bypassed', 'const latestTires = tireInventoryRef.current;', 'const latestTires = tireInventoryRef.current.slice(1);'],
  ['account-guard-removed', 'if ((userRef.current?.id ?? null) !== accountId) return;', 'if (false) return;'],
  ['signed-out-null-guard-regression', 'if ((userRef.current?.id ?? null) !== accountId) return;', 'if (userRef.current?.id !== accountId) return;'],
  ['replacement-order-wrong', 'const nextCar = retainedCars[0] ?? null;', 'const nextCar = retainedCars.at(-1) ?? null;'],
  ['non-active-selection-overwritten', 'if (activeCarIdRef.current === carId) {', 'if (true) {'],
  ['relationship-repair-bypassed', 'const setupReferenceRepair = repairSetupDeletionReferences(\n          latestSetups.filter(item => !removedSetupIds.has(item.id)),', 'const setupReferenceRepair = ((setups, weekends) => ({ setups, weekends, changedSetupIds: [], changedWeekendIds: [], timestamp: null }))(\n          latestSetups.filter(item => !removedSetupIds.has(item.id)),'],
  ['active-cache-repair-bypassed', 'if (repairedActiveSetup && activeCarIdRef.current !== carId) {', 'if (false) {'],
  ['terminal-priority-guard-removed', "if (!isTerminalSyncStatus(syncStatusRef.current)) {\n          showInfo({ reason: 'car-delete-queued', context: { label } });\n        }", "showInfo({ reason: 'car-delete-queued', context: { label } });"],
  ['setup-storage-key-wrong', "localStorage.setItem('race_notes_saved_setups', JSON.stringify(retainedSetups));", "localStorage.setItem('wrong_saved_setups', JSON.stringify(retainedSetups));"],
  ['tire-storage-key-wrong', "localStorage.setItem('race_notes_tires', JSON.stringify(retainedTires));", "localStorage.setItem('wrong_tires', JSON.stringify(retainedTires));"],
  ['shock-storage-key-wrong', "localStorage.setItem('race_notes_shock_graphs', JSON.stringify(retainedShocks));", "localStorage.setItem('wrong_shocks', JSON.stringify(retainedShocks));"],
  ['maintenance-log-storage-key-wrong', "localStorage.setItem('race_notes_maintenance_logs', JSON.stringify(retainedLogs));", "localStorage.setItem('wrong_maintenance_logs', JSON.stringify(retainedLogs));"],
  ['maintenance-storage-key-wrong', "localStorage.setItem('race_notes_maintenance', JSON.stringify(retainedMaintenance));", "localStorage.setItem('wrong_maintenance', JSON.stringify(retainedMaintenance));"],
  ['car-storage-key-wrong', "localStorage.setItem('race_notes_cars', JSON.stringify(retainedCars));", "localStorage.setItem('wrong_cars', JSON.stringify(retainedCars));"],
  ['weekend-storage-key-wrong', "if (setupReferenceRepair.changedWeekendIds.length > 0) {\n          weekendsRef.current = repairedWeekends;\n          setWeekends(repairedWeekends);\n          localStorage.setItem('race_notes_weekends', JSON.stringify(repairedWeekends));", "if (setupReferenceRepair.changedWeekendIds.length > 0) {\n          weekendsRef.current = repairedWeekends;\n          setWeekends(repairedWeekends);\n          localStorage.setItem('wrong_weekends', JSON.stringify(repairedWeekends));"],
];
const killedD3Mutations: string[] = [];
for (const [name, before, after] of d3Mutations) {
  d3Equal((app.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, 1, `D3 mutation ${name} production target is unique`);
  const mutated = app.replace(before, after);
  let failed = false;
  try {
    const run = runD3Cascade(mutated);
    run.refs.tireInventoryRef.current.unshift({ id: 'tire-late', carId: 'car-delete' });
    run.refs.savedSetupsRef.current.unshift({ id: 'setup-late', carId: 'car-delete', chassis: 'Late', date: 'late', lf: {}, rf: {}, lr: {}, rr: {} });
    run.commit();
    assert.deepEqual(run.sharedQueues.map(item => item.slice(0, 2)), [
      ['setups', 'setup-late'], ['setups', 'setup-delete'], ['shock_sessions', 'shock-delete'],
      ['maintenance_logs', 'log-delete'], ['maintenance_components', 'component-delete'], ['cars', 'car-delete'],
    ]);
    assert.deepEqual(run.tireQueues.map(item => item.tireId), ['tire-late', 'tire-delete']);
    assert.deepEqual(run.sharedQueues.map(item => item[3]), Array(6).fill('account-a'));
    assert.deepEqual(run.pushes.map(item => item[0]), ['weekends', 'setups', 'tires', 'shocks', 'logs', 'components', 'cars']);
    assert.deepEqual((run.states.tires as Array<any>).map(item => item.id), ['tire-keep']);
    assert.deepEqual((run.states.shocks as Array<any>).map(item => item.id), ['shock-keep']);
    assert.deepEqual((run.states.maintenance as Array<any>).map(item => item.id), ['component-rig', 'component-other']);
    assert.deepEqual((run.states.logs as Array<any>).map(item => item.id), ['log-rig', 'log-other']);
    assert.deepEqual((run.states.setups as Array<any>).map(item => item.id), ['setup-next', 'setup-third']);
    assert.equal((run.states.weekends as Array<any>)[0].sessions.length, 1);
    assert.equal((run.states.weekends as Array<any>)[0].activeSetupId, undefined);
    assert.equal(run.states.activeCar, 'car-next');
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_saved_setups')!).map((item: any) => item.id), ['setup-next', 'setup-third']);
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_tires')!).map((item: any) => item.id), ['tire-keep']);
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_shock_graphs')!).map((item: any) => item.id), ['shock-keep']);
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_maintenance_logs')!).map((item: any) => item.id), ['log-rig', 'log-other']);
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_maintenance')!).map((item: any) => item.id), ['component-rig', 'component-other']);
    assert.deepEqual(JSON.parse(run.storage.get('race_notes_cars')!).map((item: any) => item.id), ['car-next', 'car-third']);
    assert.equal(JSON.parse(run.storage.get('race_notes_weekends')!)[0].sessions[0].id, 'session-history');
    const accountRace = runD3Cascade(mutated);
    accountRace.refs.userRef.current = { id: 'account-b' };
    accountRace.commit();
    assert.deepEqual(accountRace.states, {});
    const nonActiveRace = runD3Cascade(mutated, 'car-next');
    nonActiveRace.commit();
    assert.ok(!('activeCar' in nonActiveRace.states));
    assert.equal(JSON.parse(nonActiveRace.storage.get('race_notes_setup')!).sourceSetupId, undefined);
    const terminalRace = runD3Cascade(mutated);
    terminalRace.refs.syncStatusRef.current = 'sync-error';
    terminalRace.commit();
    assert.deepEqual(terminalRace.infos, []);
    const signedOutRace = runD3Cascade(mutated, 'car-delete', [d3Car('car-next'), d3Car('car-third')], signedOutD3Identity);
    signedOutRace.commit();
    assert.equal(signedOutRace.states.activeCar, 'car-next');
    assert.equal((signedOutRace.states.setup as any).id, 'setup-next');
    assert.deepEqual(signedOutRace.sharedQueues, []);
    assert.deepEqual(signedOutRace.tireQueues, []);
    assert.deepEqual(signedOutRace.pushes, []);
  } catch {
    failed = true;
  }
  d3Ok(failed, `D3 production mutation ${name} is rejected`);
  killedD3Mutations.push(name);
}
d3Equal(new Set(killedD3Mutations).size, killedD3Mutations.length, 'D3 mutation labels are unique');
d3Ok(!/deleteCarFromCloud|deleteTeamSharedRecordFromCloud|supabase\s*\./.test(deleteHandler), 'D3 introduces no direct cloud delete or Supabase bypass');

console.log(`D3 assertions: ${d3AssertionCount}`);
console.log(`D3 killed mutations (${killedD3Mutations.length}): ${killedD3Mutations.join(', ')}`);

console.log('CAR_DELETE_UNDO_HARNESS PASS');
