// @ts-check

/**
 * OMP app context — the capability map shared specs gate on.
 *
 * Contract (MULTIAPP-PLAN §3, APP-GLOSSARY §2–§3):
 *   - Shared specs in lib/pkp/playwright/tests/ gate on CAPABILITIES, never
 *     app names: `test.skip(!appContext.hasReviewStage, …)`, never
 *     `if (app === 'omp')`.
 *   - The `hasX` names below are CANONICAL — copied verbatim from
 *     ojs-main/docs/product/APP-GLOSSARY.md §2. Adding a capability means
 *     adding a row there first, then the same key in all three
 *     app.context.js files.
 *   - Vocabulary and seed nouns never gate anything; they come from
 *     `vocab` / `seed` so one shared test renders the right labels
 *     wherever the capability holds.
 *
 * Consumed through the shared `appContext` fixture
 * (lib/pkp/playwright/support/base-test.js), which resolves this file from
 * `process.cwd()` and cross-checks `app` against the Playwright project
 * name.
 */

module.exports = {
	app: 'omp',

	// ---- Capabilities (canonical names — APP-GLOSSARY.md §2) ----------

	/** External Review exists (and Internal Review — see hasInternalReview). */
	hasReviewStage: true,
	/** OMP-unique: the Internal Review stage, its decision roster and rounds. */
	hasInternalReview: true,
	/** Copyediting stage + its participants/files. */
	hasCopyediting: true,
	/** Production stage (all apps; kept for completeness). */
	hasProduction: true,
	/** No issues — the counterpart feature is the catalog (New Releases / Featured). */
	hasIssues: false,
	/** No galleys — OMP's representation model is publication formats + ONIX. */
	hasGalleys: false,
	/** No subscriptions — OMP sells publication formats directly instead. */
	hasSubscriptions: false,
	/** No sections — OMP's (optional) content grouping is series. */
	hasSections: false,
	/** Reviewer groups exist, split External Reviewer / Internal Reviewer. */
	hasReviewerRoles: true,

	// ---- Workflow topology --------------------------------------------

	/**
	 * WORKFLOW_STAGE_ID_* values this app actually instantiates, in
	 * workflow order. OMP is the only app with stage 2 (Internal Review);
	 * its Review stage — the one the shared review specs drive — is
	 * stage 3, the same id OJS uses.
	 */
	stages: [1, 2, 3, 4, 5],
	/** Stage a freshly-seeded submission lands on. */
	initialStageId: 1,
	/** External Review — where shared review specs run. */
	reviewStageId: 3,
	/** Internal Review — OMP-only companions run here. */
	internalReviewStageId: 2,

	// ---- Scenario-spec vocabulary --------------------------------------

	/**
	 * Key the submission scenario spec uses for its content container.
	 * Note it is OPTIONAL on OMP (a monograph with no series is a real
	 * wizard state) — unlike `section` on OJS/OPS, which is required.
	 */
	submissionContainerKey: 'series',

	// ---- Reader-facing vocabulary (APP-GLOSSARY §1) ---------------------

	vocab: {
		context: 'press',
		contextPlural: 'presses',
		submission: 'monograph',
		container: 'series',
		representation: 'publication format',
		managerRole: 'Press Manager',
		subEditorRole: 'Series Editor',
	},

	// ---- Baseline seed (playwright/fixtures/bootstrap.js) ---------------

	seed: {
		/** Same URL path in all three apps — POMs can hard-default it. */
		contextPath: 'publicknowledge',
		contextName: 'Public Knowledge Press',
		/**
		 * Handles of the seeded containers, in bootstrap order. OMP series
		 * are keyed by `path` (their schema has no `abbrev` at all), so
		 * these are paths, not abbreviations.
		 */
		containers: ['monographs', 'editedvolumes'],
		/**
		 * Role archetype → seeded username, or null where the app has no
		 * such user group. `seniorEditor` is the highest editorial actor
		 * with full workflow access.
		 */
		actors: {
			siteAdmin: 'admin',
			manager: 'manager.maya',
			seniorEditor: 'editor.diana',
			sectionEditor: 'sectioneditor.ana',
			reviewer: 'reviewer.julia',
			internalReviewer: 'reviewer.amara',
			copyeditor: 'copyeditor.carla',
			author: 'author.alex',
			reader: 'reader.rosa',
		},
	},
};
