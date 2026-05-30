import { ulid } from "ulid";

export type JobStatus = "queued" | "running" | "done" | "failed";
export type JobRecord = {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  progress: number;
  error?: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
};

export class JobService {
  private readonly jobs = new Map<string, JobRecord>();

  enqueue(type: string, payload: unknown) {
    const job: JobRecord = {
      id: `job_${ulid()}`,
      type,
      payload,
      status: "queued",
      progress: 0,
      created_at: new Date().toISOString()
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(id: string) {
    return this.jobs.get(id) ?? null;
  }

  update(id: string, patch: Partial<Omit<JobRecord, "id">>) {
    const current = this.jobs.get(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.jobs.set(id, next);
    return next;
  }
}
