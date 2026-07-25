<?php

/**
 * @file classes/testing/bootstrap/Processor/SeriesProcessor.php
 *
 * Copyright (c) 2026 Simon Fraser University
 * Copyright (c) 2026 John Willinsky
 * Distributed under the GNU GPL v3. For full terms see the file docs/COPYING.
 *
 * @class SeriesProcessor
 *
 * @brief OMP's submission-container processor — creates press series from
 *        the shared context spec's `sections[]` entries.
 *
 * OMP series are Sections in the database but not in the schema: OMP's
 * schemas/section.json drops `abbrev` entirely and adds `path`, `prefix`,
 * `subtitle`, `onlineIssn`, `printIssn`, `featured`. Writing the shared
 * SectionProcessor's abbrev-keyed data object here would push a property
 * OMP's schema does not declare, so this subclass builds the OMP shape and
 * keys the returned map by `path` (the OMP handle) instead.
 *
 * Deliberately NOT a new spec vocabulary: specs still say `sections[]`,
 * per APP-GLOSSARY's section→series mapping. Only the properties inside
 * each entry differ, and the shared context schema already allows both
 * shapes (`title` required; `abbrev` and `path` both optional).
 */

namespace APP\testing\bootstrap\Processor;

use APP\facades\Repo;
use PKP\testing\bootstrap\Processor\SectionProcessor;

class SeriesProcessor extends SectionProcessor
{
    /**
     * @param array $sectionSpecs [{title, path?, prefix?, subtitle?, description?, sectionEditors?}]
     *
     * @return array ['series' => [path => id], 'sections' => [path => id], 'editorsToAssign' => [id => [usernames]]]
     */
    public function run(int $contextId, array $sectionSpecs, string $contextPath): array
    {
        $series = [];
        $editorsToAssign = [];

        // Unlike OJS/OPS, OMP's ContextService installs no default series,
        // so there is normally nothing to clear. Kept for symmetry with
        // the shared processor: bootstrap specs are declarative and own
        // the full container list.
        Repo::section()->deleteByContextId($contextId);

        foreach ($sectionSpecs as $spec) {
            $path = $this->resolvePath($spec);

            $seriesData = [
                'contextId' => $contextId,
                'title' => $spec['title'],
                'path' => $path,
                'editorRestricted' => !empty($spec['editorRestricted']),
            ];
            foreach (['prefix', 'subtitle', 'description'] as $optional) {
                if (isset($spec[$optional])) {
                    $seriesData[$optional] = $spec[$optional];
                }
            }
            if (isset($spec['featured'])) {
                $seriesData['featured'] = (bool) $spec['featured'];
            }

            $seriesId = Repo::section()->add(Repo::section()->newDataObject($seriesData));
            $series[$path] = $seriesId;

            if (!empty($spec['sectionEditors'])) {
                $editorsToAssign[$seriesId] = $spec['sectionEditors'];
            }
        }

        // `sections` is echoed under both names so shared response-shape
        // consumers keep working while OMP-side code can read `series`.
        return ['series' => $series, 'sections' => $series, 'editorsToAssign' => $editorsToAssign];
    }

    /**
     * OMP series are addressed by `path`. Accept an explicit one, else
     * derive a URL-safe handle from the spec's abbrev (so a spec written
     * in OJS vocabulary still seeds cleanly) or its primary-locale title.
     */
    private function resolvePath(array $spec): string
    {
        if (!empty($spec['path'])) {
            return (string) $spec['path'];
        }

        $source = $spec['abbrev'] ?? $spec['title'];
        if (is_array($source)) {
            $source = $source['en'] ?? reset($source);
        }

        $path = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $source));
        if ($path === '') {
            throw new \RuntimeException(
                'sections[] entry has no usable `path`, `abbrev` or title to derive an OMP series path from.'
            );
        }
        return $path;
    }
}
