import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const garage = readFileSync(join(process.cwd(), 'src/components/GarageView.tsx'), 'utf8');

assert.match(garage, /import React, \{ useRef, useState \} from 'react';/);
assert.match(garage, /import EmptyState from '\.\/ui\/EmptyState';/);
assert.match(garage, /const addCarInputRef = useRef<HTMLInputElement>\(null\);/);
assert.match(garage, /const focusAddCarForm = \(\) => \{\s*setShowAddForm\(true\);\s*window\.setTimeout\(\(\) => addCarInputRef\.current\?\.focus\(\), 0\);\s*\};/);
assert.match(garage, /<EmptyState icon="directions_car" title="No cars yet" cta=\{\{ label: 'Add Car', onClick: focusAddCarForm, icon: 'add' \}\} \/>/);
assert.doesNotMatch(garage, /No cars yet — add one below\./);
assert.match(garage, /ref=\{addCarInputRef\}\s*placeholder="Chassis \*"/);
assert.match(garage, /onClick=\{focusAddCarForm\}\s*className="w-full py-3 border border-dashed/);
assert.equal((garage.match(/focusAddCarForm/g) ?? []).length, 3, 'one helper plus both CTA paths');
assert.equal((garage.match(/addCarInputRef/g) ?? []).length, 3, 'one ref declaration, focus, and input attachment');

assert.match(garage, /flex items-center gap-2 flex-shrink-0/);
assert.match(garage, /className="tap-target p-1\.5 text-on-surface-variant\/60/);
assert.match(garage, /className=\{`tap-target p-1\.5 rounded transition-colors/);
assert.match(garage, /onClick=\{e => e\.stopPropagation\(\)\}/);
assert.match(garage, /disabled=\{totalData\(car\.id\) > 0\}/);
assert.match(garage, /onClick=\{\(\) => onDeleteCar\(car\.id\)\}/);
assert.match(garage, /const handleAdd = \(\) => \{[\s\S]*onSaveCars\(\[\.\.\.cars, newCar\]\);[\s\S]*if \(cars\.length === 0\) onSelectCar\(newCar\.id\);/);
assert.match(garage, /const handleSaveEdit = \(carId: string\) => \{[\s\S]*onSaveCars\(updated\);/);

console.log('GARAGE_EMPTY_STATE_HARNESS PASS');
