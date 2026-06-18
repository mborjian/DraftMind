export enum ExecutionStatus {
  Pending = 'pending',
  Collecting = 'collecting',
  DetectingTopics = 'detecting-topics',
  AwaitingApproval = 'awaiting-approval',
  GeneratingDrafts = 'generating-drafts',
  AwaitingDraftReview = 'awaiting-draft-review',
  Publishing = 'publishing',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}
