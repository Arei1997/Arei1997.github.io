/**
 * All of the site's copy lives in this file — edit it to update the portfolio.
 * Fields marked TODO are placeholders that need your real details.
 */
import type { ThemeId } from './themes/index.ts';

export interface Link {
  label: string;
  href: string;
}

export interface Experience {
  role: string;
  company: string;
  period: string;
  location?: string;
  summary: string;
  highlights: string[];
  tech: string[];
}

export interface Project {
  title: string;
  description: string;
  tech: string[];
  repo?: string;
  live?: string;
}

export interface SkillGroup {
  name: string;
  items: string[];
}

export const profile = {
  name: 'Your Name', // TODO
  initials: 'YN', // TODO
  role: 'Software Engineer',
  location: 'United Kingdom',
  /** Final public URL, no trailing slash — used for SEO tags. */
  siteUrl: 'https://arei1997.github.io',
  tagline:
    "I build dependable full-stack software — and when I'm not shipping code, I'm under a bonnet, behind a controller or at the piano.",
  email: 'hello@example.com', // TODO
  /** Put a PDF in /public (e.g. public/cv.pdf) and set this to '/cv.pdf'. Leave empty to hide the button. */
  cv: '',
  links: [
    { label: 'GitHub', href: 'https://github.com/Arei1997' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/your-profile' }, // TODO
  ] satisfies Link[],
  about: [
    "I'm a software engineer who enjoys taking products from a rough idea to something people rely on. Most of my recent work spans Python back ends, TypeScript front ends and the infrastructure that ties them together.",
    'I care about clear code, honest estimates and systems that are easy to change. I like understanding how things work all the way down — which probably explains my hobbies.',
  ],
  facts: [
    { label: 'Based in', value: 'United Kingdom' },
    { label: 'Focus', value: 'Full-stack & APIs' },
    { label: 'Currently', value: 'Open to new roles' },
    { label: 'Off the clock', value: 'Cars · Games · Music' },
  ],
  interests: {
    garage:
      'Mechanics and aerodynamics — from servicing my own car to reading about how wings, diffusers and ground effect generate downforce.',
    arcade:
      'Gaming, and the design behind it: tight controls, clever systems and the engineering that keeps a world running at 60 fps.',
    studio:
      'Piano and guitar. Learning music the slow way — scales, theory and the occasional piece that finally clicks.',
  } satisfies Record<ThemeId, string>,
  contactBlurb:
    "Whether it's a role, a project or a chat about cars, games or music — my inbox is open.",
};

// TODO: replace with your real roles, newest first.
export const experience: Experience[] = [
  {
    role: 'Software Engineer',
    company: 'Company name',
    period: '2024 — Present',
    location: 'Remote',
    summary: 'One sentence on the team, the product and what you owned.',
    highlights: [
      'An achievement with a measurable result — e.g. cut API response times by 40%.',
      'A feature or system you designed and shipped end to end.',
      'Something that shows collaboration or leadership.',
    ],
    tech: ['Python', 'FastAPI', 'PostgreSQL', 'TypeScript'],
  },
  {
    role: 'Junior Developer',
    company: 'Previous company',
    period: '2022 — 2024',
    location: 'London, UK',
    summary: 'One sentence on the team, the product and what you owned.',
    highlights: [
      'An achievement with a measurable result.',
      'A process or tool you improved for the team.',
    ],
    tech: ['JavaScript', 'React', 'Node.js', 'Docker'],
  },
];

export const projects: Project[] = [
  {
    title: 'Thesis Evaluator',
    description:
      'Full-stack app for writing theses and getting structured, LLM-powered evaluations. Versioned evaluator prompts, a PostgreSQL schema managed with Alembic, and Clerk authentication.',
    tech: ['Python', 'FastAPI', 'PostgreSQL', 'Alembic', 'Docker', 'Clerk'],
    repo: '', // TODO: add the repository URL if it's public
  },
  {
    title: 'Three-Mode Portfolio',
    description:
      'This site. One portfolio, three interactive themes: a particle wind tunnel with live drag maths, a pixel-art runner game, and a playable piano and guitar synthesised with the Web Audio API.',
    tech: ['TypeScript', 'Canvas', 'Web Audio', 'Vite'],
    repo: 'https://github.com/Arei1997/Arei1997.github.io',
  },
  {
    title: 'Project three',
    description:
      'TODO: what it does, who it is for, and the most interesting technical problem you solved building it.',
    tech: ['Tech', 'Stack', 'Here'],
  },
];

// TODO: adjust to your actual skill set.
export const skills: SkillGroup[] = [
  { name: 'Languages', items: ['Python', 'TypeScript', 'JavaScript', 'SQL'] },
  { name: 'Back end', items: ['FastAPI', 'PostgreSQL', 'SQLAlchemy', 'Alembic', 'REST APIs'] },
  { name: 'Front end', items: ['HTML & CSS', 'React', 'Vite', 'Canvas & Web Audio'] },
  { name: 'Tooling', items: ['Git', 'Docker', 'GitHub Actions', 'Linux'] },
];
