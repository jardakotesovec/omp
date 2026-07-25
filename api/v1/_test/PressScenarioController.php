<?php

/**
 * @file api/v1/_test/PressScenarioController.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class PressScenarioController
 *
 * @ingroup api_v1_test
 *
 * @brief OMP subclass of PKPContextScenarioController. Registers
 *        POST /api/v1/_test/scenarios/press — the OMP vocabulary alias of
 *        the canonical cross-app POST /api/v1/_test/scenarios/context —
 *        both of which run the shared context-build pipeline.
 *
 * The only OMP-specific wiring is the submission-container processor:
 * press series are Sections in the database but carry no `abbrev`, so the
 * shared abbrev-keyed SectionProcessor cannot build them.
 *
 * Nothing is hung off afterContextCreated(): OMP's own context-level
 * concepts (catalog, ONIX codelists, publication-format templates) are
 * not needed to stand a press up, and the codebase is better served by
 * adding them when a spec actually asks for them.
 */

namespace APP\API\v1\_test;

use APP\testing\bootstrap\Processor\SeriesProcessor;
use Illuminate\Support\Facades\Route;
use PKP\API\v1\_test\PKPContextScenarioController;
use PKP\testing\bootstrap\Processor\SectionProcessor;

class PressScenarioController extends PKPContextScenarioController
{
    public function getGroupRoutes(): void
    {
        parent::getGroupRoutes();

        Route::post('press', $this->context(...))
            ->name('test.scenarios.press');
    }

    protected function scratchPathPrefix(): string
    {
        return 'p-';
    }

    protected function newSectionProcessor(): SectionProcessor
    {
        return new SeriesProcessor();
    }
}
