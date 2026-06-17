/**
 * Grade version (re-learning control).
 *
 * The knowledge base re-grades an ingredient ONLY when its stored gradeVersion is
 * below CURRENT_GRADE_VERSION — i.e. when we deliberately bump this after improving
 * the grading prompt/model/logic. Bumping triggers lazy re-grading on next encounter.
 *
 * There is intentionally NO time-to-live / auto-expiry: ingredient chemistry doesn't
 * change because months passed, and auto-expiry would make the same product score
 * differently over time (nondeterministic). The `gradedAt` timestamp is metadata
 * only — it enables a manual, version-scoped re-grade if ever wanted, never auto-fires.
 */
// v2: `aggravates` became three graded levels (aggravates-slight/moderate/strong),
// so old flat-`aggravates` grades must re-grade into the new harm scale.
export const CURRENT_GRADE_VERSION = 2;
