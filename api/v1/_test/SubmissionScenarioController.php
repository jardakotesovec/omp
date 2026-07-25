<?php

/**
 * @file api/v1/_test/SubmissionScenarioController.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionScenarioController
 *
 * @ingroup api_v1_test
 *
 * @brief OMP subclass for the submission scenario endpoint. Supplies the
 *        press-shaped overlays on top of the shared pipeline.
 *
 * Three OMP-shaped things, all declared rather than branched on:
 *
 *  - `series` replaces OJS/OPS's `section` as the submission container
 *    spec key. It is OPTIONAL: an OMP monograph with no series is a real
 *    state the wizard allows, so unlike OJS's `section` it is not added
 *    to the required list.
 *  - the submission builder writes `seriesId`, a column OJS/OPS
 *    publications do not have (and OMP publications have no `sectionId`).
 *  - the decision processor carries the internal-review vocabulary and,
 *    more importantly, knows those decisions create rounds on
 *    WORKFLOW_STAGE_ID_INTERNAL_REVIEW rather than external review.
 *
 * NOT declared: `issue` / `galleys` (OJS) — OMP's representation model is
 * publication formats + ONIX, which no scenario needs yet. Their absence
 * from OMP's overlays is what makes an OJS-flavoured spec fail loudly at
 * validation instead of fataling inside a processor on a Repo::galley()
 * that OMP does not have.
 */

namespace APP\API\v1\_test;

use APP\testing\scenario\Processor\DecisionProcessor;
use APP\testing\scenario\Processor\SubmissionBuilderProcessor;
use PKP\API\v1\_test\PKPSubmissionScenarioController;
use PKP\testing\scenario\Processor\DecisionProcessor as PKPDecisionProcessor;
use PKP\testing\scenario\Processor\ReviewRoundProcessor;
use PKP\testing\scenario\Processor\SubmissionBuilderProcessor as PKPSubmissionBuilderProcessor;

class SubmissionScenarioController extends PKPSubmissionScenarioController
{
    protected function schemaOverlayProperties(): array
    {
        return [
            'series' => [
                'description' => 'Path of the press series the monograph belongs to. OMP series have no abbrev, so this is the series `path`. Optional — a monograph with no series is valid.',
                'type' => 'string',
                'minLength' => 1,
            ],
        ];
    }

    protected function newSubmissionBuilderProcessor(): PKPSubmissionBuilderProcessor
    {
        return new SubmissionBuilderProcessor();
    }

    protected function newDecisionProcessor(ReviewRoundProcessor $reviewRoundProcessor): PKPDecisionProcessor
    {
        return new DecisionProcessor($reviewRoundProcessor);
    }
}
