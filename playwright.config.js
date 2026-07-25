// @ts-check

// OMP Playwright config. All logic lives in the shared factory in lib/pkp
// so OJS/OMP/OPS stay in sync; this stub declares the app name and the
// base port of OMP's dev-server block (worker N -> 8100 + N), which keeps
// the OMP fleet clear of OJS (8000-8099) and OPS (8200-8299).
module.exports = require('./lib/pkp/playwright/config-factory.js')({
	app: 'omp',
	basePort: 8100,
});
