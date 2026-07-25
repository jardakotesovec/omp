<?php

/**
 * @file classes/testing/scenario/Processor/DecisionProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class DecisionProcessor
 *
 * @brief OMP decision vocabulary — the shared roster plus the whole
 *        internal-review family that only OMP has.
 *
 * Two things are OMP-specific and both are declared here rather than in
 * lib/pkp:
 *
 *  1. The decision names. Every entry below resolves to a DecisionType
 *     registered in APP\decision\Repository::getDecisionTypes(); a name
 *     with no registered type fails loudly in the shared run().
 *  2. Which decisions create a review round, and on WHICH stage. OMP is
 *     the only application where that answer is not always "external
 *     review": sendInternalReview / newInternalRound land their rounds on
 *     WORKFLOW_STAGE_ID_INTERNAL_REVIEW, and the shared processor stamps
 *     that stage onto the round's review assignments. Get it wrong and
 *     the reviewers exist but are invisible in the stage's grid.
 *
 * Deliberately omitted: `resubmitInternal`. OMP's ResubmitInternal
 * DecisionType returns Decision::PENDING_REVISIONS_INTERNAL — the same
 * constant as RequestRevisionsInternal — so the two are indistinguishable
 * through this API. Mapping a spec name onto it would silently seed the
 * wrong decision. Flagged for the maintainer as an upstream question, not
 * worked around here.
 */

namespace APP\testing\scenario\Processor;

use PKP\decision\Decision;
use PKP\testing\scenario\Processor\DecisionProcessor as PKPDecisionProcessor;

class DecisionProcessor extends PKPDecisionProcessor
{
    /** OMP-only decision names layered on top of the shared roster. */
    private const OMP_DECISION_MAP = [
        'sendInternalReview' => Decision::INTERNAL_REVIEW,
        'skipInternalReview' => Decision::SKIP_INTERNAL_REVIEW,
        'acceptFromInternal' => Decision::ACCEPT_INTERNAL,
        'requestRevisionsInternal' => Decision::PENDING_REVISIONS_INTERNAL,
        'declineInternal' => Decision::DECLINE_INTERNAL,
        'revertDeclineInternal' => Decision::REVERT_INTERNAL_DECLINE,
        'newInternalRound' => Decision::NEW_INTERNAL_ROUND,
        'cancelInternalReviewRound' => Decision::CANCEL_INTERNAL_REVIEW_ROUND,
        'recommendSendExternalReview' => Decision::RECOMMEND_EXTERNAL_REVIEW,
        'recommendAcceptInternal' => Decision::RECOMMEND_ACCEPT_INTERNAL,
        'recommendRevisionsInternal' => Decision::RECOMMEND_PENDING_REVISIONS_INTERNAL,
        'recommendResubmitInternal' => Decision::RECOMMEND_RESUBMIT_INTERNAL,
        'recommendDeclineInternal' => Decision::RECOMMEND_DECLINE_INTERNAL,
    ];

    protected function decisionMap(): array
    {
        return parent::decisionMap() + self::OMP_DECISION_MAP;
    }

    protected function roundCreatingDecisions(): array
    {
        return parent::roundCreatingDecisions() + [
            Decision::INTERNAL_REVIEW => WORKFLOW_STAGE_ID_INTERNAL_REVIEW,
            Decision::NEW_INTERNAL_ROUND => WORKFLOW_STAGE_ID_INTERNAL_REVIEW,
        ];
    }
}
