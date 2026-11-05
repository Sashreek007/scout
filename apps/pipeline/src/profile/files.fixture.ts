// Writes an invented profile.yaml, answers.yaml and resume PDFs into a fresh temp folder, for the
// push and pull tests. No real person's data.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PROFILE_YAML = `# A test profile. Every value is invented.

identity:
  full_name: Alex Example
  email: alex@example.com
  phone: "+1 780 555 0100"
  city: Edmonton, AB, Canada
  pronouns:  # leave blank to skip the field

links:
  linkedin: TODO
  github: https://github.com/example
  portfolio: https://example.com

education:
  school: Example University
  degree: BSc Computing Science
  year_of_study: 3
  expected_graduation: April 2028
  gpa:  # only if he wants it given

work_authorization:
  status: Study permit with a co-op work permit
  citizenship: Exampleland
  requires_sponsorship_for_coop: false
  canadian_citizen_or_pr: false
  internship_program: Example Internship Program
  sip_registered: true
  us_work_authorized: false  # confirm

availability:
  earliest_start: January 2027
  term_lengths_ok: [4, 8, 12]  # months
  relocation:
    edmonton: yes
    toronto: TODO
    remote: yes

compensation:
  expected_hourly_cad: TODO

current_role:
  company: Example Co
  title: Developer
  start: Sep. 2025

resumes:
  default: resumes/default.pdf  # path to PDF
  backend: resumes/backend.pdf
  ai: TODO
  devops:

demographics:
  policy: decline_to_answer

filters:
  excluded_sectors: [defence, weapons]
  excluded_employers: [General Dynamics]
  skip_if_requires: [SWPP]
  location: canada_only
  target_roles: [software engineering intern]
  daily_cap: 20
`;

export const ANSWERS_YAML = `# Remembered answers.
- question: "How did you hear about us?"
  answer: Company website
  kind: preference
  source: answers.yaml
- question: "Are you willing to work in office 3 days a week?"
  answer: "Yes"
  source: chat 2026-11-05
`;

export interface ProfileFiles {
  dir: string;
  profile: string;
  answers: string;
}

/** A temp folder with the files, and two small fake PDFs under `resumes/`. */
export function writeProfileFiles(
  profileYaml: string = PROFILE_YAML,
  answersYaml: string = ANSWERS_YAML,
): ProfileFiles {
  const dir = mkdtempSync(join(tmpdir(), 'scout-profile-'));
  const profile = join(dir, 'profile.yaml');
  const answers = join(dir, 'answers.yaml');
  writeFileSync(profile, profileYaml);
  writeFileSync(answers, answersYaml);
  mkdirSync(join(dir, 'resumes'));
  writeFileSync(join(dir, 'resumes/default.pdf'), '%PDF-1.7 default resume');
  writeFileSync(join(dir, 'resumes/backend.pdf'), '%PDF-1.7 backend resume');
  return { dir, profile, answers };
}
