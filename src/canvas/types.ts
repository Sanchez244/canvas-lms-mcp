// Subset of Canvas REST v1 shapes this server reads. Field names match the API:
// https://canvas.instructure.com/doc/api/

export interface Term {
  id: number;
  name: string;
  start_at: string | null;
  end_at: string | null;
}

export interface Course {
  id: number;
  name: string;
  course_code: string;
  workflow_state: string;
  term?: Term;
  syllabus_body?: string | null;
  enrollments?: { type: string; enrollment_state: string }[];
}

export interface Submission {
  id?: number;
  workflow_state: string;
  submitted_at: string | null;
  score: number | null;
  grade: string | null;
  late: boolean;
  missing: boolean;
  attachments?: { id: number; display_name: string; url: string }[];
}

export interface RubricCriterion {
  id: string;
  description: string;
  long_description?: string;
  points: number;
  ratings?: { description: string; points: number }[];
}

export interface Assignment {
  id: number;
  course_id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  unlock_at: string | null;
  lock_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  allowed_extensions?: string[];
  html_url: string;
  rubric?: RubricCriterion[];
  submission?: Submission;
  has_submitted_submissions?: boolean;
  is_quiz_assignment?: boolean;
}

export interface PlannerItem {
  context_type: string;
  course_id?: number;
  context_name?: string;
  plannable_type: string;
  plannable_id: number;
  plannable: { id: number; title: string; due_at?: string | null; todo_date?: string | null; points_possible?: number | null };
  plannable_date: string;
  html_url?: string;
  submissions?: false | { submitted: boolean; excused: boolean; graded: boolean; late: boolean; missing: boolean };
}

export interface ModuleItem {
  id: number;
  title: string;
  type: string;
  position: number;
  indent: number;
  content_id?: number;
  page_url?: string;
  external_url?: string;
  html_url?: string;
  url?: string;
  completion_requirement?: { type: string; completed?: boolean };
}

export interface Module {
  id: number;
  name: string;
  position: number;
  state?: string;
  unlock_at: string | null;
  items?: ModuleItem[];
  items_count: number;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  size: number;
  "content-type": string;
  url: string;
  folder_id: number;
  updated_at: string;
  locked_for_user?: boolean;
  lock_explanation?: string;
}

export interface Page {
  url: string;
  title: string;
  body?: string | null;
  updated_at: string;
}
