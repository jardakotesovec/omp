// @ts-check

// OMP Playwright config. All logic lives in the shared factory in lib/pkp
// so OJS/OMP/OPS stay in sync; this stub declares the app name and the
// base port of OMP's dev-server block (worker N -> 8100 + N), which keeps
// the OMP fleet clear of OJS (8000-8099) and OPS (8200-8299).
//
// sharedTests: false — the shared feature specs in
// lib/pkp/playwright/tests/ are still OJS-flavoured below the payload
// level (section-keyed scenario specs, the scenarios/journal alias, stage
// labels, decision rosters). Running them here today produces a wall of
// failures that says nothing about OMP. Turning this on IS the
// "shared-test purge probe" milestone — MULTIAPP-PLAN §5.6 / §7.3. The
// shared bootstrap.setup.js is unaffected and always runs.
module.exports = require('./lib/pkp/playwright/config-factory.js')({
	app: 'omp',
	basePort: 8100,
	sharedTests: false,
});
