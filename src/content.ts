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
    "Software engineer working on various critical HMRC systems. I studied aerospace engineering with a master's in computer science at UCL, I build AI projects in my spare time, and outside work it's mostly cars, games and music!",
  email: 'Arei1997@hotmail.co.uk',
  /** Put a PDF in /public (e.g. public/cv.pdf) and set this to '/cv.pdf'. Leave empty to hide the button. */
  cv: '/cv.pdf',
  links: [
    { label: 'GitHub', href: 'https://github.com/Arei1997' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/in/arei1/' },
  ] satisfies Link[],
  about: [
    "Working on HMRC critical national infrastructure such as NCTS and Platform Automation. I write Java and Scala APIs with the Play Framework, and I also look after the automation robots that process a lot of HMRC's data cases. I like writing tests first, and I don't mind explaining technical things to people who don't code.",
    "I did a BEng in Aerospace Engineering before moving into software with an MSc in Computer Science at UCL. I've also trained a reinforcement learning agent to reduce drag in a CFD simulation, which is about as close as those two degrees get. In my spare time I study AI theory, build AI apps, and teach Java to junior developers.",
  ],
  facts: [
    { label: 'Based in', value: 'Manchester, UK' },
    { label: 'Current Position', value: 'Software engineer @ Mercator Digital/HMRC' },
    { label: 'Focus', value: 'Software Engineering · Architecture · AI/ML' },
    { label: 'Hobbies', value: 'Cars · Games · Music' },
  ],
  interests: {
    garage:
      "Cars and how they work. After an aerospace degree I can't look at a plane or a car without thinking about the floor and the wings, which is why there's a wind tunnel on this site.",
    arcade:
      "Games, and how they're made. I notice the controls and the design about as much as the game itself.",
    studio: "Piano and guitar. I learnt a lot about 'learning', so I built an app to help anyone learn the piano.",
  } satisfies Record<ThemeId, string>,
  contactBlurb: "Feel free to contact me!",
};

export const experience: Experience[] = [
  {
    role: 'Automation Engineer / RPA Developer',
    company: 'HMRC',
    period: 'Feb 2026 – Present',
    location: 'London, UK',
    summary:
      'I build and maintain the automation robots that handle high-volume work in Self Assessment, Fraud and Pensions. Using SQL and real time automation to improve the HMRC data collections',
    highlights: [
      "Cut the failure rate of HMRC's most important automation machine from 16% to 4%.",
      'Look after more than 75 production robots: spotting failures, fixing them and keeping them running.',
      'Manage and write the SQL databases and scripts behind the automation platform.',
      'Build reports in IBM Cognos so senior stakeholders can see how the robots are performing.',
    ],
    tech: ['NiCE Automation Studio', 'SQL', 'IBM Cognos', 'RPA'],
  },
  {
    role: 'Software Engineer',
    company: 'Mercator Digital',
    period: 'Jul 2024 – Present',
    location: 'London, UK',
    summary:
      "I'm in the HMRC NCTS team, building the Scala APIs that validate, convert and route goods moving under the Common Transit Convention.",
    highlights: [
      'Led parts of the Scala 3 migration across several HMRC microservices without breaking existing clients.',
      'Migratating versions for the whole API infrastrcutre resulting in refactoring of a whole code base led by me',
      "Wrote a Python tool that turns the specifications into pages on HMRC's live developer portal. Parsing thousands of condiional statements for external developrs to read.",
      'Worked on the Pension Scheme Return and CDS Reimbursement Claim front ends: accessibility fixes, Welsh translations and new user journeys.',
    ],
    tech: ['Scala', 'Play Framework', 'Python', 'Java', 'Microservices', 'TDD'],
  },
  {
    role: 'Software Engineering Intern',
    company: 'IBM',
    period: 'Jul 2023 – Sep 2023',
    location: 'London, UK',
    summary:
      'In collaboration with my thesis, I built a grocery app that people with dysarthric speech could use with their voice.',
    highlights: [
      'Added IBM Watson speech recognition to a React app so it could be used entirely by voice.',
      'Trained and deployed the Watson actions on IBM Cloud.',
      'Built the app and its product API from scratch, and presented progress to senior stakeholders.',
    ],
    tech: ['React', 'IBM Watson', 'IBM Cloud', 'Node.js', 'Machine Learning'],
  },
  {
    role: 'Software Engineering Intern',
    company: 'City, University of London',
    period: 'Jun 2021 – Sep 2021',
    location: 'London, UK',
    summary: 'I built analysis tools for turbojet and energy research, working with professors and PhD students.',
    highlights: [
      'Wrote a Python tool for analysing the Brayton cycle, which made the cycle efficiency modelling more accurate.',
      'Built a tool that maps energy use across densely populated countries from Excel and JSON data, saving around 40 hours of research time.',
    ],
    tech: ['Python', 'Thermodynamics', 'Data visualisation'],
  },
];

export const education: Education[] = [
  {
    school: 'UCL, University College London',
    degree: 'MSc Computer Science',
    period: '2022 – 2023',
    modules: 'Databases · Functional Programming · Algorithms · Computer Architecture · Software Engineering',
  },
  {
    school: 'City, University of London',
    degree: 'BEng Aerospace Engineering',
    period: '2019 – 2022',
    modules: 'Aerodynamics · Structural Mechanics · Control Systems · Machine Learning · Mathematics',
  },
];

export const projects: Project[] = [
  {
    title: 'Trading Thesis AI',
    description:
      "You write down a trading thesis and the app watches the news for anything that affects it. Each relevant story goes to Claude, which sends back a structured verdict: direction, confidence, suggested action and risks. News comes in from Polygon, Finnhub and RSS, Redis filters out duplicates, a BullMQ queue runs the evaluations, and you get an email when confidence passes your threshold.",
    tech: ['TypeScript', 'Next.js', 'Node.js', 'PostgreSQL', 'Redis', 'Claude API'],
    repo: 'https://github.com/Arei1997/trading-thesis-ai',
  },
  {
    title: 'Deep RL for Active Flow Control',
    description:
      "A PPO agent that moves two hinged flaps on a cylinder inside a Navier-Stokes CFD solver, trying to reduce drag. I extended the solver from one flap to two, built the RL environment and the actor-critic networks, and trained it for 10,000 episodes. In laminar flow it got within 0.003 of the best fixed flap angle. In turbulent flow it didn't converge.",
    tech: ['MATLAB', 'PPO', 'Actor-critic', 'Navier–Stokes CFD'],
    repo: 'https://github.com/Arei1997/Active-Flow-control-Navier-Stokes/tree/python-port',
  },
  {
    title: 'Piano Teacher',
    description:
      "An app for learning piano songs one key at a time. It shows the sheet music and lights up the keys to press. It can arrange a song for you or read a photo of sheet music, works with a MIDI keyboard, and has a falling-notes game mode and an AI teacher you can ask about the bar you're on.",
    tech: ['React', 'TypeScript', 'FastAPI', 'music21', 'Web MIDI', 'Tone.js'],
    repo: 'https://github.com/Arei1997/piano-teacher',
  },
  {
    title: 'Watson Speech Assistant',
    description:
      'The voice-controlled grocery app from my IBM internship, built so people with dysarthric speech could shop using their voice.',
    tech: ['React', 'IBM Watson', 'IBM Cloud'],
    repo: 'https://github.com/Arei1997/IBM-Watson-speech-chatbot',
  },
  {
    title: 'My Website',
    description:
      "This site. It has a theme for each of my hobbies: a wind tunnel with real drag maths, a pixel-art runner game through Earth's history, and a small music studio. All the sound is generated in the browser.",
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
