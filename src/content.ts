/**
 * All of the site's copy lives in this file — edit it to update the portfolio.
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

export interface Education {
  school: string;
  degree: string;
  period: string;
  modules: string;
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
  name: 'Arei Mohammed',
  initials: 'AM',
  role: 'Software Engineer · AI Systems',
  location: 'Manchester, UK',
  /** Final public URL, no trailing slash — used for SEO tags. */
  siteUrl: 'https://arei1997.github.io',
  tagline:
    'I build government digital services at national scale for HMRC, and AI systems on the Claude API in my own time. Aerospace engineer by training — and off the clock, usually under a bonnet, behind a controller or at the piano.',
  email: 'Arei1997@hotmail.co.uk',
  /** Put a PDF in /public (e.g. public/cv.pdf) and set this to '/cv.pdf'. Leave empty to hide the button. */
  cv: '',
  links: [
    { label: 'GitHub', href: 'https://github.com/Arei1997' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/arei1/' },
  ] satisfies Link[],
  about: [
    "I'm a software engineer working on HMRC's New Computerised Transit System — critical national infrastructure APIs written in Scala and the Play Framework — and on the automation estate that processes tax cases at national scale. I work test-first, support production systems directly, and enjoy explaining technical work to people who aren't engineers.",
    "My route in was engineering: a BEng in Aerospace Engineering, then an MSc in Computer Science at UCL, where I trained a reinforcement-learning agent to cut drag on a cylinder inside a Navier–Stokes CFD solver. These days I build AI applications with the Anthropic Claude API, Redis and PostgreSQL, and I design and teach a TDD curriculum for junior developers.",
  ],
  facts: [
    { label: 'Based in', value: 'Manchester, UK' },
    { label: 'Currently', value: 'Mercator Digital · HMRC' },
    { label: 'Focus', value: 'Scala APIs · AI systems' },
    { label: 'Off the clock', value: 'Cars · Games · Music' },
  ],
  interests: {
    garage:
      'Mechanics and aerodynamics. An aerospace degree left me permanently curious about how wings, floors and diffusers turn airflow into downforce — hence the wind tunnel.',
    arcade:
      'Gaming, and the design behind it: tight controls, clever systems and the engineering that keeps a world running at 60 fps.',
    studio:
      "Piano and guitar. I'm learning the slow way — and building my own AI piano teacher to help.",
  } satisfies Record<ThemeId, string>,
  contactBlurb:
    "Whether it's a role, a project or a chat about cars, games or music — my inbox is open.",
};

export const experience: Experience[] = [
  {
    role: 'Automation Engineer / RPA Developer',
    company: 'HMRC',
    period: 'Feb 2026 — Present',
    location: 'London, UK',
    summary:
      'Building and running the automation robots behind high-volume tax administration — Self Assessment, Fraud and Pensions — in NiCE Automation Studio.',
    highlights: [
      'Cut the technical failure rate of HMRC’s most important automation machine from 16% to 9%.',
      'Monitor, triage and fix 75+ production robots processing taxpayer data at national scale.',
      'Administer and tune the SQL databases underpinning the automation estate.',
      'Report robot performance, throughput and failure trends to senior stakeholders with IBM Cognos.',
    ],
    tech: ['NiCE Automation Studio', 'SQL', 'IBM Cognos', 'RPA'],
  },
  {
    role: 'Software Engineer',
    company: 'Mercator Digital',
    period: 'Jul 2024 — Present',
    location: 'London, UK',
    summary:
      'Developing critical national infrastructure APIs for HMRC’s New Computerised Transit System (NCTS): Common Transit Convention services, transit movement validation, conversion and routing.',
    highlights: [
      'Led and contributed to the Scala 3 migration of multiple HMRC microservices while keeping them backward compatible.',
      'Owned the deprecation of API v2.0 across transit-movements-auditing, removing 6,000+ lines of legacy code.',
      'Built a Python documentation pipeline for the NCTS Phase 6 specification — including a dangling-else resolution algorithm with lookahead — that now powers the live HMRC developer portal.',
      'Delivered accessibility fixes, Welsh localisation and new user journeys on the Pension Scheme Return and CDS Reimbursement Claim front ends.',
      'Mentor new engineers, and designed and teach a Java curriculum covering TDD, Spring Boot and HMRC service standards.',
    ],
    tech: ['Scala', 'Play Framework', 'Python', 'Java', 'Microservices', 'TDD'],
  },
  {
    role: 'Software Engineer — Internship',
    company: 'IBM',
    period: 'Jul 2023 — Sep 2023',
    location: 'London, UK',
    summary:
      'Industry exchange programme: voice control for people with dysarthric speech patterns.',
    highlights: [
      'Implemented IBM Watson speech recognition in a React grocery app, so it could be used entirely by voice.',
      'Trained and deployed Watson actions on IBM Cloud.',
      'Built the React app and its product-availability API from scratch, presenting progress to senior stakeholders.',
    ],
    tech: ['React', 'IBM Watson', 'IBM Cloud', 'Node.js'],
  },
  {
    role: 'Software Engineer — Internship',
    company: 'City, University of London',
    period: 'Jun 2021 — Sep 2021',
    location: 'London, UK',
    summary: 'Research tooling for turbojet and energy research, alongside engineering professors and PhD students.',
    highlights: [
      'Built a Python thermodynamic Brayton-cycle analysis tool that improved cycle-efficiency modelling.',
      'Created a geographic visualisation tool for energy consumption data, saving an estimated 40 hours of research time.',
    ],
    tech: ['Python', 'Thermodynamics', 'Data visualisation'],
  },
];

export const education: Education[] = [
  {
    school: 'UCL, University College London',
    degree: 'MSc Computer Science',
    period: '2022 — 2023',
    modules: 'Databases · Functional Programming · Algorithms · Computer Architecture · Software Engineering',
  },
  {
    school: 'City, University of London',
    degree: 'BEng Aerospace Engineering',
    period: '2019 — 2022',
    modules: 'Aerodynamics · Structural Mechanics · Control Systems · Machine Learning · Mathematics',
  },
];

export const projects: Project[] = [
  {
    title: 'Trading Thesis AI',
    description:
      'Monitors financial news continuously and evaluates each event against user-defined trading theses, returning structured impact assessments via the Claude API with guaranteed-parseable tool-use output. Multi-source ingestion with Redis deduplication, a BullMQ job queue with backoff retries, threshold email alerts and multi-tenant Clerk auth.',
    tech: ['TypeScript', 'Next.js', 'Node.js', 'PostgreSQL', 'Redis', 'Claude API'],
    repo: 'https://github.com/Arei1997/trading-thesis-ai',
  },
  {
    title: 'Deep RL for Active Flow Control',
    description:
      'A PPO agent coupled to a Navier–Stokes CFD solver, actuating hinged flaps on a 2D cylinder to minimise drag. Extended the solver to two flaps, built the RL environment and actor-critic networks, and trained over 10,000 episodes — converging to within 0.003 of the best fixed-angle drag coefficient in laminar flow.',
    tech: ['MATLAB', 'PPO', 'Actor-critic', 'Navier–Stokes CFD'],
    repo: 'https://github.com/Arei1997/Active-Flow-control-Navier-Stokes',
  },
  {
    title: 'Piano Teacher',
    description:
      'Learn songs key by key: sheet music, an 88-key guide piano and an AI teacher that knows which bar you’re on. AI arrangements and sheet-music transcription from photos, MIDI keyboard input, a falling-notes game mode with grading, and a muscle-memory trainer.',
    tech: ['React', 'TypeScript', 'FastAPI', 'music21', 'Web MIDI', 'Tone.js'],
    repo: 'https://github.com/Arei1997/piano-teacher',
  },
  {
    title: 'Watson Speech Assistant',
    description:
      'Voice-controlled React grocery app built at IBM, using Watson speech recognition to make shopping accessible for people with dysarthric speech patterns.',
    tech: ['React', 'IBM Watson', 'IBM Cloud'],
    repo: 'https://github.com/Arei1997/IBM-Watson-speech-chatbot',
  },
  {
    title: 'Three-Mode Portfolio',
    description:
      'This site. One portfolio, three interactive themes: a particle wind tunnel with live drag and Reynolds-number physics, a pixel-art runner through Earth’s history, and an FL Studio-style music studio — all synthesised in the browser with no samples.',
    tech: ['TypeScript', 'Canvas', 'Web Audio', 'Vite'],
    repo: 'https://github.com/Arei1997/Arei1997.github.io',
  },
];

export const skills: SkillGroup[] = [
  { name: 'Languages', items: ['Scala', 'Python', 'TypeScript', 'Java', 'JavaScript', 'SQL', 'C', 'MATLAB'] },
  { name: 'Back end', items: ['Play Framework', 'Spring Boot', 'Node.js', 'Microservices', 'REST APIs'] },
  { name: 'Front end', items: ['React', 'Next.js', 'Accessibility', 'Welsh localisation'] },
  { name: 'AI & ML', items: ['Claude API', 'LLM tool use', 'RAG', 'Prompt engineering', 'Langfuse evals', 'Reinforcement learning (PPO)', 'SageMaker'] },
  { name: 'Data & infrastructure', items: ['PostgreSQL', 'Redis', 'Docker', 'GitHub Actions', 'Jenkins', 'IBM Cloud'] },
  { name: 'Ways of working', items: ['TDD', 'JUnit 5', 'Agile / Scrum', 'RPA (NiCE)', 'Mentoring', 'Curriculum design'] },
];
