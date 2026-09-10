export const JOB_STATUSES = ['QUEUED', 'CLAIMED', 'RUNNING', 'RETRY_QUEUED', 'SUCCEEDED', 'FAILED', 'CANCELLED'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  QUEUED: ['CLAIMED', 'CANCELLED'],
  CLAIMED: ['RUNNING', 'QUEUED', 'RETRY_QUEUED', 'FAILED', 'CANCELLED'],
  RUNNING: ['SUCCEEDED', 'FAILED', 'RETRY_QUEUED', 'CANCELLED'],
  RETRY_QUEUED: ['CLAIMED', 'CANCELLED'],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
};

export interface RetryDecision {
  status: 'RETRY_QUEUED' | 'FAILED';
  nextRetryAt?: Date;
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function retryDecision(attemptNumber: number, maxAttempts: number, retryable: boolean, now = new Date()): RetryDecision {
  if (!retryable || attemptNumber >= maxAttempts) return { status: 'FAILED' };
  return { status: 'RETRY_QUEUED', nextRetryAt: now };
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'SUCCEEDED' || status === 'FAILED' || status === 'CANCELLED';
}
