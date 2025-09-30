import { AssessmentResult } from "@/services/api";

const KEY = (userId: string) => `ms_history_${userId}`;

export function saveAssessmentResult(userId: string, result: AssessmentResult) {
  try {
    const arr = loadAssessmentHistory(userId);
    // prevent duplicate entries by assessmentId
    if (!arr.find((r) => r.assessmentId === result.assessmentId)) {
      arr.push(result);
      localStorage.setItem(KEY(userId), JSON.stringify(arr));
    }
  } catch (e) {
    // ignore
  }
}

export function loadAssessmentHistory(userId: string): AssessmentResult[] {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as AssessmentResult[]) : [];
  } catch {
    return [];
  }
}

export function clearAssessmentHistory(userId: string) {
  try {
    localStorage.removeItem(KEY(userId));
  } catch (e) {
    // ignore
  }
}
