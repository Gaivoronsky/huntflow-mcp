export interface HFVacancy {
  id: number;
  position: string;
  company: string;
  money?: string;
  state: string;
  created: string;
  priority: number;
}

export interface HFApplicant {
  id: number;
  first_name: string;
  last_name: string;
  middle_name?: string;
  email?: string;
  phone?: string;
  position?: string;
  created: string;
}

export interface HFResume {
  id: number;
  auth_type: string;
  account_source?: number;
  created: string;
  updated: string;
}

export interface HFStage {
  id: number;
  name: string;
  order: number;
  removed?: boolean;
}

export interface HFAccount {
  id: number;
  name: string;
  nick: string;
}
