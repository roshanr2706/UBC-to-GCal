export interface Session {
  courseCode: string;
  title: string;
  section: string;
  component: string;
  deliveryMode: string;
  days: string[];
  startTime: string;
  endTime: string;
  rangeStart: string;
  rangeEnd: string;
  location: string | null;
  instructor: string | null;
  term: string;
  status: string;
  included: boolean;
  flags: string[];
}

export type SessionFlag = 'not-registered' | 'no-meeting-time' | 'parse-error';
