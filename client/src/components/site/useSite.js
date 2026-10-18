// Loads the public site data. No sign-in is involved. The last result is kept so moving between
// pages is instant, and it is re-fetched each time a page opens so edits from the admin panel show up.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';

let cached = null;

export function useSite() {
  const [state, setState] = useState(cached ? { status: 'ready', data: cached, error: '' } : { status: 'loading', data: null, error: '' });

  const load = useCallback(() => {
    api.publicSite()
      .then((data) => { cached = data; setState({ status: 'ready', data, error: '' }); })
      .catch((e) => setState((s) => (s.data ? s : { status: 'error', data: null, error: e.message })));
  }, []);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: () => { setState((s) => ({ ...s, status: s.data ? 'ready' : 'loading' })); load(); } };
}

// Sets the tab title, description and social-sharing tags for the current public page.
function setMeta(attr, key, content) {
  let tag = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) { tag?.remove(); return; }
  if (!tag) { tag = document.createElement('meta'); tag.setAttribute(attr, key); document.head.appendChild(tag); }
  tag.content = content;
}
export function usePageMeta(title, description, siteName) {
  useEffect(() => {
    if (title) document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', siteName);
    setMeta('name', 'twitter:card', 'summary');
  }, [title, description, siteName]);
}
