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

export default function RulesPage({ onBack, initialSection }) {
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(
    RULES_NAV.reduce((acc, cat, i) => ({ ...acc, [cat.label]: cat.expanded ?? true }), {})
  );
  const mainRef = useRef(null);

  useEffect(() => {
    fetch('/game-rules-srd.md')
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Failed to load SRD'))))
      .then(setMarkdown)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const scrollToSection = useCallback((slug) => {
    const el = document.getElementById(slug);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    if (initialSection && !loading && mainRef.current) {
      setTimeout(() => scrollToSection(initialSection), 100);
    }
  }, [initialSection, loading, scrollToSection]);

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

  if (loading) {
    return (
      <div className="rules-layout">
        <aside className="rules-sidebar">
          <div className="rules-sidebar-header">Game Rules (SRD)</div>
        </aside>
        <main className="rules-main">
          <div className="rules-loading">Loading rules…</div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rules-layout">
        <aside className="rules-sidebar">
          <div className="rules-sidebar-header">Game Rules (SRD)</div>
        </aside>
        <main className="rules-main">
          <div className="rules-error">Error: {error}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="rules-layout">
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
                    key={item.slug}
                    type="button"
                    className="rules-nav-item"
                    onClick={() => scrollToSection(item.slug)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>
      <main ref={mainRef} className="rules-main">
        <ReactMarkdown components={components}>{markdown}</ReactMarkdown>
      </main>
    </div>
  );
}
