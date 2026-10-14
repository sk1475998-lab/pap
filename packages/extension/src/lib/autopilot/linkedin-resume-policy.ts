/** LinkedIn resume-upload eligibility: text drafts are review artifacts, not upload files. */
export interface LinkedInResumeUploadCandidate {
  fileName: string;
  mimeType: string;
}

export function isLinkedInResumeUploadable(file: LinkedInResumeUploadCandidate): boolean {
  return /pdf|msword|officedocument\.wordprocessingml/i.test(file.mimeType) || /\.(pdf|doc|docx)$/i.test(file.fileName);
}
