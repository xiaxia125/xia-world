import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  PROFILE,
  getEmailAddress,
  getEmailDisplay,
  getEmailHref,
  type ProfileTab,
} from "../../profile";
import { ui, type UISnapshot } from "../../ui";
import "./profile-panel.css";

const TABS: Array<{ id: ProfileTab; label: string; index: string }> = [
  { id: "overview", label: "概览", index: "01" },
  { id: "projects", label: "项目", index: "02" },
  { id: "experience", label: "经历", index: "03" },
  { id: "skills", label: "技能", index: "04" },
  { id: "contact", label: "联系", index: "05" },
];

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function EmailActions({ compact = false }: { compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      await copyText(getEmailAddress());
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`profile-email${compact ? " is-compact" : ""}`}>
      <span className="profile-email-label">公开联系邮箱</span>
      <button
        className="profile-email-address"
        type="button"
        onClick={handleCopy}
        title="点击复制邮箱"
      >
        {getEmailDisplay()}
      </button>
      <div className="profile-email-actions">
        <button className="profile-action profile-action--quiet" type="button" onClick={handleCopy}>
          复制邮箱
        </button>
        <a className="profile-action" href={getEmailHref()}>
          写邮件 <span aria-hidden="true">↗</span>
        </a>
      </div>
      <span className="profile-email-status" role="status" aria-live="polite">
        {copied ? "已复制到剪贴板" : "点击邮箱或按钮复制"}
      </span>
    </div>
  );
}

function Overview() {
  return (
    <div className="profile-view profile-view--overview">
      <header className="profile-heading">
        <p className="profile-kicker">01 / OVERVIEW</p>
        <h2>{PROFILE.tagline}</h2>
        <p className="profile-lede">{PROFILE.intro}</p>
      </header>

      <div className="profile-two-col">
        <section className="profile-card">
          <p className="profile-card-kicker">WHAT I BRING</p>
          <h3>把复杂场景落到可用的界面上</h3>
          <ul className="profile-list">
            {PROFILE.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section className="profile-card">
          <p className="profile-card-kicker">FOCUS</p>
          <h3>当前方向</h3>
          <div className="profile-tags profile-tags--large">
            {PROFILE.focus.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <p className="profile-card-note">
            熟悉 Vue / React / TypeScript，也持续在真实项目里实践地图、三维和跨端体验。
          </p>
          <div className="profile-inline-actions">
            <button className="profile-action" type="button" onClick={() => ui.selectProfileTab("projects")}>
              查看项目 <span aria-hidden="true">→</span>
            </button>
            <button
              className="profile-action profile-action--quiet"
              type="button"
              onClick={() => ui.selectProfileTab("contact")}
            >
              联系我
            </button>
          </div>
        </section>
      </div>

      <section className="profile-card profile-overview-bottom">
        <div>
          <p className="profile-card-kicker">CURRENTLY</p>
          <h3>{PROFILE.status} · {PROFILE.target}</h3>
          <p>如果你正在寻找一位能把复杂业务、可视化与跨端体验接起来的前端，欢迎聊聊。</p>
        </div>
        <button className="profile-action" type="button" onClick={() => ui.selectProfileTab("contact")}>
          获取联系方式 <span aria-hidden="true">→</span>
        </button>
      </section>
    </div>
  );
}

function Projects() {
  return (
    <div className="profile-view">
      <header className="profile-heading">
        <p className="profile-kicker">02 / SELECTED WORK</p>
        <h2>做过的项目，和我在其中解决的问题。</h2>
        <p className="profile-lede">
          选取了四个最具代表性的方向：可视化驾驶舱、三维地图、跨端小程序和知识图谱。
        </p>
      </header>

      <div className="profile-project-grid">
        {PROFILE.projects.map((project) => (
          <article className="profile-project-card" key={project.slug}>
            <div className="profile-project-top">
              <span className="profile-project-index">{project.index}</span>
              <span className="profile-project-category">{project.category}</span>
            </div>
            <h3>{project.title}</h3>
            <p className="profile-project-summary">{project.summary}</p>
            <ul className="profile-list profile-list--compact">
              {project.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="profile-tags" aria-label={`${project.title}技术栈`}>
              {project.stack.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <section className="profile-card profile-archive">
        <p className="profile-card-kicker">ALSO IN THE ARCHIVE</p>
        <h3>更多项目</h3>
        <div className="profile-archive-list">
          {PROFILE.moreProjects.map((project) => (
            <div className="profile-archive-item" key={project.title}>
              <h4>{project.title}</h4>
              <p>{project.detail}</p>
              <span>{project.stack}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Experience() {
  return (
    <div className="profile-view">
      <header className="profile-heading">
        <p className="profile-kicker">03 / EXPERIENCE</p>
        <h2>在真实业务里，把界面和流程做完整。</h2>
        <p className="profile-lede">
          从业务页面到复杂可视化驾驶舱，工作重心一直是：让信息更容易被理解，让操作更顺畅。
        </p>
      </header>

      <div className="profile-timeline">
        {PROFILE.experience.map((item) => (
          <article className="profile-timeline-item" key={`${item.company}-${item.period}`}>
            <div className="profile-timeline-period">{item.period}</div>
            <div className="profile-timeline-body">
              <p className="profile-card-kicker">{item.role}</p>
              <h3>{item.company}</h3>
              <p className="profile-timeline-summary">{item.summary}</p>
              <ul className="profile-list profile-list--compact">
                {item.highlights.map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <section className="profile-card">
        <p className="profile-card-kicker">EDUCATION</p>
        <h3>教育背景</h3>
        <div className="profile-education-list">
          {PROFILE.education.map((item) => (
            <div className="profile-education-item" key={`${item.school}-${item.degree}`}>
              <div>
                <strong>{item.school}</strong>
                <span>{item.major} · {item.degree}</span>
              </div>
              <time>{item.period}</time>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Skills() {
  return (
    <div className="profile-view">
      <header className="profile-heading">
        <p className="profile-kicker">04 / TOOLKIT</p>
        <h2>技术栈不是列表，是解决问题的工具箱。</h2>
        <p className="profile-lede">
          以 JavaScript / TypeScript 为基础，围绕 Vue、React、可视化地图与跨端场景展开。
        </p>
      </header>

      <div className="profile-skill-grid">
        {PROFILE.skillGroups.map((group) => (
          <section className="profile-skill-card" key={group.title}>
            <h3>{group.title}</h3>
            <div className="profile-tags">
              {group.items.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="profile-two-col">
        <section className="profile-card">
          <p className="profile-card-kicker">AI ASSISTED DEVELOPMENT</p>
          <h3>把 AI 当作协作工具</h3>
          <p>用于代码生成、重构、Debug 与方案探索，最终判断仍然落在工程实践上。</p>
          <div className="profile-tags">
            {PROFILE.aiTools.map((tool) => (
              <span key={tool}>{tool}</span>
            ))}
          </div>
        </section>
        <section className="profile-card">
          <p className="profile-card-kicker">WORKING PRINCIPLES</p>
          <h3>工作方式</h3>
          <ol className="profile-principles">
            {PROFILE.principles.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Contact() {
  return (
    <div className="profile-view">
      <header className="profile-heading">
        <p className="profile-kicker">05 / CONTACT</p>
        <h2>如果有一个需要把复杂信息做清楚的岗位，欢迎聊聊。</h2>
        <p className="profile-lede">
          目前求职方向为前端开发工程师，关注复杂业务、数据可视化、地图与跨端体验。
        </p>
      </header>

      <section className="profile-contact-card">
        <p className="profile-card-kicker">OPEN TO WORK / 2026</p>
        <h3>{PROFILE.name} · {PROFILE.role}</h3>
        <p>5 年前端开发经验 · 可沟通具体岗位与团队方向</p>
        <EmailActions />
        <div className="profile-contact-meta">
          <div>
            <span>求职方向</span>
            <strong>{PROFILE.target}</strong>
          </div>
          <div>
            <span>经验</span>
            <strong>{PROFILE.years}</strong>
          </div>
          <div>
            <span>关注领域</span>
            <strong>可视化 / 地图 / 跨端</strong>
          </div>
        </div>
      </section>

      <p className="profile-privacy-note">{PROFILE.contact.note}</p>
    </div>
  );
}

const VIEWS: Record<ProfileTab, ComponentType> = {
  overview: Overview,
  projects: Projects,
  experience: Experience,
  skills: Skills,
  contact: Contact,
};

/** Full-screen public profile opened from the HUD, start screen or an in-world kiosk. */
export function ProfilePanel({ snapshot }: { snapshot: UISnapshot }) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const lastTabRef = useRef<ProfileTab>(snapshot.profileTab);

  useEffect(() => {
    if (!snapshot.profileOpen) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        ui.closeProfile();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus.current?.focus();
    };
  }, [snapshot.profileOpen]);

  useEffect(() => {
    if (!snapshot.profileOpen) {
      lastTabRef.current = snapshot.profileTab;
      return;
    }

    const tabChanged = lastTabRef.current !== snapshot.profileTab;
    lastTabRef.current = snapshot.profileTab;

    if (window.matchMedia("(max-width: 820px)").matches) {
      if (!tabChanged) {
        panelRef.current?.scrollTo({ top: 0 });
        return;
      }
      panelRef.current?.querySelector<HTMLElement>(".profile-main")?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
      return;
    }

    scrollRef.current?.scrollTo({ top: 0 });
  }, [snapshot.profileOpen, snapshot.profileTab]);

  const View = VIEWS[snapshot.profileTab];

  return (
    <section
      id="profile"
      ref={panelRef}
      className={`profile-panel${snapshot.profileOpen ? " is-open" : " is-hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      aria-hidden={!snapshot.profileOpen}
    >
      <div className="profile-shell">
        <header className="profile-topbar">
          <div className="profile-topbar-title">
            <span className="profile-live-dot" aria-hidden="true" />
            <span>XIA / PUBLIC PROFILE</span>
            <span className="profile-topbar-version">2026 · FRONTEND</span>
          </div>
          <button ref={closeRef} className="profile-close" type="button" onClick={() => ui.closeProfile()}>
            <span>返回世界</span>
            <kbd>ESC</kbd>
          </button>
        </header>

        <div className="profile-layout">
          <aside className="profile-aside">
            <div className="profile-identity">
              <div className="profile-monogram" aria-hidden="true">
                <span>X</span>
                <span>ZW</span>
              </div>
              <p className="profile-identity-kicker">FRONTEND ENGINEER</p>
              <h1 id="profile-title">{PROFILE.name}</h1>
              <p className="profile-identity-role">{PROFILE.role} · {PROFILE.years}</p>
              <p className="profile-status">
                <i aria-hidden="true" />
                {PROFILE.status} · Open to work
              </p>
              <p className="profile-identity-note">{PROFILE.shortIntro}</p>
            </div>

            <nav className="profile-nav" aria-label="职业档案章节">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  className={snapshot.profileTab === tab.id ? "is-active" : ""}
                  type="button"
                  aria-current={snapshot.profileTab === tab.id ? "page" : undefined}
                  onClick={() => ui.selectProfileTab(tab.id)}
                >
                  <span>{tab.index}</span>
                  {tab.label}
                  <span className="profile-nav-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </nav>

            <div className="profile-aside-footer">
              <button className="profile-aside-contact" type="button" onClick={() => ui.selectProfileTab("contact")}>
                邮箱联系 <span aria-hidden="true">↗</span>
              </button>
              <span>公开版档案 / 无手机号</span>
            </div>
          </aside>

          <div className="profile-main" ref={scrollRef}>
            <div className="profile-main-inner">
              <View />
              <footer className="profile-foot">
                <span>XIA HOME / PUBLIC PROFILE</span>
                <button type="button" onClick={() => ui.closeProfile()}>
                  回到 3D 世界 <span aria-hidden="true">→</span>
                </button>
              </footer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
