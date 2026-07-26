// @ts-check
const {
	test,
	expect,
} = require('../../lib/pkp/playwright/support/base-test.js');
const {
	WorkflowShellPage,
} = require('../../lib/pkp/playwright/pages/WorkflowShellPage.js');

/**
 * Workflow stage navigation — the OMP companion.
 *
 * Thin app companion to the shared feature spec
 * (docs/product/specs/workflow-stage-navigation.md); it covers ONLY the
 * deltas that spec's "App variations — OMP" section declares, never the
 * shared shell mechanics the base suite already walks on OJS
 * (MULTIAPP-PLAN §3). Budget: tier M·6 → at most ceil(6/2) = 3 app-only
 * tests per app (§4); all three are spent on the internal-review stage
 * topology, which is the whole shape difference of this app.
 *
 * Test titles quote the App-variations stubs they test:
 *   1  "travels through four stages" — through five (+ "See the header
 *      tools", "Below Workflow sits a Publication group")
 *   2  "listing all four stages" — listing all five, with the duplicate
 *      "Review Round 1" labels, and "the current round's entry" per
 *      review stage
 *   3  "entry is itself selectable" — both review parents, plus the
 *      OMP-only side-column loss the Known deviations record
 *
 * Overrides deliberately NOT covered (budget; all probed 2026-07-26,
 * pilot-1 batch A, and none of them is topology): the five stage-named
 * legacy addresses, the Publication roster / production-bound entries,
 * the author dressing's roster, and the un-reached Production side
 * column (which is an Open question, not a settled claim).
 *
 * Conventions carried over from docs/e2e/PRINCIPLES.md: the bootstrapped
 * `publicknowledge` press stays read-only (submissions are additive and
 * per-test), tags are unique hyphenless tokens, no hard-coded waits, no
 * Mailpit reads (the shell sends no mail). Personas are resolved through
 * `appContext.seed.actors` — never a hard-coded username, because the
 * same archetype maps to different identities per app (G4 §4.1).
 *
 * Harness note (pilot-1 batch A §10.1): OMP presses are created with ZERO
 * reviewer recommendations, so no seed here may use
 * `reviewRounds[].reviewers[].recommendation`.
 */

/** A unique, hyphenless, alphanumeric tag (parallel isolation). */
function uniqueTag(prefix = 'wsnomp') {
	const workerLetter = String.fromCharCode(
		97 + (test.info().parallelIndex % 26),
	);
	let suffix = '';
	while (suffix.length < 6) {
		suffix += Math.random().toString(36).replace(/[^a-z0-9]/g, '');
	}
	return `${prefix}${workerLetter}${suffix.slice(0, 6)}`;
}

/**
 * The menu node for one entry, scoped by the aria-label PanelMenu puts on
 * every `li[role="treeitem"]`.
 *
 * This scoping is NOT decoration on OMP. Both review stages render their
 * rounds from the same locale key, so a monograph with rounds in both
 * shows two entries reading exactly "Review Round 1" — the shared POM's
 * `menuItem()` (an exact-name `getByRole('link')` lookup) is ambiguous
 * here and would throw in strict mode. Round entries must always be
 * looked up under their parent stage (spec footnote v4).
 *
 * @param {WorkflowShellPage} shell
 * @param {string} label
 */
function stageNode(shell, label) {
	return shell.nav().locator(`li[role="treeitem"][aria-label="${label}"]`);
}

/**
 * The clickable `<a>` of a stage entry (the stripe class lives on it).
 *
 * @param {WorkflowShellPage} shell
 * @param {string} label
 */
function stageLink(shell, label) {
	return stageNode(shell, label).locator('a').first();
}

/**
 * The round entry nested UNDER a named review stage.
 *
 * @param {WorkflowShellPage} shell
 * @param {string} stageLabel 'Internal Review' | 'External Review'
 * @param {string} roundLabel e.g. 'Review Round 1'
 */
function roundLink(shell, stageLabel, roundLabel) {
	return stageNode(shell, stageLabel)
		.locator(`li[role="treeitem"][aria-label="${roundLabel}"] a`)
		.first();
}

/** The menu's group headers, in DOM order (Workflow / Marketing / Publication). */
async function groupHeaders(shell) {
	return shell
		.nav()
		.locator('[data-pc-section="header"][aria-label]')
		.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
}

/**
 * Scenario spec for a submitted monograph carrying the tag in its title.
 *
 * @param {object} appContext the app capability map (vocabulary + actors)
 */
function monographSpec(appContext, {tag, title, decisions, reviewRounds}) {
	const {actors, contextPath, containers} = appContext.seed;
	return {
		tag,
		context: contextPath,
		submitter: actors.author,
		// OMP's container is a series, addressed by path — appContext
		// carries both the key and the seeded handles (G4 handoff item 5).
		[appContext.submissionContainerKey]: containers[0],
		locale: 'en',
		submitted: true,
		participants: [
			{user: actors.seniorEditor, role: 'editor'},
			{user: actors.sectionEditor, role: 'sectionEditor'},
		],
		decisions,
		reviewRounds,
		publications: [
			{
				versionStage: 'AO',
				published: false,
				metadata: {
					title: {en: title},
					abstract: {en: `<p>Abstract for ${tag}.</p>`},
				},
			},
		],
	};
}

/** A monograph parked in Internal Review round 1, one accepted reviewer. */
function inInternalReviewSpec(appContext, {tag, title}) {
	const {actors} = appContext.seed;
	return monographSpec(appContext, {
		tag,
		title,
		decisions: [{type: 'sendInternalReview', by: actors.seniorEditor}],
		reviewRounds: [
			{
				stage: 'internal',
				reviewers: [
					{
						user: actors.internalReviewer,
						method: 'anonymous',
						status: 'accepted',
					},
				],
			},
		],
	});
}

/** A monograph past internal review and now in External Review round 1. */
function inExternalReviewSpec(appContext, {tag, title}) {
	const {actors} = appContext.seed;
	return monographSpec(appContext, {
		tag,
		title,
		decisions: [
			{type: 'sendInternalReview', by: actors.seniorEditor},
			{type: 'sendExternalReview', by: actors.seniorEditor},
		],
		reviewRounds: [
			{
				stage: 'internal',
				reviewers: [
					{
						user: actors.internalReviewer,
						method: 'anonymous',
						status: 'accepted',
					},
				],
			},
			{stage: 'external', reviewers: []},
		],
	});
}

test.describe('Workflow stage navigation — OMP variations', () => {
	// Capability gate, never an app-name check (MULTIAPP-PLAN §3). In this
	// repo it always holds; it is here so a mis-wired app.context.js fails
	// loudly instead of running internal-review assertions on an app that
	// has no internal review stage.
	test.beforeEach(async ({appContext}) => {
		test.skip(
			!appContext.hasInternalReview,
			'This companion covers the Internal Review stage.',
		);
	});

	test('"travels through four stages" — through five: a monograph in Internal Review shows five stage entries, the Internal Review (Round N) indicator, the Marketing group and the work-type control, and the OMP stage names inside the shared status boxes', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // one seed + a three-stop menu tour
		const tag = uniqueTag('wsnompa');
		const title = `Internal review topology ${tag}`;
		const {submission} = await pkpApi.createSubmission(
			inInternalReviewSpec(appContext, {tag, title}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const shell = new WorkflowShellPage(page, {
			journalPath: appContext.seed.contextPath,
		});
		await shell.gotoEditorial(submission.id);

		// Landing: the current round of the review stage the monograph is
		// in — "the current round's entry", per review stage (v8).
		await expect(
			shell.contentHeading('Workflow: Internal Review (Round 1)'),
		).toBeVisible({timeout: 20_000});
		await expect(page).toHaveURL(
			new RegExp(`workflowMenuKey=workflow_${appContext.internalReviewStageId}_\\d+`),
		);

		// The indicator is an OMP-only state with its own dot color (v3).
		await expect(shell.header()).toContainText('Internal Review (Round 1)');
		await expect(shell.indicatorDot()).toHaveClass(
			/bg-stage-in-internal-review/,
		);

		// Five stage entries, on-screen Internal Review / External Review,
		// each review stage nesting its own rounds (v2, v4).
		for (const stage of [
			'Submission',
			'Internal Review',
			'External Review',
			'Copyediting',
			'Production',
		]) {
			await expect(stageLink(shell, stage)).toBeVisible();
		}
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toBeVisible();
		await expect(
			stageNode(shell, 'External Review').locator('li[role="treeitem"]'),
		).toHaveCount(0); // the untouched review stage nests no rounds

		// The stripe sits on the current stage's parent AND its current
		// round, in the internal palette (base rule 4 per review stage).
		await expect(stageLink(shell, 'Internal Review')).toHaveClass(
			/border-stage-in-internal-review/,
		);
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toHaveClass(/border-stage-in-internal-review/);
		await expect(stageLink(shell, 'External Review')).not.toHaveClass(
			/border-stage-/,
		);

		// "Below Workflow sits a Publication group" — a third group,
		// Marketing, sits BETWEEN Workflow and Publication (v5).
		expect(await groupHeaders(shell)).toEqual([
			'Workflow',
			'Marketing',
			'Publication',
		]);
		for (const item of ['Audience', 'Representatives', 'Publication Dates']) {
			await expect(shell.menuItem(item)).toBeVisible();
		}

		// "See the header tools" — a work-type control labeled with the
		// current work type sits beside Library, and there is no payment
		// dropdown (v7).
		await expect(shell.headerButton('Activity Log')).toBeVisible();
		await expect(shell.headerButton('Library')).toBeVisible();
		await expect(shell.headerButton('Monograph')).toBeVisible();
		await expect(
			shell.header().getByRole('button', {name: /payment/i}),
		).toHaveCount(0);

		// The shared status boxes render with THIS app's stage names
		// substituted — no internal-specific wording exists (v2).
		await shell.clickMenu('Copyediting');
		await expect(shell.contentHeading('Workflow: Copyediting')).toBeVisible();
		await shell.expectStageNotStarted('Copyediting');

		await stageLink(shell, 'Submission').click();
		await expect(shell.contentHeading('Workflow: Submission')).toBeVisible();
		await expect(
			shell
				.primaryItems()
				.getByText('The submission is currently in the Internal Review stage.'),
		).toBeVisible();
	});

	test('"listing all four stages" — listing all five: a monograph with rounds in both review stages shows two entries reading exactly "Review Round 1", told apart only by their parent and by the content-pane heading', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // one seed + two scoped round visits
		const tag = uniqueTag('wsnompb');
		const title = `Duplicate round labels ${tag}`;
		const {submission} = await pkpApi.createSubmission(
			inExternalReviewSpec(appContext, {tag, title}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const shell = new WorkflowShellPage(page, {
			journalPath: appContext.seed.contextPath,
		});
		await shell.gotoEditorial(submission.id);

		// The landing follows the CURRENT review stage's current round
		// (v8): external here, even though an internal round exists.
		await expect(
			shell.contentHeading('Workflow: External Review (Round 1)'),
		).toBeVisible({timeout: 20_000});
		await expect(page).toHaveURL(
			new RegExp(`workflowMenuKey=workflow_${appContext.reviewStageId}_\\d+`),
		);

		// THE hazard this override records: the round label is identical
		// under both review stages, so an exact-name menu lookup is
		// ambiguous on OMP (v4). Two entries, one label.
		await expect(shell.menuItem('Review Round 1')).toHaveCount(2);
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toBeVisible();
		await expect(
			roundLink(shell, 'External Review', 'Review Round 1'),
		).toBeVisible();

		// Only the current stage's round carries the stripe, in that
		// stage's palette — the round rules apply per review stage.
		await expect(
			roundLink(shell, 'External Review', 'Review Round 1'),
		).toHaveClass(/border-stage-in-review/);
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).not.toHaveClass(/border-stage-/);

		// The parent tells them apart, and so does the heading once
		// selected: the internal round of a monograph that has moved on
		// reports the stage it is now in, with the OMP stage name.
		await roundLink(shell, 'Internal Review', 'Review Round 1').click();
		await expect(
			shell.contentHeading('Workflow: Internal Review (Round 1)'),
		).toBeVisible();
		await expect(
			shell
				.primaryItems()
				.getByText('The submission is currently in the External Review stage.'),
		).toBeVisible();

		await roundLink(shell, 'External Review', 'Review Round 1').click();
		await expect(
			shell.contentHeading('Workflow: External Review (Round 1)'),
		).toBeVisible();
	});

	test('"entry is itself selectable" — both review entries select and fold their round list; the round-less view misdescribes an active round, and on Internal Review it also loses its side column', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // two seeds, two panels
		const tag = uniqueTag('wsnompc');
		const internalTitle = `Round-less internal ${tag}i`;
		const externalTitle = `Round-less external ${tag}e`;
		const {submission: inInternal} = await pkpApi.createSubmission(
			inInternalReviewSpec(appContext, {
				tag: `${tag}i`,
				title: internalTitle,
			}),
		);
		const {submission: inExternal} = await pkpApi.createSubmission(
			inExternalReviewSpec(appContext, {
				tag: `${tag}e`,
				title: externalTitle,
			}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const shell = new WorkflowShellPage(page, {
			journalPath: appContext.seed.contextPath,
		});

		// --- Internal Review, round 1 running. ---
		await shell.gotoEditorial(inInternal.id);
		await expect(
			shell.contentHeading('Workflow: Internal Review (Round 1)'),
		).toBeVisible({timeout: 20_000});

		// Selectable: the parent takes the selection and sets the heading.
		await stageLink(shell, 'Internal Review').click();
		await expect(
			shell.contentHeading('Workflow: Internal Review'),
		).toBeVisible();
		await expect(page).toHaveURL(
			new RegExp(`workflowMenuKey=workflow_${appContext.internalReviewStageId}(&|$)`),
		);
		// …and every click folds/unfolds the round list underneath it.
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toBeHidden();
		await stageLink(shell, 'Internal Review').click();
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toBeVisible();
		await stageLink(shell, 'Internal Review').click();
		await expect(
			roundLink(shell, 'Internal Review', 'Review Round 1'),
		).toBeHidden();

		// ⚠ Known deviations (ledger row 213): the round-less view claims
		// the monograph has advanced while round 1 is still running, and
		// drops the decision rail.
		await expect(
			shell
				.primaryItems()
				.getByText(
					'The submission has been advanced to the next round of review',
				),
		).toBeVisible();
		await expect(shell.actionItems()).toHaveCount(0);
		// OMP-only extension of that cluster: Internal Review's round-less
		// view ALSO loses the Participants side column.
		await expect(shell.secondaryItems()).toHaveCount(0);

		// --- External Review, round 1 running: same misdescription… ---
		await shell.gotoEditorial(inExternal.id);
		await expect(
			shell.contentHeading('Workflow: External Review (Round 1)'),
		).toBeVisible({timeout: 20_000});
		await stageLink(shell, 'External Review').click();
		await expect(
			shell.contentHeading('Workflow: External Review'),
		).toBeVisible();
		await expect(
			shell
				.primaryItems()
				.getByText(
					'The submission has been advanced to the next round of review',
				),
		).toBeVisible();
		await expect(shell.actionItems()).toHaveCount(0);
		// …but the External Review parent inherits the OJS guard and KEEPS
		// its side column — the contrast that makes the loss above OMP-only.
		await expect(shell.secondaryItems()).toBeVisible();
	});
});
