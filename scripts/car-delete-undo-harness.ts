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
assert.ok(deleteHandler.indexOf("setInfoToast('Reassign or delete this car\\'s data first.')") < deleteHandler.indexOf('carUndo.requestDelete'), 'info guard must run before undo request');
assert.match(deleteHandler, /removeFromState: \(\) => \{\},\s*restoreToState: \(\) => \{\}/s);
assert.match(deleteHandler, /const accountId = userRef\.current\?\.id \?\? null;/);
assert.match(deleteHandler, /if \(userRef\.current\?\.id !== accountId\) return;/);
assert.doesNotMatch(deleteHandler, /const ownerId =|const generation =|authGenerationRef\.current !==|syncOwnerIdRef\.current !==/);
assert.match(deleteHandler, /const latestCars = carsRef\.current;/);
assert.match(deleteHandler, /handleSaveCars\(updated, accountId\);/);
assert.match(deleteHandler, /if \(activeCarIdRef\.current === carId\)/);
assert.match(deleteHandler, /activeCarIdRef\.current = null;\s*setActiveCarId\(null\);\s*localStorage\.removeItem\('race_notes_active_car'\);/s);
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

console.log('CAR_DELETE_UNDO_HARNESS PASS');
