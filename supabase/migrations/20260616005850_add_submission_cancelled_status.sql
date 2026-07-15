-- Keep the submission status enum in sync with the API schema.
ALTER TYPE public."SubmissionStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
