// The third step of the daily run: the hard filters (#8) on every job this run saw. They are plain
// code and cheap, so they run again on every run, and a change to his profile applies at once.
import {
  filterJob,
  type BuiltJob,
  type FilterReason,
  type JobKey,
  type Profile,
  type Stage,
} from '@scout/core';

export interface FilterStepResult {
  jobs: BuiltJob[];
  /** How many jobs each rule dropped. A job dropped by two rules counts for both. */
  reasons: Partial<Record<FilterReason, number>>;
}

/** Sets `filter` on each job, from his profile and the stage of its application, if any. */
export function filterJobs(
  jobs: readonly BuiltJob[],
  profile: Profile,
  stages: ReadonlyMap<JobKey, Stage>,
): FilterStepResult {
  const reasons: Partial<Record<FilterReason, number>> = {};
  const filtered = jobs.map((built): BuiltJob => {
    const filter = filterJob({
      job: built.job,
      profile,
      applicationStage: stages.get(built.job.key) ?? null,
    });
    for (const reason of filter.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
    return { ...built, job: { ...built.job, filter } };
  });
  return { jobs: filtered, reasons };
}
