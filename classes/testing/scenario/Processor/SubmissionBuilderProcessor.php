<?php

/**
 * @file classes/testing/scenario/Processor/SubmissionBuilderProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SubmissionBuilderProcessor
 *
 * @brief OMP submission builder — places the monograph in a press series
 *        instead of a journal section.
 *
 * OMP's schemas/publication.json declares `seriesId` and has no
 * `sectionId` at all, so the shared processor's container property is
 * wrong here rather than merely differently named. The series is also
 * optional: a monograph with no series is a legitimate OMP state (the
 * submission wizard's series select can be left unset), which is why the
 * shared hook returns an array — an absent container is expressible.
 */

namespace APP\testing\scenario\Processor;

use APP\facades\Repo;
use PKP\context\Context;
use PKP\testing\scenario\Processor\SubmissionBuilderProcessor as PKPSubmissionBuilderProcessor;

class SubmissionBuilderProcessor extends PKPSubmissionBuilderProcessor
{
    /**
     * Spec key `series` (an OMP schema overlay) carries the series *path*
     * — OMP series have no abbrev to key on.
     */
    protected function publicationContainerProps(array $spec, Context $context, string $locale): array
    {
        if (empty($spec['series'])) {
            return [];
        }

        $series = Repo::section()->getByPath($spec['series'], $context->getId());
        if (!$series) {
            throw new \RuntimeException(
                "Series with path '{$spec['series']}' not found in press {$context->getId()}. "
                . 'Seed it in the context scenario spec\'s sections[].'
            );
        }

        return ['seriesId' => (int) $series->getId()];
    }

    /**
     * OMP's registry/genres.xml has no SUBMISSION entry — the main text
     * file genre is MANUSCRIPT. GenreLookup resolves the app-neutral
     * 'ARTICLE' handle across both spellings, so the handle itself is
     * unchanged; this override exists only to document the difference at
     * the point a reader would look for it.
     */
    protected function defaultFileGenreHandle(): string
    {
        return 'ARTICLE';
    }
}
