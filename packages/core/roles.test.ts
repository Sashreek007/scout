import { describe, expect, it } from 'vitest';
import { isStudentRole, termsInTitle } from './roles';

describe('isStudentRole', () => {
  it.each([
    'Software Engineering Intern',
    'Intern - Software Engineer, Winter 2027',
    'Summer Interns, Platform',
    'Research Internship (Winter 2027)',
    'Software Internships',
    'Agile Software Engineer - Co-op',
    'Machine Learning Intern/Co-op  (Winter 2027)',
    'Developer Coop',
    'CO-OP Student, Data',
    'Student Developer',
    'Working Students',
    'Software Engineer (Summer 2027)',
    'Platform Engineer, Fall 2026',
    'Backend Developer - Winter, 2027',
    'Data Analyst 2027 Summer',
    'Spring 2027 Developer',
  ])('keeps "%s"', (title) => {
    expect(isStudentRole(title)).toBe(true);
  });

  it.each([
    'Agentic QA Engineer',
    'Senior Agentic Engineer - JavaScript',
    'Director, Internal Audit (Information Technology)',
    'International Payments Analyst',
    'Credit Union Cooperative Specialist',
    'Software Engineer, New Grad 2027',
    'Summer Camp Coordinator',
    'Fall Prevention Researcher',
    'Data Scientist, Growth (12 month contract)',
  ])('drops "%s"', (title) => {
    expect(isStudentRole(title)).toBe(false);
  });
});

describe('termsInTitle', () => {
  it('reads a season with its year, however it is written', () => {
    expect(termsInTitle('Intern - Credit Risk, Winter 2027')).toEqual({
      rawTerm: 'Winter 2027',
      terms: ['Winter 2027'],
    });
    expect(termsInTitle('Revenue Operations Intern (Winter, 2027)')).toEqual({
      rawTerm: 'Winter, 2027',
      terms: ['Winter 2027'],
    });
    expect(termsInTitle('SUMMER 2027 / FALL 2027 co-op')).toEqual({
      rawTerm: 'SUMMER 2027, FALL 2027',
      terms: ['Summer 2027', 'Fall 2027'],
    });
    expect(termsInTitle('2027 Summer Analyst, Summer 2027')).toEqual({
      rawTerm: '2027 Summer, Summer 2027',
      terms: ['Summer 2027'],
    });
  });

  it('finds no term without a year', () => {
    expect(termsInTitle('Summer Intern')).toEqual({ rawTerm: null, terms: [] });
  });
});
