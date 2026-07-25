// @ts-check

/**
 * Bootstrap spec for the OMP test session. POSTed to the CANONICAL
 * cross-app route /api/v1/_test/scenarios/context by the shared
 * lib/pkp/playwright/tests/bootstrap.setup.js (via `pkpApi.bootstrap`).
 *
 * Mirrors ojs-main/playwright/fixtures/bootstrap.js wherever the concept
 * exists in OMP; the deltas are all forced by the app, not by taste:
 *
 *   - `path` stays `publicknowledge` in all three apps (MULTIAPP-PLAN §3
 *     — POMs and `isBootstrapped()` rely on it).
 *   - `sections[]` seeds SERIES here (APP-GLOSSARY §1 section→series).
 *     OMP series are keyed by `path` and their schema has NO `abbrev`, so
 *     entries carry `path`. OMP's ContextService seeds no default series,
 *     unlike OJS/OPS, so without this block a press has zero containers.
 *   - no `issues` — OMP has no issues (counterpart feature: the catalog).
 *     The key is an OJS-only schema overlay and would 400 here.
 *   - no `abbreviation` / `publisherInstitution` / `onlineIssn` /
 *     `printIssn` / `publishingMode` — those live in OJS's (and partly
 *     OPS's) context schema, not OMP's.
 *   - `users[]` is the SHARED identity roster (lib/pkp/playwright/data/
 *     users.js) minus site admin. Every baseline role exists in OMP's 19
 *     user groups, so the roster carries over whole; two reviewers are
 *     additionally enrolled in OMP's Internal Reviewer group so
 *     internal-round scenarios have actors (`hasInternalReview`).
 */

const {
	baselineUsers,
	getPassword,
} = require('../../lib/pkp/playwright/data/users.js');

/**
 * OMP-only role additions on top of the shared roster. OMP splits the
 * reviewer persona into External Reviewer (the shared `reviewer` role
 * string) and Internal Reviewer; keeping two of the four baseline
 * reviewers external-only preserves an "external reviewer who is NOT an
 * internal reviewer" case for pool-scoping probes.
 */
const EXTRA_ROLES = {
	'reviewer.amara': ['internalReviewer'],
	'reviewer.adam': ['internalReviewer'],
};

/**
 * Bootstrap consumes only non-admin users; admin is created by the
 * installer. Each user carries `password` so the server creates them on
 * the first call.
 */
const bootstrapUsers = baselineUsers
	.filter((u) => !u.siteAdmin)
	.map((u) => ({
		username: u.username,
		password: getPassword(u.username),
		givenName: u.givenName,
		familyName: u.familyName,
		email: u.email,
		country: u.country,
		affiliation: u.affiliation,
		roles: [...(u.roles ?? []), ...(EXTRA_ROLES[u.username] ?? [])],
		...(u.mustChangePassword ? {mustChangePassword: true} : {}),
	}));

module.exports = {
	tag: 'baseline',
	path: 'publicknowledge',
	name: {
		en: 'Public Knowledge Press',
		fr_CA: 'Presses de la connaissance du public',
	},
	description: {
		en: 'Public Knowledge Press publishes peer-reviewed scholarly monographs and edited volumes on public access to research.',
		fr_CA:
			"Les Presses de la connaissance du public publient des monographies savantes évaluées par les pairs sur l'accès public à la recherche.",
	},
	acronym: {en: 'PKP'},
	primaryLocale: 'en',
	supportedLocales: ['en', 'fr_CA'],
	country: 'IS',
	contact: {name: 'Maya Manager', email: 'manager.maya@mailinator.com'},

	// Bootstrap enrichment — the OJS baseline's representative defaults,
	// restricted to settings OMP's context schema actually declares.
	enableAnnouncements: true,
	enablePublicComments: true,
	submitWithCategories: true,
	keywords: 'request',
	citations: 'request',
	reviewerSuggestionEnabled: true,
	enableDois: true,
	doiPrefix: '10.1234',
	enabledDoiTypes: ['publication'],
	doiCreationTime: 'publicationCreationTime',
	defaultReviewMode: 2, // SUBMISSION_REVIEW_METHOD_DOUBLEANONYMOUS
	numWeeksPerResponse: 4,
	numWeeksPerReview: 4,
	numDaysBeforeReviewResponseReminderDue: 2,
	numDaysAfterReviewResponseReminderDue: 2,
	numDaysBeforeReviewSubmitReminderDue: 2,
	numDaysAfterReviewSubmitReminderDue: 2,

	// Series (APP-GLOSSARY: OJS section → OMP series). Two containers,
	// mirroring the OJS baseline's ART/REV pair, shaped for OMP's two work
	// types (authored work / edited volume).
	sections: [
		{
			path: 'monographs',
			title: {en: 'Monographs'},
			sectionEditors: [
				'editor.diana',
				'sectioneditor.ana',
				'sectioneditor.omar',
			],
		},
		{
			path: 'editedvolumes',
			title: {en: 'Edited Volumes'},
			sectionEditors: ['editor.diana', 'sectioneditor.ravi'],
		},
	],

	categories: [
		{
			path: 'applied-science',
			title: {en: 'Applied Science'},
			children: [
				{
					path: 'comp-sci',
					title: {en: 'Computer Science'},
					children: [{path: 'computer-vision', title: {en: 'Computer Vision'}}],
				},
				{path: 'eng', title: {en: 'Engineering'}},
			],
		},
		{
			path: 'social-sciences',
			title: {en: 'Social Sciences'},
			children: [
				{path: 'sociology', title: {en: 'Sociology'}},
				{path: 'anthropology', title: {en: 'Anthropology'}},
			],
		},
	],

	users: bootstrapUsers,
};
