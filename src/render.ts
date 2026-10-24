import { education, experience, profile, projects, skills } from './content';
import { esc } from './lib/dom';
import { SECTIONS, SECTION_TITLES, THEMES, THEME_IDS, type SectionId, type ThemeDef } from './themes';

const external = (href: string) =>
  /^https?:/.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';

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
        <h1 class="hero-name">${esc(profile.name)}</h1>
        <p class="hero-role">${esc(profile.role)}, ${esc(profile.location)}</p>
        <p class="hero-tagline">${esc(profile.tagline)}</p>
        <div class="hero-cta">
          <a class="btn btn-primary" href="#projects">See projects</a>
          <a class="btn btn-ghost" href="#contact">Get in touch</a>
        </div>
      </div>
      <figure class="hero-stage">
        <div class="stage" role="region" aria-label="${esc(theme.stageLabel)}"></div>
        <figcaption class="stage-hint">${esc(theme.stageHint)}</figcaption>
      </figure>
    </div>`;
}

export function renderSections(el: HTMLElement, revealed: boolean) {
  const reveal = revealed ? 'reveal in' : 'reveal';

  const section = (id: SectionId, body: string) => `
    <section id="${id}" class="section">
      <div class="container section-grid">
        <h2 class="section-title ${reveal}">${SECTION_TITLES[id]}</h2>
        <div class="section-body ${reveal}">${body}</div>
      </div>
    </section>`;

  const rows = (items: { label: string; value: string }[]) =>
    `<dl class="rows">${items.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('')}</dl>`;

  const about = section(
    'about',
    `
    <div class="prose">${profile.about.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
    ${rows(profile.facts)}
    <h3 class="sub">Education</h3>
    <ul class="edu">
      ${education
        .map(
          (e) => `
        <li>
          <p class="entry-head"><span><b>${esc(e.degree)}</b>, ${esc(e.school)}</span> <span class="period">${esc(e.period)}</span></p>
          <p class="muted">${esc(e.modules)}</p>
        </li>`,
        )
        .join('')}
    </ul>
    <h3 class="sub">Outside work</h3>
    ${rows(THEME_IDS.map((id) => ({ label: THEMES[id].interest, value: profile.interests[id] })))}`,
  );

  const jobs = section(
    'experience',
    `
    <ol class="timeline">
      ${experience
        .map(
          (job) => `
        <li class="job">
          <p class="entry-head"><b>${esc(job.role)}</b> <span class="period">${esc(job.period)}</span></p>
          <p class="job-company">${esc(job.company)}${job.location ? `, ${esc(job.location)}` : ''}</p>
          <p>${esc(job.summary)}</p>
          <ul class="job-highlights">${job.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
        </li>`,
        )
        .join('')}
    </ol>`,
  );

  const work = section(
    'projects',
    `
    <ul class="projects">
      ${projects
        .map(
          (p) => `
        <li class="project">
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.description)}</p>
          <p class="muted">${esc(p.tech.join(', '))}</p>
          <p class="project-links">
            ${p.repo ? `<a href="${esc(p.repo)}"${external(p.repo)}>Source ↗</a>` : ''}
            ${p.live ? `<a href="${esc(p.live)}"${external(p.live)}>Live site ↗</a>` : ''}
          </p>
        </li>`,
        )
        .join('')}
    </ul>`,
  );

  const skillList = section('skills', rows(skills.map((g) => ({ label: g.name, value: g.items.join(', ') }))));

  const contact = section(
    'contact',
    `
    <p class="contact-text">${esc(profile.contactBlurb)}</p>
    <div class="contact-links">
      <a class="btn btn-primary" href="mailto:${esc(profile.email)}">Email me</a>
      ${profile.links.map((l) => `<a class="btn btn-ghost" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`).join('')}
      ${profile.cv ? `<a class="btn btn-ghost" href="${esc(profile.cv)}" download>Download CV</a>` : ''}
    </div>`,
  );

  el.innerHTML = about + jobs + work + skillList + contact;
}

export function renderFooter(el: HTMLElement) {
  el.innerHTML = `
    <div class="container footer-inner">
      <span>© ${new Date().getFullYear()} ${esc(profile.name)}</span>
      <span>Built with TypeScript, Canvas and the Web Audio API.</span>
    </div>`;
}
