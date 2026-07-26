// @ts-check
const {
	test,
	expect,
} = require('../../lib/pkp/playwright/support/base-test.js');
const {
	ReviewerManagerPage,
} = require('../../lib/pkp/playwright/pages/ReviewerManagerPage.js');
const {baselineUsers} = require('../../lib/pkp/playwright/data/users.js');

/**
 * Assign & manage reviewers — the OMP companion.
 *
 * Thin app companion to the shared feature spec
 * (docs/product/specs/assign-and-manage-reviewers.md, "App variations —
 * OMP"). It covers ONLY what that section declares; the machinery itself
 * is walked by the shared suite on OJS's external round
 * (lib/pkp/playwright/tests/assign-and-manage-reviewers.spec.js, 13
 * scenarios). Budget: tier H·12 → at most ceil(12/2) = 6 app-only tests
 * per app (MULTIAPP-PLAN §4); 4 are written — the highest-risk deltas,
 * not the ceiling.
 *
 * Test titles quote the App-variations stubs they test:
 *   1  the m1 parity declaration — MULTIAPP-PLAN §7b's REPRESENTATIVE
 *      SUBSET re-run on an Internal Review round: canonical scenario 1
 *      (assign from the pool) end to end, plus the rule-3 action menu of
 *      the row it creates
 *   2  "everyone holding a reviewer role" (m2) — the HALF OF THE OVERRIDE
 *      THAT HOLDS: a searched picker is scoped to the round's stage group
 *   3  "reviewer group to enroll into" (m3) — Enroll offers exactly the
 *      round's group; Create offers no group control at all and pins it
 *   4  "recommendation on their behalf" (m4) — recommendations do not
 *      exist in OMP: no control, no select, no recommendation on the row
 *
 * Deliberately NOT covered, and why:
 *   - the two ⚠ edges of m2 (the unsearched first picker page listing
 *     both groups — ledger 264; a cross-stage assignment being accepted —
 *     ledger 265) and every ⚠ carried over from Known deviations
 *     (assistant Log Response, status-blind Send To ORCID, the "Response
 *     due" mislabel, the mis-timed confirmation log row, the inert
 *     masthead checkbox / ledger 266). Deviations are LEDGER territory:
 *     a retained test that asserts one freezes the defect as the
 *     contract. All are live-confirmed in
 *     .reports/multiapp-trial-pilot2-probes.md §§4, 5, 11, 15.
 *   - m5 (the ORCID deposit is a no-op): its only observable is that
 *     nothing happens, and the row action that would trigger it is
 *     itself a deviation surface.
 *   - m4's "the by-proxy log entry never occurs": OMP offers no control
 *     that could write one, so an absence assertion there is
 *     unfalsifiable — the modal and row assertions in test 4 are the
 *     falsifiable half.
 *   - m6 (the author's laxer internal-round gate) and m7 (masthead):
 *     m6 is one Open question away from being settled ("whether authors
 *     should see internal rounds at all"), m7 is ledger 266.
 *
 * Conventions from docs/e2e/PRINCIPLES.md: the bootstrapped
 * `publicknowledge` press keeps its settings, series and seeded roster
 * untouched (submissions are additive and per-test; test 3's brand-new
 * reviewer is a THROWAWAY account, never an enrolment of a seeded user —
 * principle 7); unique hyphenless tags ride in the monograph title so
 * every Mailpit read is recipient+tag scoped (principle 8); no
 * hard-coded waits. Personas resolve through `appContext.seed.actors`
 * and their display names/emails come from the shared roster — never a
 * hard-coded identity (G4 §4.1).
 *
 * Harness notes carried from the probe battery: reviewer recommendations
 * are UNSEEDABLE on OMP (ledger 263 — presses are created with zero
 * `reviewer_recommendations` rows), so no seed here may pass
 * `reviewRounds[].reviewers[].recommendation`; and OMP's Create New
 * Reviewer form refuses dotted usernames (probes §16.5).
 */

/** A unique, hyphenless, alphanumeric tag (parallel isolation + mail scoping). */
function uniqueTag(prefix = 'amromp') {
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
 * Resolve a seeded identity from the shared roster: display name (row and
 * picker lookups) + email (Mailpit scoping). Callers pass an archetype's
 * username out of `appContext.seed.actors`, so no identity is hard-coded.
 *
 * @param {string} username
 * @returns {{username: string, name: string, email: string, givenName: string}}
 */
function person(username) {
	const user = baselineUsers.find((u) => u.username === username);
	if (!user) {
		throw new Error(`No baseline roster entry for '${username}'`);
	}
	return {
		username,
		name: `${user.givenName} ${user.familyName}`,
		email: user.email,
		givenName: user.givenName,
	};
}

/**
 * Scenario spec for a submitted monograph carrying the tag in its title.
 *
 * @param {object} appContext
 * @param {{tag: string, decisions: Array, reviewRounds: Array}} opts
 */
function monographSpec(appContext, {tag, decisions, reviewRounds}) {
	const {actors, contextPath, containers} = appContext.seed;
	return {
		tag,
		context: contextPath,
		submitter: actors.author,
		// OMP's container is a series, addressed by path (G4 handoff §5).
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
					title: {en: `Reviewer management ${tag}`},
					abstract: {en: `<p>Assign-and-manage-reviewers fixture ${tag}.</p>`},
				},
			},
		],
	};
}

/** A monograph parked in Internal Review round 1. */
function internalRoundSpec(appContext, {tag, reviewers = []}) {
	return monographSpec(appContext, {
		tag,
		decisions: [
			{type: 'sendInternalReview', by: appContext.seed.actors.seniorEditor},
		],
		reviewRounds: [{stage: 'internal', reviewers}],
	});
}

/** A monograph past internal review, now in External Review round 1. */
function externalRoundSpec(appContext, {tag, reviewers = []}) {
	const {seniorEditor} = appContext.seed.actors;
	return monographSpec(appContext, {
		tag,
		decisions: [
			{type: 'sendInternalReview', by: seniorEditor},
			{type: 'sendExternalReview', by: seniorEditor},
		],
		reviewRounds: [
			{stage: 'internal', reviewers: []},
			{stage: 'external', reviewers},
		],
	});
}

/**
 * The candidate list's per-item "Select {name}" button — present exactly
 * when the picker offers that candidate.
 *
 * @param {InstanceType<typeof ReviewerManagerPage>} rm
 * @param {import('@playwright/test').Locator} modal
 * @param {string} fullName
 */
function selectButton(rm, modal, fullName) {
	return rm
		.selectPanel(modal)
		.getByRole('button', {name: `Select ${fullName}`, exact: true});
}

/**
 * Type a search phrase into the picker and wait for THAT search's
 * reviewers response to land, so the assertions that follow read the
 * scoped list rather than the server-rendered first page (which is a
 * known deviation this file does not assert — ledger 264). The
 * `reviewStage` query parameter is the scoping mechanism (spec m2).
 *
 * @param {import('@playwright/test').Page} page
 * @param {InstanceType<typeof ReviewerManagerPage>} rm
 * @param {import('@playwright/test').Locator} modal
 * @param {string} phrase  single whitespace-free token
 * @param {number} reviewStage  WORKFLOW_STAGE_ID of the round being viewed
 */
async function searchPicker(page, rm, modal, phrase, reviewStage) {
	await Promise.all([
		page.waitForResponse(
			(res) =>
				/api\/v1\/users\/reviewers/.test(res.url()) &&
				res.url().includes(`reviewStage=${reviewStage}`) &&
				res.url().includes(`searchPhrase=${phrase}`) &&
				res.status() === 200,
			{timeout: 20_000},
		),
		rm.searchSelectPanel(modal, phrase),
	]);
}

/**
 * Switch the Add Reviewer modal to the Enroll Existing User form.
 *
 * @param {import('@playwright/test').Locator} modal
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function openEnrollForm(modal) {
	await modal
		.getByRole('link', {name: 'Enroll Existing User', exact: true})
		.last()
		.click();
	const form = modal.locator('#enrollExistingReviewerForm').last();
	await expect(form).toBeVisible({timeout: 20_000});
	return form;
}

/** The user-group `<select>`'s option labels, or [] when there is none. */
async function groupOptions(form) {
	return form
		.locator('select[name="userGroupId"]')
		.last()
		.locator('option')
		.allTextContents();
}

test.describe('Assign & manage reviewers — OMP variations', () => {
	// Capability gate, never an app-name check (MULTIAPP-PLAN §3). In this
	// repo it always holds; it is here so a mis-wired app.context.js fails
	// loudly instead of running internal-round assertions against an app
	// that has no Internal Review stage.
	test.beforeEach(async ({appContext}) => {
		test.skip(
			!appContext.hasInternalReview,
			'This companion covers the Internal Review stage.',
		);
	});

	test('the m1 parity declaration — "applies identically to Internal and External Review": canonical scenario 1 runs unchanged on an Internal Review round (pool assignment → Request Sent + the request email + the rule-3 menu of an unanswered row)', async ({
		appContext,
		asUser,
		pkpApi,
		pkpMail,
	}) => {
		test.slow(); // seed + the whole Add Reviewer flow + a Mailpit read
		const tag = uniqueTag('amrompa');
		const reviewer = person(appContext.seed.actors.internalReviewer);
		const {submission} = await pkpApi.createSubmission(
			internalRoundSpec(appContext, {tag}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const rm = new ReviewerManagerPage(page);
		// The landing round of a monograph in internal review IS the
		// internal round, so the panel that mounts is the internal one.
		await rm.gotoWorkflow(submission.id, {
			journalPath: appContext.seed.contextPath,
		});
		await expect(page).toHaveURL(
			new RegExp(
				`workflowMenuKey=workflow_${appContext.internalReviewStageId}_\\d+`,
			),
		);

		// The panel is the shared one: same top control, no rows yet.
		await expect(
			rm.manager.getByRole('button', {name: 'Add Reviewer', exact: true}),
		).toBeVisible();

		// Canonical scenario 1, verbatim, on the internal round.
		const modal = await rm.openAddReviewerModal();
		await searchPicker(
			page,
			rm,
			modal,
			reviewer.givenName,
			appContext.internalReviewStageId,
		);
		const form = await rm.selectReviewer(modal, reviewer.name);
		await rm.ensureDueDatesOrdered(form);
		await rm.awaitRichTextContains(form, 'personalMessage', tag);
		await rm.submitLegacyForm(form, 'Add Reviewer', modal);

		await expect(rm.row(reviewer.name)).toContainText('Request Sent');

		// The request email is the shared REVIEW_REQUEST mailable, seeded
		// by OMP's own registry — scoped by recipient + the tagged title.
		await pkpMail.find({
			to: reviewer.email,
			contains: tag,
			subject: 'Manuscript Review Request',
		});

		// Rule 3's switch on an internal round: an unanswered row offers
		// Unassign (not Cancel) and Log Response.
		await rm
			.row(reviewer.name)
			.getByRole('button', {name: 'More Actions'})
			.click();
		await expect(
			page.getByRole('menuitem', {name: 'Unassign Reviewer', exact: true}),
		).toBeVisible();
		await expect(
			page.getByRole('menuitem', {name: 'Log Response', exact: true}),
		).toBeVisible();
		await expect(
			page.getByRole('menuitem', {name: 'Cancel Reviewer', exact: true}),
		).toHaveCount(0);
		await expect(
			page.getByRole('menuitem', {name: 'Reinstate Reviewer', exact: true}),
		).toHaveCount(0);
	});

	test('"everyone holding a reviewer role" — the pool follows the round: a searched picker on an Internal Review round offers only Internal Reviewer group holders, while the same search on an External Review round offers the external-only ones too', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // two seeds, two pickers
		const tag = uniqueTag('amrompb');
		// The seeded asymmetry (G4 handoff §4): the `internalReviewer`
		// archetype holds BOTH reviewer groups, the `reviewer` archetype
		// only the external one — so the first is the control that the
		// search works at all and the second is the scoped candidate.
		const bothGroups = person(appContext.seed.actors.internalReviewer);
		const externalOnly = person(appContext.seed.actors.reviewer);
		const searchToken = 'Reviewer'; // the roster's family name for every reviewer

		const {submission: internal} = await pkpApi.createSubmission(
			internalRoundSpec(appContext, {tag: `${tag}i`}),
		);
		const {submission: external} = await pkpApi.createSubmission(
			externalRoundSpec(appContext, {tag: `${tag}e`}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const rm = new ReviewerManagerPage(page);
		const journalPath = appContext.seed.contextPath;

		// --- Internal round: the external-only reviewer is not a candidate.
		await rm.gotoWorkflow(internal.id, {journalPath});
		const internalModal = await rm.openAddReviewerModal();
		await searchPicker(
			page,
			rm,
			internalModal,
			searchToken,
			appContext.internalReviewStageId,
		);
		await expect(
			selectButton(rm, internalModal, bothGroups.name),
		).toBeVisible();
		await expect(
			selectButton(rm, internalModal, externalOnly.name),
		).toHaveCount(0);

		// --- External round: the same search offers both.
		await rm.gotoWorkflow(external.id, {journalPath});
		await expect(page).toHaveURL(
			new RegExp(`workflowMenuKey=workflow_${appContext.reviewStageId}_\\d+`),
		);
		const externalModal = await rm.openAddReviewerModal();
		await searchPicker(
			page,
			rm,
			externalModal,
			searchToken,
			appContext.reviewStageId,
		);
		await expect(
			selectButton(rm, externalModal, bothGroups.name),
		).toBeVisible();
		await expect(
			selectButton(rm, externalModal, externalOnly.name),
		).toBeVisible();
	});

	test('"reviewer group to enroll into" — the round\'s own group is the only one reachable: Enroll Existing User offers a one-option group choice per stage, and Create New Reviewer offers no group control at all, silently enrolling into the round\'s group', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		test.slow(); // two seeds, a create flow and two pickers
		const tag = uniqueTag('amrompc');
		const externalOnly = person(appContext.seed.actors.reviewer);
		// Throwaway account, created through the UI under test — never an
		// enrolment of a seeded user (PRINCIPLES §7). OMP's create form
		// refuses dotted usernames (probes §16.5), and the family name is
		// the tag so the external picker's search below is unambiguous.
		const newReviewer = {
			username: `rev${tag}`,
			givenName: 'Nova',
			familyName: tag,
			email: `rev${tag}@mailinator.com`,
		};
		const newReviewerName = `${newReviewer.givenName} ${newReviewer.familyName}`;

		const {submission: internal} = await pkpApi.createSubmission(
			internalRoundSpec(appContext, {tag: `${tag}i`}),
		);
		const {submission: external} = await pkpApi.createSubmission(
			externalRoundSpec(appContext, {tag: `${tag}e`}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const rm = new ReviewerManagerPage(page);
		const journalPath = appContext.seed.contextPath;

		// --- Internal round: Enroll offers exactly one group, the round's.
		await rm.gotoWorkflow(internal.id, {journalPath});
		let modal = await rm.openAddReviewerModal();
		const enrollInternal = await openEnrollForm(modal);
		expect(await groupOptions(enrollInternal)).toEqual(['Internal Reviewer']);
		await rm.closeModal(modal);

		// --- Internal round: Create offers NO group control; the group is
		// a hidden field pinned to the round's stage group, and the
		// created account is assigned in the same flow.
		modal = await rm.openAddReviewerModal();
		const createForm = await rm.openCreateReviewerForm(modal);
		await expect(createForm.locator('select[name="userGroupId"]')).toHaveCount(0);
		const pinnedGroup = createForm.locator(
			'input[type="hidden"][name="userGroupId"]',
		);
		await expect(pinnedGroup).toHaveCount(1);
		await expect(pinnedGroup).not.toHaveValue('');

		await createForm
			.locator('input[name="givenName[en]"]')
			.last()
			.fill(newReviewer.givenName);
		await createForm
			.locator('input[name="familyName[en]"]')
			.last()
			.fill(newReviewer.familyName);
		await createForm
			.locator('input[name="username"]')
			.last()
			.fill(newReviewer.username);
		await createForm.locator('input[name="email"]').last().fill(newReviewer.email);
		await rm.ensureDueDatesOrdered(createForm);
		await rm.awaitRichTextContains(createForm, 'personalMessage', `${tag}i`);
		await rm.submitLegacyForm(createForm, 'Add Reviewer', modal);
		await expect(rm.row(newReviewerName)).toContainText('Request Sent');

		// --- External round: its Enroll form offers the OTHER group, and
		// the account just created from the internal round is not a
		// candidate there — the enrolment really was pinned to the
		// internal group (positive control: the external-only reviewer is).
		await rm.gotoWorkflow(external.id, {journalPath});
		modal = await rm.openAddReviewerModal();
		const enrollExternal = await openEnrollForm(modal);
		expect(await groupOptions(enrollExternal)).toEqual(['External Reviewer']);
		await rm.closeModal(modal);

		modal = await rm.openAddReviewerModal();
		await searchPicker(page, rm, modal, tag, appContext.reviewStageId);
		await expect(selectButton(rm, modal, newReviewerName)).toHaveCount(0);
		await searchPicker(
			page,
			rm,
			modal,
			externalOnly.givenName,
			appContext.reviewStageId,
		);
		await expect(selectButton(rm, modal, externalOnly.name)).toBeVisible();
	});

	test('"recommendation on their behalf" — reviewer recommendations do not exist in OMP: a completed review\'s row carries no recommendation and its read modal offers neither one to read nor the set-or-adjust control, while the rest of the modal is intact', async ({
		appContext,
		asUser,
		pkpApi,
	}) => {
		const tag = uniqueTag('amrompd');
		const reviewer = person(appContext.seed.actors.internalReviewer);
		// Seeded 'completed' is editor-confirmed → the row starts Complete,
		// the status whose "extra info shown" in rule 2 is the reviewer's
		// recommendation everywhere the feature exists. No `recommendation`
		// key: it is unseedable on OMP (ledger 263).
		const {submission} = await pkpApi.createSubmission(
			internalRoundSpec(appContext, {
				tag,
				reviewers: [
					{
						user: reviewer.username,
						method: 'anonymous',
						status: 'completed',
						comments: {
							toAuthor: `<p>Author-facing comments ${tag}</p>`,
							toEditor: `<p>Editor-only comments ${tag}</p>`,
						},
					},
				],
			}),
		);

		const ctx = await asUser(appContext.seed.actors.seniorEditor);
		const page = await ctx.newPage();
		const rm = new ReviewerManagerPage(page);
		await rm.gotoWorkflow(submission.id, {
			journalPath: appContext.seed.contextPath,
		});

		// The row reaches Complete and shows nothing else — in OJS the same
		// row would carry the reviewer's recommendation label beside it.
		const row = rm.row(reviewer.name);
		await expect(row).toContainText('Complete');
		await expect(row).not.toContainText(/recommend/i);
		for (const ojsRecommendation of [
			'Accept Submission',
			'Revisions Required',
			'Resubmit for Review',
			'Decline Submission',
			'See Comments',
		]) {
			await expect(row).not.toContainText(ojsRecommendation);
		}

		// The read modal: no recommendation to read, and no control to set
		// or adjust one (in OJS this form carries a
		// `select#reviewerRecommendationId` and a "Set or adjust…" block).
		const modal = await rm.openReviewDetails(reviewer.name);
		const form = await rm.legacyForm(modal, 'readReviewForm');
		await expect(form.locator('select#reviewerRecommendationId')).toHaveCount(0);
		await expect(form.getByText(/set or adjust/i)).toHaveCount(0);
		await expect(modal.getByText(/recommendation/i)).toHaveCount(0);
		// (A blanket "no <select> anywhere in the modal" assertion was
		// tried and dropped: the Reviewer Files grid contributes one of
		// its own, unrelated to this claim and not always in the DOM.)

		// Positive controls — everything else the modal owns is intact, so
		// the absences above are the app's, not a mis-opened modal.
		await expect(
			modal.getByText(`Author-facing comments ${tag}`),
		).toBeVisible();
		await expect(
			modal.getByText(`Editor-only comments ${tag}`),
		).toBeVisible();
		await expect(form.locator('input[name="quality"]').first()).toBeAttached();
		await expect(
			form.getByRole('button', {name: 'Confirm', exact: true}),
		).toBeVisible();
	});
});
