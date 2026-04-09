import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { RULES_NAV } from '../data/rulesNav';
import '../styles/Rules.css';

function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/^-+|-+$/g, '');
}

function getTextFromChildren(children) {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(getTextFromChildren).join('');
  if (children?.props?.children) return getTextFromChildren(children.props.children);
  return '';
}

/** Hash section (null = overview) → static file slug under public/srd/. */
function sectionToFetchSlug(section) {
  if (section == null || section === '') return 'game-rules-srd';
  return section;
}

export default function RulesPage({ onBack, initialSection, onNavigateSection }) {
  const fetchSlug = sectionToFetchSlug(initialSection);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(
    RULES_NAV.reduce((acc, cat) => ({ ...acc, [cat.label]: cat.expanded ?? true }), {})
  );
  const mainRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const base = process.env.PUBLIC_URL || '';
    const url = `${base}/srd/${fetchSlug}.md`;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Failed to load section'))))
      .then((text) => {
        if (!cancelled) setMarkdown(text);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchSlug]);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [fetchSlug]);

  const selectNavItem = useCallback(
    (slug) => {
      if (onNavigateSection) {
        onNavigateSection(slug);
      } else if (slug == null) {
        window.location.hash = 'rules';
      } else {
        window.location.hash = `rules-${slug}`;
      }
    },
    [onNavigateSection]
  );

  const isItemActive = useCallback(
    (itemSlug) => {
      const itemFetch = sectionToFetchSlug(itemSlug);
      return itemFetch === fetchSlug;
    },
    [fetchSlug]
  );

  const toggleCategory = (label) => {
    setExpandedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const components = {
    h1: ({ node, children, ...props }) => {
      const text = getTextFromChildren(children);
      const id = slugify(text);
      return (
        <h1 id={id} {...props}>
          {children}
        </h1>
      );
    },
    h2: ({ node, children, ...props }) => {
      const text = getTextFromChildren(children);
      const id = slugify(text);
      return (
        <h2 id={id} {...props}>
          {children}
        </h2>
      );
    },
    h3: ({ node, children, ...props }) => {
      const text = getTextFromChildren(children);
      const id = slugify(text);
      return (
        <h3 id={id} {...props}>
          {children}
        </h3>
      );
    },
    h4: ({ node, children, ...props }) => {
      const text = getTextFromChildren(children);
      const id = slugify(text);
      return (
        <h4 id={id} {...props}>
          {children}
        </h4>
      );
    },
  };

  const sidebar = (
    <aside className="rules-sidebar">
      <div className="rules-sidebar-header">Game Rules (SRD)</div>
      {RULES_NAV.map((category) => (
        <div key={category.label} className="rules-nav-category">
          <button
            type="button"
            className="rules-nav-category-header"
            onClick={() => toggleCategory(category.label)}
          >
            {expandedCategories[category.label] ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            {category.label}
          </button>
          {expandedCategories[category.label] && (
            <div className="rules-nav-items">
              {category.items.map((item) => (
                <button
                  key={item.slug ?? 'overview'}
                  type="button"
                  className={`rules-nav-item${isItemActive(item.slug) ? ' active' : ''}`}
                  onClick={() => selectNavItem(item.slug)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  );

  if (loading) {
    return (
      <div className="rules-layout">
        {sidebar}
        <main className="rules-main" ref={mainRef}>
          <div className="rules-loading">Loading section…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rules-layout">
        {sidebar}
        <main className="rules-main" ref={mainRef}>
          <div className="rules-error">Error: {error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="rules-layout">
      {sidebar}
      <main ref={mainRef} className="rules-main">
        <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
      </main>
    </div>
  );
}
