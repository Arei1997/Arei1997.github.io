import { education, experience, profile, projects, skills } from './content';
import { esc, pad } from './lib/dom';
import {
  SECTIONS,
  SECTION_TITLES,
  THEMES,
  THEME_IDS,
  type SectionId,
  type ThemeDef,
} from './themes';

const external = (href: string) =>
  /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';

const tags = (items: string[]) =>
  `<ul class="tags">${items.map((t) => `<li class="tag">${esc(t)}</li>`).join('')}</ul>`;

export function renderTopbar(el: HTMLElement) {
  const links = SECTIONS.map(
    (id) => `<a href="#${id}" data-nav="${id}">${SECTION_TITLES[id]}</a>`,
  ).join('');

  el.innerHTML = `
    <div class="container topbar-inner">
      <a class="brand" href="#top" aria-label="${esc(profile.name)}, back to top">
        <span class="brand-mark">${esc(profile.initials)}</span>
        <span class="brand-name">${esc(profile.name)}</span>
      </a>
      <nav class="nav" aria-label="Sections">${links}</nav>
      <div class="switcher" role="group" aria-label="Site theme">
        ${THEME_IDS.map(
          (id) => `
          <button type="button" data-switch-theme="${id}" aria-pressed="false" title="${THEMES[id].interest} theme">
            ${THEMES[id].icon}<span class="label">${THEMES[id].name}</span>
          </button>`,
        ).join('')}
      </div>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="mobile-nav" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>
    <nav id="mobile-nav" class="mobile-nav" aria-label="Sections" hidden>
      <div class="container">${links}</div>
    </nav>`;
}

export function renderHero(el: HTMLElement, theme: ThemeDef) {
  el.innerHTML = `
    <div class="container hero-grid">
      <div class="hero-copy">
        <div class="hero-modes" role="group" aria-label="Site theme">
          <span>View as</span>
          ${THEME_IDS.map(
            (id) => `
            <button type="button" class="mode-pill" data-switch-theme="${id}" aria-pressed="${id === theme.id}">
              ${THEMES[id].icon}${THEMES[id].interest}
            </button>`,
          ).join('')}
        </div>
        <p class="hero-kicker">${esc(theme.heroKicker)}</p>
        <h1 class="hero-name">${esc(profile.name)}</h1>
        <p class="hero-role">${esc(profile.role)} <span aria-hidden="true">·</span> ${esc(profile.location)}</p>
        <p class="hero-tagline">${esc(profile.tagline)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#projects">${esc(theme.ctaPrimary)}</a>
          <a class="btn btn-ghost" href="#contact">Get in touch</a>
        </div>
      </div>
      <figure class="hero-stage">
        <div class="stage" role="region" aria-label="${esc(theme.stageLabel)}"></div>
        <figcaption class="stage-hint">${esc(theme.stageHint)}</figcaption>
      </figure>
    </div>`;
}

export function renderSections(el: HTMLElement, theme: ThemeDef, revealed: boolean) {
  const reveal = revealed ? 'reveal in' : 'reveal';

  const head = (id: SectionId) => `
    <header class="section-head ${reveal}">
      <p class="kicker">${esc(theme.kicker(SECTIONS.indexOf(id), id))}</p>
      <h2 class="section-title">${SECTION_TITLES[id]}</h2>
    </header>`;

  const about = `
    <section id="about" class="section about">
      <div class="container">
        ${head('about')}
        <div class="about-grid">
          <div class="about-text ${reveal}">${profile.about.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
          <dl class="facts ${reveal}">
            ${profile.facts.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('')}
          </dl>
        </div>
        <h3 class="about-sub ${reveal}">Education</h3>
        <ul class="edu">
          ${education
            .map(
              (e) => `
            <li class="${reveal}">
              <span class="edu-period">${esc(e.period)}</span>
              <b>${esc(e.degree)}</b>
              <span class="edu-school">${esc(e.school)}</span>
              <span class="edu-modules">${esc(e.modules)}</span>
            </li>`,
            )
            .join('')}
        </ul>
        <h3 class="about-sub ${reveal}">Outside work</h3>
        <div class="interests">
          ${THEME_IDS.map((id) => {
            const t = THEMES[id];
            const here = id === theme.id;
            return `
            <button type="button" class="interest ${reveal}" data-switch-theme="${id}" aria-pressed="${here}">
              <span class="interest-icon">${t.icon}</span>
              <span class="interest-name">${t.interest}</span>
              <span class="interest-text">${esc(profile.interests[id])}</span>
              <span class="interest-cta">${here ? 'You are here' : `Switch to ${t.name} mode →`}</span>
            </button>`;
          }).join('')}
        </div>
      </div>
    </section>`;

  const jobs = `
    <section id="experience" class="section">
      <div class="container">
        ${head('experience')}
        <ol class="timeline">
          ${experience
            .map(
              (job, i) => `
            <li class="job ${reveal}">
              <div class="job-meta">
                <span class="job-label">${esc(theme.jobLabel(i, experience.length))}</span>
                <span class="job-period">${esc(job.period)}</span>
                ${job.location ? `<span class="job-loc">${esc(job.location)}</span>` : ''}
              </div>
              <div class="job-body">
                <h3>${esc(job.role)}</h3>
                <p class="job-company">${esc(job.company)}</p>
                <p>${esc(job.summary)}</p>
                <ul class="job-highlights">${job.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
                ${tags(job.tech)}
              </div>
            </li>`,
            )
            .join('')}
        </ol>
      </div>
    </section>`;

  const work = `
    <section id="projects" class="section">
      <div class="container">
        ${head('projects')}
        <div class="projects">
          ${projects
            .map(
              (p, i) => `
            <article class="project ${reveal}" style="--h:${(i * 67 + 205) % 360}">
              <div class="project-art" aria-hidden="true">
                <span class="art-label">${esc(theme.projectLabel(i))}</span>
                <span class="art-num">${pad(i + 1)}</span>
              </div>
              <div class="project-body">
                <h3>${esc(p.title)}</h3>
                <p>${esc(p.description)}</p>
                ${tags(p.tech)}
                <div class="project-links">
                  ${p.repo ? `<a href="${esc(p.repo)}"${external(p.repo)}>Source ↗</a>` : ''}
                  ${p.live ? `<a href="${esc(p.live)}"${external(p.live)}>Live site ↗</a>` : ''}
                </div>
              </div>
            </article>`,
            )
            .join('')}
        </div>
      </div>
    </section>`;

  const skillGrid = `
    <section id="skills" class="section">
      <div class="container">
        ${head('skills')}
        <div class="skills">
          ${skills
            .map(
              (g) => `
            <div class="skill-group ${reveal}">
              <h3>${esc(g.name)}</h3>
              <ul class="chips">${g.items.map((s) => `<li class="chip">${esc(s)}</li>`).join('')}</ul>
            </div>`,
            )
            .join('')}
        </div>
      </div>
    </section>`;

  const contact = `
    <section id="contact" class="section contact">
      <div class="container">
        ${head('contact')}
        <p class="contact-title ${reveal}">${esc(theme.contactTitle)}</p>
        <p class="contact-text ${reveal}">${esc(profile.contactBlurb)}</p>
        <div class="contact-links ${reveal}">
          <a class="btn btn-primary" href="mailto:${esc(profile.email)}">Email me</a>
          ${profile.links.map((l) => `<a class="btn btn-ghost" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`).join('')}
          ${profile.cv ? `<a class="btn btn-ghost" href="${esc(profile.cv)}" download>Download CV</a>` : ''}
        </div>
      </div>
    </section>`;

  el.innerHTML = about + jobs + work + skillGrid + contact;
}

export function renderFooter(el: HTMLElement) {
  el.innerHTML = `
    <div class="container footer-inner">
      <span>© ${new Date().getFullYear()} ${esc(profile.name)}</span>
      <span>Built with TypeScript, Canvas and the Web Audio API.</span>
    </div>`;
}
